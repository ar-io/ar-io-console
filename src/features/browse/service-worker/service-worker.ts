/// <reference lib="webworker" />

/**
 * Service Worker with manifest-first lazy verification.
 *
 * Flow:
 * 1. Intercept /ar-proxy/{identifier}/ requests
 * 2. Resolve ArNS name to manifest txId (or use txId directly)
 * 3. Fetch and verify manifest (path→txId mappings)
 * 4. Eagerly verify the index file
 * 5. Mark as ready to serve (manifest-verified status)
 * 6. Verify other resources ON-DEMAND as user accesses them
 * 7. Cache verified content and serve from cache
 *
 * Security: All content is verified before serving. The manifest provides
 * trusted path→txId mappings, and each resource is verified by its txId.
 */

// CRITICAL: Import polyfills FIRST before any other imports
// These must run before any dependency code that might reference Node.js globals
import './polyfills/module-polyfill';
import './polyfills/process-polyfill';
import './polyfills/buffer-polyfill';
import './polyfills/fetch-polyfill';

import { initializeWayfinder, isWayfinderReady, getConfig, waitForInitialization } from './wayfinder-instance';
import { verifyIdentifier, getVerifiedContent, setVerificationConcurrency, verifyResourceOnDemand } from './manifest-verifier';
import {
  getManifestState,
  isVerificationInProgress,
  isReadyToServe,
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
  // Guard against null/undefined event.data
  const data = event.data;
  if (!data || typeof data.type !== 'string') return;

  logger.debug(TAG, `Received message: ${data.type}`);

  if (data.type === 'INIT_WAYFINDER') {
    const config: SwWayfinderConfig = data.config;
    initializeWayfinder(config);
    if (config.concurrency) {
      setVerificationConcurrency(config.concurrency);
    }
    event.ports[0]?.postMessage({ type: 'WAYFINDER_READY' });
  }

  if (data.type === 'CLEAR_CACHE') {
    verifiedCache.clear();
    logger.debug(TAG, 'Cache cleared');
    event.ports[0]?.postMessage({ type: 'CACHE_CLEARED' });
  }

  if (data.type === 'CLEAR_VERIFICATION') {
    const identifier = data.identifier;
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
  if (activeId && isReadyToServe(activeId)) {
    // Check if this path exists in the active manifest
    const path = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
    const txId = getActiveTxIdForPath(path);

    if (txId) {
      logger.debug(TAG, `Absolute path intercept: ${url.pathname} → ${activeId}`);
      event.respondWith(serveResource(activeId, path));
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

  // Check for download query param (e.g., ?download=whitepaper.pdf)
  const downloadFilename = url.searchParams.get('download');

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
    // Check current verification state
    const ready = isReadyToServe(identifier);
    const inProgress = isVerificationInProgress(identifier);

    if (ready) {
      // Manifest verified - serve resource (on-demand verification if needed)
      logger.debug(TAG, `Serving: ${identifier}/${resourcePath || 'index'}`);
      setActiveIdentifier(identifier);
      return await serveResource(identifier, resourcePath, downloadFilename);
    }

    if (inProgress) {
      // Wait for manifest verification to complete (not all resources, just manifest)
      logger.debug(TAG, `Waiting for manifest: ${identifier}`);
      await waitForManifestVerification(identifier);
      setActiveIdentifier(identifier);
      return await serveResource(identifier, resourcePath, downloadFilename);
    }

    // Start new verification (manifest + index only, other resources lazy)
    logger.debug(TAG, `Starting verification: ${identifier}`);
    await startVerification(identifier, config);
    setActiveIdentifier(identifier);
    return await serveResource(identifier, resourcePath, downloadFilename);

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
 * Escape HTML entities to prevent XSS.
 */
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

/**
 * Create a styled HTML error response.
 * Uses ar.io console branding (light theme with purple accents).
 */
function createErrorResponse(title: string, message: string, identifier: string): Response {
  // Escape all user-provided content to prevent XSS
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message || 'An unknown error occurred during verification.');
  const safeIdentifier = escapeHtml(identifier);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
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
    <h1>${safeTitle}</h1>
    <div class="message">${safeMessage}</div>
    <div class="identifier">${safeIdentifier}</div>
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
 * Wait for manifest verification to complete (not all resources, just manifest + index).
 * This is faster than waiting for all resources since we use lazy verification.
 */
async function waitForManifestVerification(identifier: string): Promise<void> {
  const pending = pendingVerifications.get(identifier);
  if (pending) {
    await pending;
    return;
  }

  // Poll for ready state (manifest verified)
  const maxWait = 30000; // 30 seconds - manifest should verify quickly
  const pollInterval = 50;
  let waited = 0;

  while (waited < maxWait) {
    if (isReadyToServe(identifier)) {
      return;
    }

    const state = getManifestState(identifier);
    if (state?.status === 'failed') {
      throw new Error(state.error || 'Verification failed');
    }

    if (!isVerificationInProgress(identifier) && !isReadyToServe(identifier)) {
      throw new Error('Verification stopped unexpectedly');
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
    waited += pollInterval;
  }

  throw new Error('Manifest verification timeout');
}

/**
 * Serve a resource, verifying on-demand if not already in cache.
 * This is the core of lazy verification - resources are verified as users access them.
 *
 * For HTML content, injects a location patch script to make the app
 * think it's running at the gateway subdomain.
 *
 * @param downloadFilename - If provided, adds Content-Disposition header for download
 */
async function serveResource(identifier: string, resourcePath: string, downloadFilename?: string | null): Promise<Response> {
  const state = getManifestState(identifier);

  if (!state) {
    logger.error(TAG, `No state for: ${identifier}`);
    return createErrorResponse('Not Found', 'No verification state found for this content.', identifier);
  }

  if (state.status === 'failed') {
    return createErrorResponse('Verification Failed', state.error || 'Verification failed.', identifier);
  }

  if (!isReadyToServe(identifier)) {
    return createErrorResponse('Not Ready', 'Manifest not yet verified.', identifier);
  }

  // Normalize path
  let normalizedPath = resourcePath.startsWith('/') ? resourcePath.slice(1) : resourcePath;
  if (normalizedPath === '') {
    normalizedPath = state.indexPath;
  } else if (normalizedPath.endsWith('/')) {
    normalizedPath = normalizedPath + state.indexPath;
  }

  // Look up txId from the verified manifest
  let txId = state.pathToTxId.get(normalizedPath);

  if (!txId) {
    // Try fallback
    const fallbackId = state.pathToTxId.get('__fallback__');
    if (fallbackId) {
      txId = fallbackId;
    } else {
      logger.warn(TAG, `Path not in manifest: ${resourcePath}`);
      const availablePaths = Array.from(state.pathToTxId.keys()).slice(0, 10);
      return createErrorResponse(
        'Resource Not Found',
        `Path "${resourcePath}" not in manifest. Available: ${availablePaths.join(', ')}${availablePaths.length >= 10 ? '...' : ''}`,
        identifier
      );
    }
  }

  // Check if already in cache
  if (verifiedCache.has(txId)) {
    logger.debug(TAG, `Cache hit: ${normalizedPath}`);
    // For downloads, serve directly with Content-Disposition (skip location patching)
    if (downloadFilename) {
      const resource = verifiedCache.get(txId);
      if (resource) {
        return verifiedCache.toResponse(resource, downloadFilename);
      }
    }
    const response = getVerifiedContent(identifier, resourcePath, injectLocationPatch);
    if (response) {
      return response;
    }
  }

  // Not in cache - verify on-demand
  logger.debug(TAG, `Cache miss, verifying on-demand: ${normalizedPath}`);

  const success = await verifyResourceOnDemand(identifier, normalizedPath);

  if (!success) {
    return createErrorResponse(
      'Verification Failed',
      `Failed to verify resource: ${resourcePath}`,
      identifier
    );
  }

  // Now serve from cache
  // For downloads, serve directly with Content-Disposition (skip location patching)
  if (downloadFilename) {
    const resource = verifiedCache.get(txId);
    if (resource) {
      return verifiedCache.toResponse(resource, downloadFilename);
    }
  }
  const response = getVerifiedContent(identifier, resourcePath, injectLocationPatch);

  if (response) {
    return response;
  }

  // This shouldn't happen - verification succeeded but resource not in cache
  logger.error(TAG, `Verification succeeded but cache miss: ${normalizedPath}`);
  return createErrorResponse(
    'Internal Error',
    'Resource verified but not available.',
    identifier
  );
}

// ============================================================================
// Startup
// ============================================================================

logger.info(TAG, 'Service worker loaded');
