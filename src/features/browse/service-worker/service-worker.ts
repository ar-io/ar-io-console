/// <reference lib="webworker" />

/**
 * Service Worker with manifest-first verification.
 *
 * Flow:
 * 1. Intercept /ar-proxy/{identifier}/ requests
 * 2. Resolve ArNS name to manifest txId (or use txId directly)
 * 3. Fetch and parse manifest
 * 4. Pre-verify ALL resources in manifest
 * 5. Cache verified content
 * 6. Serve from verified cache
 */

// CRITICAL: Import polyfills FIRST before any other imports
// These must run before any dependency code that might reference Node.js globals
import './polyfills/module-polyfill';
import './polyfills/process-polyfill';
import './polyfills/buffer-polyfill';
import './polyfills/fetch-polyfill';

import { initializeWayfinder, isWayfinderReady, getConfig, waitForInitialization } from './wayfinder-instance';
import { verifyIdentifier, getVerifiedContent, setVerificationConcurrency } from './manifest-verifier';
import {
  getManifestState,
  isVerificationComplete,
  isVerificationInProgress,
  broadcastEvent,
  clearManifestState,
  setActiveIdentifier,
  getActiveIdentifier,
  getActiveTxIdForPath,
} from './verification-state';
import { verifiedCache } from './verified-cache';
import { logger } from './logger';
import { injectLocationPatch } from './location-patcher';
import type { SwWayfinderConfig } from './types';

const TAG = 'SW';

declare const self: ServiceWorkerGlobalScope;

// Track pending verification promises to avoid duplicate work
const pendingVerifications = new Map<string, Promise<void>>();

// Track abort controllers to cancel in-progress verifications
const abortControllers = new Map<string, AbortController>();

// ============================================================================
// Service Worker Lifecycle
// ============================================================================

self.addEventListener('install', () => {
  logger.debug(TAG, 'Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  logger.debug(TAG, 'Activating...');
  event.waitUntil(self.clients.claim());
});

// ============================================================================
// Message Handler
// ============================================================================

self.addEventListener('message', (event) => {
  logger.debug(TAG, `Received message: ${event.data?.type}`);

  if (event.data.type === 'INIT_WAYFINDER') {
    const config: SwWayfinderConfig = event.data.config;
    initializeWayfinder(config);
    if (config.concurrency) {
      setVerificationConcurrency(config.concurrency);
    }
    event.ports[0]?.postMessage({ type: 'WAYFINDER_READY' });
  }

  if (event.data.type === 'CLEAR_CACHE') {
    verifiedCache.clear();
    logger.debug(TAG, 'Cache cleared');
    event.ports[0]?.postMessage({ type: 'CACHE_CLEARED' });
  }

  if (event.data.type === 'CLEAR_VERIFICATION') {
    const identifier = event.data.identifier;
    if (identifier) {
      // Abort any in-progress verification first
      const controller = abortControllers.get(identifier);
      if (controller) {
        logger.debug(TAG, `Aborting verification for: ${identifier}`);
        controller.abort();
        abortControllers.delete(identifier);
      }

      const state = getManifestState(identifier);
      if (state?.pathToTxId) {
        const txIds = Array.from(state.pathToTxId.values());
        if (state.manifestTxId) {
          txIds.push(state.manifestTxId);
        }
        verifiedCache.clearForManifest(txIds);
      }
      clearManifestState(identifier);
      // Clear pending verification so re-search starts fresh with new gateway
      pendingVerifications.delete(identifier);
      // Clear active identifier if it matches
      if (getActiveIdentifier() === identifier) {
        setActiveIdentifier(null);
      }
      logger.debug(TAG, `Cleared verification for: ${identifier}`);
    }
    event.ports[0]?.postMessage({ type: 'VERIFICATION_CLEARED' });
  }
});

// ============================================================================
// Fetch Handler
// ============================================================================

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Primary: Intercept /ar-proxy/ requests
  if (url.pathname.startsWith('/ar-proxy/')) {
    logger.debug(TAG, `Proxy request: ${url.pathname}`);
    event.respondWith(handleArweaveProxy(event.request));
    return;
  }

  // Secondary: Intercept absolute path requests that match the active identifier's manifest
  // This handles apps that use absolute paths like "/assets/foo.js" instead of relative paths
  //
  // IMPORTANT: Never intercept navigation requests (mode: 'navigate') as these are for
  // loading the main app itself, not for loading Arweave content resources.
  // The ar-proxy iframe's initial load is already handled by the /ar-proxy/ check above.
  if (event.request.mode === 'navigate') {
    return;
  }

  const activeId = getActiveIdentifier();
  if (activeId && isVerificationComplete(activeId)) {
    // Check if this path exists in the active manifest
    const path = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
    const txId = getActiveTxIdForPath(path);

    if (txId) {
      logger.debug(TAG, `Absolute path intercept: ${url.pathname} → ${activeId}`);
      event.respondWith(serveFromCache(activeId, path));
      return;
    }
  }

  // Pass through all other requests
  return;
});

// ============================================================================
// Main Proxy Handler
// ============================================================================

async function handleArweaveProxy(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { identifier, resourcePath } = parseProxyPath(url.pathname);

  if (!identifier) {
    return new Response('Missing identifier in path', { status: 400 });
  }

  // Wait for Wayfinder to be initialized (handles race condition at startup)
  // The app sends INIT_WAYFINDER after registration, so we wait for that
  if (!isWayfinderReady()) {
    logger.debug(TAG, 'Waiting for Wayfinder initialization...');
    const initialized = await waitForInitialization(10000); // Wait up to 10 seconds

    if (!initialized) {
      logger.warn(TAG, 'Wayfinder initialization timeout');
      return createErrorResponse(
        'Verification Not Ready',
        'The verification service is still initializing. Please reload the page or try again.',
        identifier
      );
    }
    logger.debug(TAG, 'Wayfinder initialization complete');
  }

  const config = getConfig();
  if (!config) {
    return createErrorResponse(
      'Configuration Error',
      'Verification configuration not available. Please reload the page.',
      identifier
    );
  }

  try {
    const complete = isVerificationComplete(identifier);
    const inProgress = isVerificationInProgress(identifier);

    if (complete) {
      logger.debug(TAG, `Serving cached: ${identifier}/${resourcePath || 'index'}`);
      // Set as active so we can intercept absolute path requests from this app
      setActiveIdentifier(identifier);
      return serveFromCache(identifier, resourcePath);
    }

    if (inProgress) {
      logger.debug(TAG, `Waiting for verification: ${identifier}`);
      await waitForVerification(identifier);
      // Set as active so we can intercept absolute path requests from this app
      setActiveIdentifier(identifier);
      return serveFromCache(identifier, resourcePath);
    }

    // Start new verification
    logger.debug(TAG, `Starting verification: ${identifier}`);
    await startVerification(identifier, config);
    // Set as active so we can intercept absolute path requests from this app
    setActiveIdentifier(identifier);
    return serveFromCache(identifier, resourcePath);

  } catch (error) {
    logger.error(TAG, 'Verification error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);

    broadcastEvent({
      type: 'verification-failed',
      identifier,
      error: errorMsg,
    });

    return createErrorResponse('Verification Failed', errorMsg, identifier);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a styled HTML error response.
 * Uses ar.io console branding (light theme with purple accents).
 */
function createErrorResponse(title: string, message: string, identifier: string): Response {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #FFFFFF;
      color: #23232D;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .container {
      max-width: 480px;
      text-align: center;
    }
    .icon {
      width: 64px;
      height: 64px;
      background: #F0F0F0;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 32px;
    }
    h1 {
      font-size: 24px;
      font-weight: 600;
      color: #dc2626;
      margin-bottom: 16px;
    }
    .message {
      font-size: 14px;
      color: #23232D;
      opacity: 0.7;
      margin-bottom: 24px;
      word-break: break-word;
      line-height: 1.5;
    }
    .identifier {
      font-family: monospace;
      font-size: 12px;
      background: #F0F0F0;
      padding: 12px 16px;
      border-radius: 12px;
      color: #23232D;
      opacity: 0.8;
      margin-bottom: 24px;
      word-break: break-all;
      border: 1px solid rgba(0, 0, 0, 0.1);
    }
    .hint {
      font-size: 12px;
      color: #23232D;
      opacity: 0.5;
    }
    .hint a {
      color: #5427C8;
      text-decoration: none;
    }
    .hint a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🛡️</div>
    <h1>${title}</h1>
    <div class="message">${message || 'An unknown error occurred during verification.'}</div>
    <div class="identifier">${identifier}</div>
    <div class="hint">Try using a different verification method or retry with a different gateway.</div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 500,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/**
 * Parse /ar-proxy/{identifier}/{path...} into components.
 */
function parseProxyPath(pathname: string): { identifier: string; resourcePath: string } {
  // Remove /ar-proxy/ prefix
  const fullPath = pathname.slice('/ar-proxy/'.length);

  // Split into identifier and resource path
  const firstSlash = fullPath.indexOf('/');

  if (firstSlash === -1) {
    // Just identifier, no trailing slash
    return { identifier: fullPath, resourcePath: '' };
  }

  const identifier = fullPath.slice(0, firstSlash);
  const resourcePath = fullPath.slice(firstSlash + 1);

  return { identifier, resourcePath };
}

/**
 * Start verification for an identifier.
 * Deduplicates concurrent requests for the same identifier.
 */
async function startVerification(identifier: string, config: SwWayfinderConfig): Promise<void> {
  // Check if already pending
  let pending = pendingVerifications.get(identifier);
  if (pending) {
    logger.debug(TAG, `Joining existing verification: ${identifier}`);
    return pending;
  }

  // Create abort controller for this verification
  const controller = new AbortController();
  abortControllers.set(identifier, controller);

  pending = verifyIdentifier(identifier, config, controller.signal)
    .finally(() => {
      pendingVerifications.delete(identifier);
      abortControllers.delete(identifier);
    });

  pendingVerifications.set(identifier, pending);
  return pending;
}

/**
 * Wait for an in-progress verification to complete.
 */
async function waitForVerification(identifier: string): Promise<void> {
  const pending = pendingVerifications.get(identifier);
  if (pending) {
    await pending;
    return;
  }

  // Poll for completion (shouldn't normally happen)
  const maxWait = 60000; // 60 seconds
  const pollInterval = 100;
  let waited = 0;

  while (waited < maxWait) {
    if (isVerificationComplete(identifier)) {
      return;
    }
    if (!isVerificationInProgress(identifier)) {
      throw new Error('Verification stopped unexpectedly');
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    waited += pollInterval;
  }

  throw new Error('Verification timeout');
}

/**
 * Serve a resource from the verified cache.
 * Works for 'complete' and 'partial' status.
 * For HTML content, injects a location patch script to make the app
 * think it's running at the gateway subdomain.
 */
function serveFromCache(identifier: string, resourcePath: string): Response {
  const state = getManifestState(identifier);

  if (!state) {
    logger.error(TAG, `No state for: ${identifier}`);
    return createErrorResponse('Not Found', 'No verification state found for this content.', identifier);
  }

  if (state.status === 'failed') {
    return createErrorResponse('Verification Failed', state.error || 'All resources failed verification.', identifier);
  }

  if (state.status !== 'complete' && state.status !== 'partial') {
    return createErrorResponse('Verification In Progress', 'Please wait while content is being verified.', identifier);
  }

  // Pass the location patcher to inject into HTML responses
  const response = getVerifiedContent(identifier, resourcePath, injectLocationPatch);

  if (!response) {
    logger.warn(TAG, `Resource not found: ${identifier}/${resourcePath}`);
    const availablePaths = state?.pathToTxId ? Array.from(state.pathToTxId.keys()).slice(0, 10) : [];
    const pathsHint = availablePaths.length > 0
      ? `Available paths: ${availablePaths.join(', ')}${availablePaths.length >= 10 ? '...' : ''}`
      : 'No paths available in manifest.';
    return createErrorResponse('Resource Not Found', `The path "${resourcePath}" was not found in the manifest. ${pathsHint}`, identifier);
  }

  return response;
}

// ============================================================================
// Startup
// ============================================================================

logger.info(TAG, 'Service worker loaded');
