/**
 * Manifest-first verification orchestrator.
 *
 * SECURITY MODEL:
 * - ArNS names are resolved via trusted gateways with consensus checking
 * - Manifest content is cryptographically verified BEFORE trusting path->txId mappings
 * - All resources are verified against trusted gateways before serving
 *
 * Flow:
 * 1. Resolve ArNS name to txId via trusted gateways (consensus required)
 * 2. Select a responsive routing gateway
 * 3. Fetch AND VERIFY manifest content via Wayfinder (hash/signature check)
 * 4. Parse manifest only AFTER verification passes
 * 5. Verify all resources in manifest
 * 6. Serve only verified content from cache
 */

import type { ArweaveManifest, ManifestCheckResult, SwWayfinderConfig } from './types';
import { verifiedCache } from './verified-cache';
import {
  startManifestVerification,
  setResolvedTxId,
  setManifestLoaded,
  setManifestVerified,
  recordResourceVerified,
  recordResourceFailed,
  recordResourceVerifying,
  recordResourceVerifiedOnDemand,
  recordResourceFailedOnDemand,
  failVerification,
  getManifestState,
  isReadyToServe,
  broadcastEvent,
} from './verification-state';
import { getWayfinder, isWayfinderReady, setSelectedGateway, getVerificationStrategy } from './wayfinder-instance';
import { swGatewayHealth } from './gateway-health';
import { logger } from './logger';
import type { VerificationStrategy } from '@ar.io/wayfinder-core';

const TAG = 'Verifier';

// Default concurrency limit for parallel verification
const DEFAULT_CONCURRENCY = 10;

// Timeout for individual gateway requests (ArNS resolution, gateway selection)
const GATEWAY_TIMEOUT_MS = 10000; // 10 seconds

// Current concurrency setting (can be updated via config)
let maxConcurrentVerifications = DEFAULT_CONCURRENCY;

// Track pending on-demand verifications to prevent duplicate work
// Key: `${identifier}:${normalizedPath}`
const pendingOnDemandVerifications = new Map<string, Promise<boolean>>();

/**
 * Set the concurrency limit for parallel resource verification.
 */
export function setVerificationConcurrency(concurrency: number): void {
  maxConcurrentVerifications = Math.max(1, Math.min(20, concurrency));
  logger.debug(TAG, `Concurrency: ${maxConcurrentVerifications}`);
}

// Detect if identifier is a 43-char Arweave transaction ID
const TX_ID_REGEX = /^[A-Za-z0-9_-]{43}$/;

function isTxId(identifier: string): boolean {
  return TX_ID_REGEX.test(identifier);
}

/**
 * Resolve an ArNS name to a transaction ID using trusted gateways.
 * Queries multiple trusted gateways and requires consensus to prevent
 * a malicious gateway from redirecting to different content.
 *
 * Uses subdomain format: {arnsName}.{gateway-host} (e.g., vilenarios.ar-io.dev)
 */
export async function resolveArnsToTxId(
  arnsName: string,
  trustedGateways: string[]
): Promise<{ txId: string; gateway: string }> {
  if (trustedGateways.length === 0) {
    throw new Error('No trusted gateways available for ArNS resolution');
  }

  logger.debug(TAG, `Resolving ArNS "${arnsName}" via ${trustedGateways.length} gateways`);

  const results = await Promise.allSettled(
    trustedGateways.map(async (gateway) => {
      const gatewayUrl = new URL(gateway);
      const arnsUrl = `https://${arnsName}.${gatewayUrl.host}`;

      const response = await fetch(arnsUrl, {
        method: 'HEAD',
        headers: { 'Accept': '*/*' },
        signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const txId = response.headers.get('x-arns-resolved-id');
      if (!txId) {
        throw new Error('No x-arns-resolved-id header');
      }

      return { txId, gateway: gateway.replace(/\/$/, '') };
    })
  );

  const successful = results
    .map((r, i) => ({ result: r, gateway: trustedGateways[i] }))
    .filter((r): r is { result: PromiseFulfilledResult<{ txId: string; gateway: string }>; gateway: string } =>
      r.result.status === 'fulfilled'
    )
    .map(r => r.result.value);

  if (successful.length === 0) {
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason?.message || 'Unknown error');
    throw new Error(`All gateways failed to resolve ArNS "${arnsName}": ${errors.join(', ')}`);
  }

  const txIds = successful.map(r => r.txId);
  const uniqueTxIds = [...new Set(txIds)];

  if (uniqueTxIds.length > 1) {
    logger.error(TAG, `ArNS mismatch for "${arnsName}":`,
      successful.map(s => `${new URL(s.gateway).hostname}=${s.txId.slice(0, 8)}`));
    throw new Error(`ArNS resolution mismatch for "${arnsName}" - security issue`);
  }

  const resolvedTxId = uniqueTxIds[0];
  const usedGateway = successful[0].gateway;

  logger.debug(TAG, `ArNS "${arnsName}" → ${resolvedTxId.slice(0, 8)}...`);

  return { txId: resolvedTxId, gateway: usedGateway };
}

/**
 * Find a working gateway by trying each one until one responds.
 * This is a lightweight check (HEAD request) to find a responsive gateway
 * before committing to verified fetches.
 *
 * Uses the gateway health cache to skip known unhealthy gateways.
 */
async function selectWorkingGateway(
  txId: string,
  gateways: string[]
): Promise<string> {
  if (gateways.length === 0) {
    throw new Error('No gateways available');
  }

  // Filter out known unhealthy gateways first
  let candidates = swGatewayHealth.filterHealthy(gateways);

  // If all are marked unhealthy, clear cache and use all gateways
  if (candidates.length === 0) {
    logger.debug(TAG, 'All gateways marked unhealthy, clearing cache');
    swGatewayHealth.clear();
    candidates = gateways;
  }

  let lastError: Error | null = null;

  for (const gateway of candidates) {
    const gatewayBase = gateway.replace(/\/+$/, '');
    const rawUrl = `${gatewayBase}/raw/${txId}`;

    try {
      // Use HEAD request with timeout to check if gateway is responsive
      const response = await fetch(rawUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      logger.debug(TAG, `Selected gateway: ${new URL(gatewayBase).hostname}`);
      return gatewayBase;

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const isTimeout = error instanceof Error && error.name === 'TimeoutError';
      logger.debug(TAG, `Gateway ${isTimeout ? 'timeout' : 'failed'}: ${new URL(gatewayBase).hostname} - ${errMsg}`);

      // Mark this gateway as unhealthy so we don't try it again soon
      swGatewayHealth.markUnhealthy(gatewayBase, undefined, errMsg);

      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw new Error(`All gateways failed. Last error: ${lastError?.message}`);
}

/**
 * Convert an ArrayBuffer to a ReadableStream for SDK compatibility.
 * The SDK's verifyData expects a DataStream (ReadableStream or AsyncIterable).
 */
function arrayBufferToStream(data: ArrayBuffer): ReadableStream<Uint8Array> {
  const uint8Array = new Uint8Array(data);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(uint8Array);
      controller.close();
    },
  });
}

/**
 * Compute SHA-256 hash of data and return as base64url string.
 * Uses Web Crypto API which is available in service workers.
 *
 * NOTE: This is only used for manifest verification where we need /raw/ endpoint.
 * For regular resources, we use the SDK's HashVerificationStrategy.
 */
async function computeHash(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  // Convert to base64url (Arweave format)
  let binary = '';
  for (let i = 0; i < hashArray.length; i++) {
    binary += String.fromCharCode(hashArray[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Fetch the trusted hash for a txId from trusted gateways using /raw/ endpoint.
 *
 * This is ONLY used for manifest verification because:
 * - The SDK's getDigest uses sandbox URLs which resolve manifests to index.html
 * - We need the hash of the raw manifest JSON, not the resolved content
 *
 * For regular resources, use verifyResourceWithSdk() instead.
 */
async function fetchTrustedHashForManifest(
  txId: string,
  trustedGateways: URL[]
): Promise<string> {
  // SECURITY: Query ALL trusted gateways in parallel and require consensus
  // This prevents a single compromised gateway from returning a malicious hash
  logger.debug(TAG, `Fetching manifest hash from ${trustedGateways.length} trusted gateways`);

  const results = await Promise.allSettled(
    trustedGateways.map(async (gateway) => {
      const gatewayBase = gateway.toString().replace(/\/+$/, '');
      const rawUrl = `${gatewayBase}/raw/${txId}`;

      // Try HEAD request first to get hash from header
      const headResponse = await fetch(rawUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
      });

      if (!headResponse.ok) {
        throw new Error(`HTTP ${headResponse.status}`);
      }

      // Check for hash header (x-ar-io-digest is the canonical one)
      const hashHeader = headResponse.headers.get('x-ar-io-digest') ||
                         headResponse.headers.get('x-ar-io-data-hash') ||
                         headResponse.headers.get('x-arweave-data-hash');

      if (hashHeader) {
        return { hash: hashHeader, gateway: gateway.hostname };
      }

      // No header - need to fetch and compute hash
      const fullResponse = await fetch(rawUrl, {
        signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
      });

      if (!fullResponse.ok) {
        throw new Error(`HTTP ${fullResponse.status}`);
      }

      const data = await fullResponse.arrayBuffer();
      const hash = await computeHash(data);
      return { hash, gateway: gateway.hostname };
    })
  );

  // Collect successful results
  const successful = results
    .filter((r): r is PromiseFulfilledResult<{ hash: string; gateway: string }> =>
      r.status === 'fulfilled'
    )
    .map(r => r.value);

  if (successful.length === 0) {
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason?.message || 'Unknown error');
    throw new Error(`All trusted gateways failed to provide hash: ${errors.join(', ')}`);
  }

  // SECURITY: Verify consensus - all gateways must agree on the hash
  const hashes = successful.map(r => r.hash);
  const uniqueHashes = [...new Set(hashes)];

  if (uniqueHashes.length > 1) {
    logger.error(TAG, `Manifest hash mismatch for ${txId}:`,
      successful.map(s => `${s.gateway}=${s.hash.slice(0, 12)}`));
    throw new Error(`Manifest hash mismatch across trusted gateways - security issue`);
  }

  const trustedHash = uniqueHashes[0];
  logger.debug(TAG, `Got consensus hash from ${successful.length} gateways: ${trustedHash.slice(0, 12)}...`);
  return trustedHash;
}

/**
 * Verify MANIFEST content.
 *
 * For HASH verification:
 *   Manifests require special handling because the SDK's sandbox URLs resolve
 *   manifests to their index.html content, giving a different hash than the
 *   raw manifest JSON we fetch via /raw/{txId}. So we use custom /raw/ verification.
 *
 * For SIGNATURE verification:
 *   We also use custom /raw/ verification for manifests to be safe.
 *   While signature verification theoretically works on the data item itself,
 *   the SDK still uses sandbox URLs to fetch data item attributes, and we want
 *   to ensure we're verifying the manifest txId, not the resolved content.
 *
 * NOTE: For individual resources, we use the SDK directly since they don't
 * have the manifest resolution issue.
 *
 * @param txId - The manifest transaction ID
 * @param data - The manifest data to verify (as ArrayBuffer)
 * @param strategy - The verification strategy
 */
async function verifyManifestData(
  txId: string,
  data: ArrayBuffer,
  strategy: VerificationStrategy
): Promise<void> {
  // For manifests, always use custom /raw/ hash verification
  // This is because the SDK's sandbox URLs resolve manifests to their index.html,
  // which could cause issues even for signature verification since it fetches
  // data item attributes from sandbox URLs.
  //
  // For individual resources, we use the SDK directly (in verifyResourceWithSdk).
  const computedHash = await computeHash(data);
  logger.debug(TAG, `Computed manifest hash: ${computedHash.slice(0, 12)}...`);

  const trustedHash = await fetchTrustedHashForManifest(txId, strategy.trustedGateways);

  if (computedHash !== trustedHash) {
    throw new Error(`Manifest hash mismatch: computed=${computedHash.slice(0, 12)}..., trusted=${trustedHash.slice(0, 12)}...`);
  }

  logger.debug(TAG, `Manifest verified: ${txId.slice(0, 8)}...`);
}

/**
 * Verify RESOURCE content using the SDK's verification strategy.
 *
 * Works with both HashVerificationStrategy and SignatureVerificationStrategy.
 * For individual resources (JS, CSS, images, etc.), the txId points directly
 * to the file content, so both strategies work correctly via the SDK.
 *
 * @param txId - The resource transaction ID
 * @param data - The resource data to verify (as ArrayBuffer)
 * @param strategy - The SDK verification strategy (hash or signature)
 */
async function verifyResourceWithSdk(
  txId: string,
  data: ArrayBuffer,
  strategy: VerificationStrategy
): Promise<void> {
  // Convert ArrayBuffer to ReadableStream for SDK compatibility
  const dataStream = arrayBufferToStream(data);

  // Use SDK's verification strategy (hash or signature based on config)
  await strategy.verifyData({
    data: dataStream,
    txId,
    headers: {},
  });

  logger.debug(TAG, `SDK verified resource: ${txId.slice(0, 8)}...`);
}

/**
 * Fetch and verify manifest/content from the selected routing gateway.
 *
 * SECURITY: This fetches RAW content (not resolved through manifest paths)
 * and verifies its hash against trusted gateways before trusting it.
 *
 * For manifests: Uses custom /raw/ verification (SDK sandbox URLs resolve to index.html)
 * For single files: Uses SDK's HashVerificationStrategy
 */
async function fetchAndVerifyRawContent(
  txId: string,
  routingGateway: string
): Promise<ManifestCheckResult> {
  const gatewayBase = routingGateway.replace(/\/+$/, '');
  const rawUrl = `${gatewayBase}/raw/${txId}`;

  logger.debug(TAG, `Fetching raw content: ${txId.slice(0, 8)}... from ${new URL(gatewayBase).hostname}`);

  // Fetch raw content from routing gateway
  const response = await fetch(rawUrl, {
    signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch raw content: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const rawData = await response.arrayBuffer();
  const strategy = getVerificationStrategy();

  // Check if it's a manifest first (before verification) to choose the right method
  let isManifest = false;
  let manifest: ArweaveManifest | undefined;

  if (contentType.includes('application/x.arweave-manifest+json')) {
    isManifest = true;
    const text = new TextDecoder().decode(rawData);
    manifest = JSON.parse(text) as ArweaveManifest;
  } else {
    // Try parsing as JSON manifest (some may not have correct content-type)
    try {
      const text = new TextDecoder().decode(rawData);
      const parsed = JSON.parse(text);
      if (parsed.manifest === 'arweave/paths' && parsed.paths) {
        isManifest = true;
        manifest = parsed as ArweaveManifest;
      }
    } catch {
      // Not JSON, not a manifest
    }
  }

  // Use appropriate verification method
  if (isManifest) {
    // Manifests need /raw/ verification because SDK sandbox URLs resolve to index.html
    await verifyManifestData(txId, rawData, strategy);
  } else {
    // Single files can use SDK verification
    await verifyResourceWithSdk(txId, rawData, strategy);
  }

  // Cache the verified content
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  verifiedCache.set(txId, { contentType, data: rawData, headers });

  // Return result
  if (isManifest) {
    return { isManifest: true, manifest: manifest!, rawData, contentType };
  }
  return { isManifest: false, rawData, contentType };
}

/**
 * Verify and cache a single resource by txId.
 * Records verification success/failure directly (not via Wayfinder callbacks).
 *
 * If the primary gateway fails, retries with fallback gateways.
 * Uses SDK's HashVerificationStrategy for verification.
 *
 * @param verificationId - Must match the ID returned by startManifestVerification
 */
async function verifyAndCacheResource(
  identifier: string,
  verificationId: number,
  txId: string,
  path: string,
  fallbackGateways: string[]
): Promise<void> {
  if (!isWayfinderReady()) {
    throw new Error('Wayfinder not ready');
  }

  if (verifiedCache.has(txId)) {
    recordResourceVerified(identifier, verificationId, txId, path);
    return;
  }

  const wayfinder = getWayfinder();
  const strategy = getVerificationStrategy();
  const arUrl = `ar://${txId}`;

  // First attempt with the primary (locked) gateway via Wayfinder
  try {
    const response = await wayfinder.request(arUrl);
    const data = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Verify using SDK's HashVerificationStrategy
    await verifyResourceWithSdk(txId, data, strategy);

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    verifiedCache.set(txId, { contentType, data, headers });
    recordResourceVerified(identifier, verificationId, txId, path);
    return;

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.warn(TAG, `Primary gateway failed for ${path}: ${errMsg}, trying fallbacks...`);
    // Continue to fallback attempts
  }

  // Fallback: Fetch directly from other gateways and verify with SDK
  // This avoids race conditions with the global selectedGateway during concurrent verification
  let lastError: Error | null = null;

  for (const gateway of fallbackGateways) {
    const gatewayBase = gateway.replace(/\/+$/, '');

    try {
      // Fetch directly from this gateway (bypassing Wayfinder's routing)
      const rawUrl = `${gatewayBase}/raw/${txId}`;
      const response = await fetch(rawUrl, {
        signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'application/octet-stream';

      // Verify using SDK's HashVerificationStrategy
      await verifyResourceWithSdk(txId, data, strategy);

      // Verification passed - cache it
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      verifiedCache.set(txId, { contentType, data, headers });
      recordResourceVerified(identifier, verificationId, txId, path);

      logger.info(TAG, `Fallback succeeded: ${path} via ${new URL(gatewayBase).hostname}`);
      return;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(TAG, `Fallback ${new URL(gatewayBase).hostname} failed for ${path}: ${lastError.message}`);
      // Continue to next fallback
    }
  }

  // All attempts failed
  const errorMsg = lastError?.message || 'All gateways failed';
  logger.warn(TAG, `Failed: ${path} - ${errorMsg}`);
  recordResourceFailed(identifier, verificationId, txId, path, errorMsg);
  throw lastError || new Error(errorMsg);
}

/**
 * Verify all resources in a manifest with concurrency control.
 * Returns true if manifest was empty (caller should trigger completion).
 *
 * Uses SDK's HashVerificationStrategy for verification (via getVerificationStrategy()).
 *
 * NOTE: This function is kept for potential future use (eager verification mode option).
 * Currently, we use lazy verification (verifyResourceOnDemand) instead.
 *
 * @param primaryGateway - The primary gateway to use for all resources (already set globally)
 * @param fallbackGateways - Backup gateways to try if primary fails for a resource
 * @param signal - Optional AbortSignal to cancel verification
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function verifyAllResources(
  identifier: string,
  verificationId: number,
  manifest: ArweaveManifest,
  primaryGateway: string,
  fallbackGateways: string[],
  signal?: AbortSignal
): Promise<boolean> {
  const entries = Object.entries(manifest.paths);

  if (manifest.fallback?.id) {
    entries.push(['__fallback__', { id: manifest.fallback.id }]);
  }

  // Handle empty manifest - return true so caller triggers completion
  if (entries.length === 0) {
    logger.info(TAG, 'Empty manifest');
    return true;
  }

  logger.debug(TAG, `Verifying ${entries.length} resources (${fallbackGateways.length} fallback gateways)`);

  // Filter out the primary gateway from fallbacks to avoid duplicate attempts
  const filteredFallbacks = fallbackGateways.filter(g =>
    g.replace(/\/+$/, '') !== primaryGateway.replace(/\/+$/, '')
  );

  const allResults: Promise<void>[] = [];
  const activePromises = new Set<Promise<void>>();

  for (const [path, entry] of entries) {
    // Check abort signal before starting each new verification
    if (signal?.aborted) {
      logger.debug(TAG, `Verification aborted, stopping after ${allResults.length} resources`);
      break;
    }

    while (activePromises.size >= maxConcurrentVerifications) {
      await Promise.race(activePromises);
      // Check again after waiting
      if (signal?.aborted) {
        break;
      }
    }

    if (signal?.aborted) {
      break;
    }

    // Handle both formats: { id: string } and raw string txId
    const txId = typeof entry === 'string' ? entry : entry.id;

    // Primary gateway is already set globally via setSelectedGateway before this function is called.
    // Fallbacks use direct fetch to avoid race conditions with concurrent verification.
    const promise = verifyAndCacheResource(identifier, verificationId, txId, path, filteredFallbacks)
      .catch(() => { /* Errors already logged */ });

    activePromises.add(promise);
    promise.finally(() => activePromises.delete(promise));
    allResults.push(promise);
  }

  // Wait for in-flight verifications to complete (they'll finish their current work)
  await Promise.allSettled(allResults);
  return false;
}

/**
 * Verify a single resource on-demand when requested by the service worker.
 * This is the core of lazy verification - resources are verified as users access them.
 *
 * SECURITY: The manifest must already be verified (status = 'manifest-verified').
 * This ensures we trust the path→txId mapping before fetching/verifying content.
 *
 * @param identifier - The ArNS name or txId being browsed
 * @param path - The resource path within the manifest
 * @returns true if verification succeeded, false if failed
 */
export async function verifyResourceOnDemand(
  identifier: string,
  path: string
): Promise<boolean> {
  const state = getManifestState(identifier);

  if (!state) {
    logger.error(TAG, `No state for on-demand verification: ${identifier}`);
    return false;
  }

  if (!isReadyToServe(identifier)) {
    logger.error(TAG, `Not ready to serve: ${identifier} (status=${state.status})`);
    return false;
  }

  // Normalize path
  let normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  if (normalizedPath === '' || normalizedPath === '/') {
    normalizedPath = state.indexPath;
  } else if (normalizedPath.endsWith('/')) {
    normalizedPath = normalizedPath + state.indexPath;
  }

  // Look up txId from the verified manifest
  let txId = state.pathToTxId.get(normalizedPath);

  if (!txId) {
    // Try fallback
    txId = state.pathToTxId.get('__fallback__');
    if (!txId) {
      logger.warn(TAG, `Path not in manifest: ${normalizedPath}`);
      return false;
    }
    // Use fallback - update normalized path for logging
    logger.debug(TAG, `Using fallback for: ${normalizedPath}`);
  }

  // Already in cache? Return immediately - no re-verification needed
  if (verifiedCache.has(txId)) {
    logger.debug(TAG, `Cache hit: ${normalizedPath} → ${txId.slice(0, 8)}...`);
    return true;
  }

  // Check if there's already a pending verification for this resource
  // This prevents duplicate concurrent verifications
  const pendingKey = `${identifier}:${normalizedPath}`;
  const existingPending = pendingOnDemandVerifications.get(pendingKey);
  if (existingPending) {
    logger.debug(TAG, `Joining existing verification: ${normalizedPath}`);
    return existingPending;
  }

  // Need to verify - this resource hasn't been accessed before
  logger.debug(TAG, `On-demand verify: ${normalizedPath} → ${txId.slice(0, 8)}...`);

  const routingGateway = state.routingGateway;
  if (!routingGateway) {
    logger.error(TAG, `No routing gateway for: ${identifier}`);
    return false;
  }

  // Create the verification promise
  const verificationPromise = doVerifyResourceOnDemand(
    identifier,
    state,
    normalizedPath,
    txId,
    routingGateway
  );

  // Store it in the pending map
  pendingOnDemandVerifications.set(pendingKey, verificationPromise);

  // Clean up when done
  verificationPromise.finally(() => {
    pendingOnDemandVerifications.delete(pendingKey);
  });

  return verificationPromise;
}

/**
 * Internal function to perform on-demand verification.
 * Separated from verifyResourceOnDemand to allow promise deduplication.
 */
async function doVerifyResourceOnDemand(
  identifier: string,
  state: ReturnType<typeof getManifestState>,
  normalizedPath: string,
  txId: string,
  routingGateway: string
): Promise<boolean> {
  if (!state) return false;

  // Broadcast that we're verifying this resource
  recordResourceVerifying(identifier, state.verificationId, normalizedPath);

  // Get fallback gateways from the wayfinder config
  const wayfinder = getWayfinder();
  const strategy = getVerificationStrategy();
  const fallbackGateways = strategy.trustedGateways
    .map(url => url.toString().replace(/\/+$/, ''))
    .filter(g => g !== routingGateway.replace(/\/+$/, ''));

  try {
    // Lock gateway for this fetch
    setSelectedGateway(routingGateway);

    // Fetch from the locked gateway via Wayfinder
    const arUrl = `ar://${txId}`;
    const response = await wayfinder.request(arUrl);
    const data = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Verify using SDK's verification strategy
    await verifyResourceWithSdk(txId, data, strategy);

    // Cache the verified content
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    verifiedCache.set(txId, { contentType, data, headers });

    // Record success for on-demand verification (updates progress counter)
    recordResourceVerifiedOnDemand(identifier, state.verificationId, txId, normalizedPath);

    logger.debug(TAG, `✓ On-demand verified: ${normalizedPath}`);
    return true;

  } catch (primaryError) {
    // Primary gateway failed, try fallbacks
    const primaryMsg = primaryError instanceof Error ? primaryError.message : String(primaryError);
    logger.warn(TAG, `Primary gateway failed for ${normalizedPath}: ${primaryMsg}, trying fallbacks...`);

    for (const gateway of fallbackGateways) {
      try {
        const rawUrl = `${gateway}/raw/${txId}`;
        const response = await fetch(rawUrl, {
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'application/octet-stream';

        // Verify using SDK
        await verifyResourceWithSdk(txId, data, strategy);

        // Cache it
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
        verifiedCache.set(txId, { contentType, data, headers });

        // Record success
        recordResourceVerifiedOnDemand(identifier, state.verificationId, txId, normalizedPath);

        logger.info(TAG, `Fallback succeeded for ${normalizedPath} via ${new URL(gateway).hostname}`);
        return true;

      } catch (fallbackError) {
        const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        logger.warn(TAG, `Fallback ${new URL(gateway).hostname} failed for ${normalizedPath}: ${fallbackMsg}`);
        // Continue to next fallback
      }
    }

    // All attempts failed
    const errorMsg = `All gateways failed to verify ${normalizedPath}`;
    logger.error(TAG, errorMsg);
    recordResourceFailedOnDemand(identifier, state.verificationId, normalizedPath, errorMsg);
    return false;

  } finally {
    setSelectedGateway(null);
  }
}

/**
 * Main entry point: verify an identifier (ArNS name or txId).
 * Returns when verification is complete.
 * Can be aborted via the optional AbortSignal.
 */
export async function verifyIdentifier(
  identifier: string,
  config: SwWayfinderConfig,
  signal?: AbortSignal
): Promise<void> {
  // Get unique verification ID to detect stale updates if user re-searches
  const verificationId = startManifestVerification(identifier);

  // Helper to check if aborted
  const checkAborted = () => {
    if (signal?.aborted) {
      throw new Error('Verification aborted');
    }
  };

  try {
    checkAborted();
    logger.info(TAG, `Verifying: ${identifier}`);

    let txId: string;

    if (isTxId(identifier)) {
      txId = identifier;
      setResolvedTxId(identifier, verificationId, txId);
      logger.info(TAG, `Direct txId: ${txId.slice(0, 8)}...`);
    } else {
      logger.info(TAG, `Resolving ArNS: ${identifier}`);
      const resolved = await resolveArnsToTxId(identifier, config.trustedGateways);
      checkAborted();
      txId = resolved.txId;
      setResolvedTxId(identifier, verificationId, txId, resolved.gateway);
      logger.info(TAG, `ArNS resolved: ${identifier} → ${txId.slice(0, 8)}...`);
    }

    const routingGateways = config.routingGateways && config.routingGateways.length > 0
      ? config.routingGateways
      : config.trustedGateways;

    // Check if user has set a preferred gateway
    const hasPreferredGateway = config.routingStrategy === 'preferred' && config.preferredGateway;

    let workingGateway: string;
    let fallbackGateways: string[];

    if (hasPreferredGateway) {
      // Use the preferred gateway directly (don't shuffle or select)
      const preferredGateway = config.preferredGateway!.trim().replace(/\/+$/, '');
      logger.debug(TAG, `Using preferred gateway: ${preferredGateway}`);

      // Still need to verify the preferred gateway is responsive
      try {
        workingGateway = await selectWorkingGateway(txId, [preferredGateway]);
        checkAborted();
      } catch {
        // Preferred gateway is not responsive, inform user
        throw new Error(`Preferred gateway ${preferredGateway} is not responding. Try a different gateway.`);
      }

      // Fallback gateways are the routing pool (in case individual resources fail)
      fallbackGateways = routingGateways.filter(g => g.replace(/\/+$/, '') !== preferredGateway);
    } else {
      // Shuffle gateways for load distribution and to avoid always hitting the same gateway on retry
      const shuffledGateways = [...routingGateways];
      for (let i = shuffledGateways.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledGateways[i], shuffledGateways[j]] = [shuffledGateways[j], shuffledGateways[i]];
      }

      // Step 1: Find a responsive gateway (lightweight HEAD request)
      workingGateway = await selectWorkingGateway(txId, shuffledGateways);
      checkAborted();
      fallbackGateways = shuffledGateways;
    }

    // Step 2: Lock in this gateway for all subsequent requests
    setSelectedGateway(workingGateway);
    logger.info(TAG, `Selected gateway: ${new URL(workingGateway).hostname}`);

    // Store the working gateway in state for later use (e.g., location patching)
    const state = getManifestState(identifier);
    if (state) {
      state.routingGateway = workingGateway;
    }

    logger.info(TAG, `Broadcasting routing-gateway event`);
    broadcastEvent({
      type: 'routing-gateway',
      identifier,
      manifestTxId: txId,
      gatewayUrl: workingGateway,
    });

    checkAborted();

    // Step 3: Fetch AND VERIFY the raw manifest/content
    // SECURITY: This fetches raw content (not resolved through manifest paths)
    // and verifies its hash using the SDK's HashVerificationStrategy.
    // This prevents a malicious routing gateway from serving a forged manifest.
    const { isManifest, manifest } = await fetchAndVerifyRawContent(
      txId,
      workingGateway
    );

    checkAborted();

    if (!isManifest) {
      // Single file - already verified and cached by fetchAndVerifyRawContent
      // We create a synthetic manifest structure to reuse the same serving code,
      // but mark it as isSingleFile so we don't try to intercept absolute paths
      const singleFileManifest: ArweaveManifest = {
        manifest: 'arweave/paths',
        version: '0.2.0',
        index: { path: 'index' },
        paths: { 'index': { id: txId } },
      };

      setManifestLoaded(identifier, verificationId, singleFileManifest, true /* isSingleFile */);
      // Record the single file as verified
      recordResourceVerified(identifier, verificationId, txId, 'index');
      // Mark as ready to serve (single file is fully verified)
      setManifestVerified(identifier, verificationId);
      return;
    }

    // Manifest case - manifest itself is now verified
    // LAZY VERIFICATION: Only verify the index file eagerly, other resources on-demand
    setManifestLoaded(identifier, verificationId, manifest!);

    // Eagerly verify the index file so first page load is instant
    const indexPath = manifest!.index?.path || 'index.html';
    const indexEntry = manifest!.paths[indexPath];
    const indexTxId = typeof indexEntry === 'string' ? indexEntry : indexEntry?.id;

    if (indexTxId) {
      // Filter out the primary gateway from fallbacks
      const filteredFallbacks = fallbackGateways.filter(g =>
        g.replace(/\/+$/, '') !== workingGateway.replace(/\/+$/, '')
      );

      // Verify index file eagerly
      if (!verifiedCache.has(indexTxId)) {
        logger.debug(TAG, `Eagerly verifying index: ${indexPath}`);
        try {
          await verifyAndCacheResource(
            identifier,
            verificationId,
            indexTxId,
            indexPath,
            filteredFallbacks
          );
        } catch (error) {
          // Index verification failed - this is critical
          const errorMsg = error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to verify index file: ${errorMsg}`);
        }
      } else {
        // Index already in cache, just record it
        recordResourceVerified(identifier, verificationId, indexTxId, indexPath);
      }
    }

    checkAborted();

    // Mark manifest as verified and ready for on-demand resource serving
    // Other resources will be verified lazily as the user accesses them
    setManifestVerified(identifier, verificationId);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // Don't fail verification for aborted - just silently stop
    if (errorMsg !== 'Verification aborted') {
      failVerification(identifier, verificationId, errorMsg);
    }
    throw error;
  } finally {
    setSelectedGateway(null);
  }
}

/**
 * Get verified content for a path.
 * Returns null if not found or not verified.
 * Works for 'complete' and 'partial' status (serves verified resources even if some failed).
 *
 * @param identifier - The ArNS name or txId
 * @param path - The resource path within the manifest
 * @param injectLocationPatch - Optional function to patch HTML content with location override
 */
export function getVerifiedContent(
  identifier: string,
  path: string,
  injectLocationPatch?: (html: string, identifier: string, gatewayUrl: string) => string
): Response | null {
  const state = getManifestState(identifier);
  // Allow serving from 'manifest-verified' (lazy mode), 'complete', or 'partial'
  if (!state || !isReadyToServe(identifier)) {
    return null;
  }

  let normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  if (normalizedPath === '') {
    normalizedPath = state.indexPath;
  } else if (normalizedPath.endsWith('/')) {
    normalizedPath = normalizedPath + state.indexPath;
  }

  const txId = state.pathToTxId.get(normalizedPath);

  if (!txId) {
    const fallbackId = state.pathToTxId.get('__fallback__');
    if (fallbackId) {
      const resource = verifiedCache.get(fallbackId);
      if (resource) {
        return verifiedCache.toResponse(resource);
      }
    }
    return null;
  }

  const resource = verifiedCache.get(txId);
  if (!resource) {
    logger.warn(TAG, `Cache miss: ${txId.slice(0, 8)}...`);
    return null;
  }

  // If this is HTML and we have a location patcher, inject the patch
  const contentType = resource.contentType.toLowerCase();
  logger.debug(TAG, `Serving ${identifier}/${normalizedPath}: contentType=${contentType}, routingGateway=${state.routingGateway || 'none'}`);

  if (injectLocationPatch && state.routingGateway) {
    if (contentType.includes('text/html')) {
      try {
        logger.debug(TAG, `Injecting location patch for ${identifier}`);
        const html = new TextDecoder().decode(resource.data);
        const patchedHtml = injectLocationPatch(html, identifier, state.routingGateway);
        const patchedData = new TextEncoder().encode(patchedHtml);

        // Create response with patched content
        const headers = new Headers();
        Object.entries(resource.headers).forEach(([key, value]) => {
          headers.set(key, value);
        });
        if (!headers.has('content-type')) {
          headers.set('content-type', resource.contentType);
        }
        headers.set('x-wayfinder-verified', 'true');
        headers.set('x-wayfinder-verified-at', resource.verifiedAt.toString());
        headers.set('x-wayfinder-location-patched', 'true');

        return new Response(patchedData, {
          status: 200,
          headers,
        });
      } catch (e) {
        logger.warn(TAG, `Failed to patch HTML: ${e}`);
        // Fall through to return unpatched response
      }
    }
  }

  return verifiedCache.toResponse(resource);
}
