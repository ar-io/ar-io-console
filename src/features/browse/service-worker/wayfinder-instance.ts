/**
 * Wayfinder client instance for service worker.
 *
 * Creates and manages the Wayfinder client for routing and verification.
 * Supports both HashVerificationStrategy and SignatureVerificationStrategy
 * based on user configuration.
 */

import {
  createWayfinderClient,
  createRoutingStrategy,
  StaticRoutingStrategy,
  HashVerificationStrategy,
  SignatureVerificationStrategy,
} from '@ar.io/wayfinder-core';
import type { Wayfinder, VerificationStrategy } from '@ar.io/wayfinder-core';
import type { SwWayfinderConfig } from './types';
import { logger } from './logger';

const TAG = 'Wayfinder';

let wayfinderInstance: Wayfinder | null = null;
let currentConfig: SwWayfinderConfig | null = null;
let verificationStrategy: VerificationStrategy | null = null;

// Selected gateway for current manifest verification
// When set, all resource fetches use this gateway instead of random selection
let selectedGateway: URL | null = null;

// Promise that resolves when Wayfinder is initialized
// Used by fetch handler to wait for initialization instead of returning 503
let initializationResolve: (() => void) | null = null;
let initializationPromise: Promise<void> | null = null;

/**
 * Wait for Wayfinder to be initialized.
 * Returns immediately if already initialized, otherwise waits up to maxWaitMs.
 *
 * @param maxWaitMs Maximum time to wait in milliseconds (default 10 seconds)
 * @returns true if initialized, false if timed out
 */
export async function waitForInitialization(maxWaitMs = 10000): Promise<boolean> {
  // Already initialized
  if (wayfinderInstance !== null) {
    return true;
  }

  // Create the promise if it doesn't exist
  if (!initializationPromise) {
    initializationPromise = new Promise<void>((resolve) => {
      initializationResolve = resolve;
    });
  }

  // Race between initialization and timeout
  const timeoutPromise = new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(false), maxWaitMs);
  });

  const initPromise = initializationPromise.then(() => true);

  const result = await Promise.race([initPromise, timeoutPromise]);

  return result;
}

/**
 * Set a specific gateway for all subsequent resource fetches.
 * Used to ensure all resources in a manifest come from the same gateway.
 */
export function setSelectedGateway(gateway: string | null): void {
  selectedGateway = gateway ? new URL(gateway) : null;
  logger.debug(TAG, `Gateway: ${selectedGateway?.hostname || 'random'}`);
}

/**
 * Get the currently selected gateway.
 */
export function getSelectedGateway(): string | null {
  return selectedGateway?.toString() || null;
}

// Quiet logger for Wayfinder core - suppresses debug/info logs to reduce noise
const quietWayfinderLogger = {
  debug: () => {}, // Suppress debug logs
  info: () => {},  // Suppress info logs
  warn: console.warn,
  error: console.error,
};

/**
 * Initialize the Wayfinder client with the given configuration.
 */
export function initializeWayfinder(config: SwWayfinderConfig): void {
  const verificationMethod = config.verificationMethod || 'hash';

  logger.info(TAG, `Init: ${verificationMethod}, ${config.trustedGateways.length} verification gateways`);

  currentConfig = config;

  // ROUTING gateways: Broader pool for load distribution
  // Verification gateways are handled separately by manifest-verifier.ts
  const routingGateways = config.routingGateways && config.routingGateways.length > 0
    ? config.routingGateways.map(url => new URL(url))
    : config.trustedGateways.map(url => new URL(url));
  logger.debug(TAG, `Routing gateways: ${routingGateways.length}`);

  // Create gateways provider for routing
  const gatewaysProvider = {
    async getGateways() {
      // If a specific gateway is selected (for manifest consistency), use only that
      if (selectedGateway) {
        return [selectedGateway];
      }

      // Otherwise shuffle for load distribution
      const shuffled = [...routingGateways];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    },
  };

  // Create routing strategy
  // Handle 'preferred' strategy separately using StaticRoutingStrategy
  let routingStrategy;
  if (config.routingStrategy === 'preferred' && config.preferredGateway) {
    const preferredGateway = config.preferredGateway.trim() || 'https://turbo-gateway.com';
    logger.debug(TAG, `Using preferred gateway: ${preferredGateway}`);
    routingStrategy = new StaticRoutingStrategy({
      gateway: preferredGateway,
      logger: quietWayfinderLogger,
    });
  } else {
    // Map 'roundRobin' to 'balanced' for createRoutingStrategy
    const strategyName = config.routingStrategy === 'roundRobin' ? 'balanced' : config.routingStrategy;
    routingStrategy = createRoutingStrategy({
      strategy: strategyName as 'random' | 'fastest' | 'balanced',
      gatewaysProvider,
      logger: quietWayfinderLogger,
    });
  }

  // Create verification strategy based on config
  const trustedGatewayUrls = config.trustedGateways.map(url => new URL(url));

  if (verificationMethod === 'signature') {
    // Signature verification - cryptographically verifies data item signatures
    verificationStrategy = new SignatureVerificationStrategy({
      trustedGateways: trustedGatewayUrls,
      maxConcurrency: 3,
      logger: quietWayfinderLogger,
    });
    logger.debug(TAG, `Verification strategy: SignatureVerificationStrategy with ${trustedGatewayUrls.length} trusted gateways`);
  } else {
    // Hash verification (default) - verifies content hash against trusted gateways
    verificationStrategy = new HashVerificationStrategy({
      trustedGateways: trustedGatewayUrls,
      maxConcurrency: 3,
      logger: quietWayfinderLogger,
    });
    logger.debug(TAG, `Verification strategy: HashVerificationStrategy with ${trustedGatewayUrls.length} trusted gateways`);
  }

  // Create Wayfinder client with SDK verification enabled
  // Note: We still handle our own verification orchestration in manifest-verifier.ts
  // but now delegate the actual hash verification to the SDK's strategy
  wayfinderInstance = createWayfinderClient({
    logger: quietWayfinderLogger,
    routingSettings: {
      strategy: routingStrategy,
    },
    // Verification is handled by manifest-verifier.ts using getVerificationStrategy()
    // We disable it here to avoid double-verification when using wayfinder.request()
    verificationSettings: { enabled: false },
    telemetrySettings: {
      enabled: false,
    },
  });

  // Resolve any pending initialization waiters
  if (initializationResolve) {
    initializationResolve();
    initializationResolve = null;
    initializationPromise = null;
  }

  logger.info(TAG, `Ready: verification=${config.enabled ? verificationMethod : 'disabled'}, strict=${config.strict}`);
}

/**
 * Get the Wayfinder client instance.
 * Throws if not initialized.
 */
export function getWayfinder(): Wayfinder {
  if (!wayfinderInstance) {
    throw new Error('Wayfinder not initialized');
  }
  return wayfinderInstance;
}

/**
 * Check if Wayfinder is ready.
 */
export function isWayfinderReady(): boolean {
  return wayfinderInstance !== null;
}

/**
 * Get the current configuration.
 */
export function getConfig(): SwWayfinderConfig | null {
  return currentConfig;
}

/**
 * Get the verification strategy instance.
 * Returns either HashVerificationStrategy or SignatureVerificationStrategy
 * based on config.verificationMethod.
 * Throws if not initialized.
 */
export function getVerificationStrategy(): VerificationStrategy {
  if (!verificationStrategy) {
    throw new Error('Verification strategy not initialized');
  }
  return verificationStrategy;
}
