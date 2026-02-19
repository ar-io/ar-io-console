import { useState, useEffect, useCallback } from 'react';
import { swMessenger } from '../utils/serviceWorkerMessaging';
import { getTrustedGateways, getRoutingGateways } from '../utils/trustedGateways';
import { useBrowseConfig } from './useBrowseConfig';

interface UseBrowseServiceWorkerResult {
  isReady: boolean;
  isRegistering: boolean;
  error: Error | null;
  reinitialize: () => Promise<void>;
}

/**
 * Hook for managing the browse service worker registration and initialization.
 * Handles SW registration, Wayfinder initialization, and cleanup.
 */
export function useBrowseServiceWorker(): UseBrowseServiceWorkerResult {
  const { config } = useBrowseConfig();
  const [isReady, setIsReady] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const initializeServiceWorker = useCallback(async () => {
    if (!config.verificationEnabled) {
      setIsReady(false);
      return;
    }

    setIsRegistering(true);
    setError(null);

    try {
      // Check if SW is already controlling
      if (!swMessenger.isControlling()) {
        // Wait a moment for proactive registration to complete
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!swMessenger.isControlling()) {
          // SW not ready yet - this is recoverable
          setIsReady(false);
          setIsRegistering(false);
          return;
        }
      }

      // Get trusted gateways (top-staked, for hash verification)
      const trustedGateways = await getTrustedGateways(config.trustedGatewayCount);

      // Get routing gateways (broader pool, for content fetching)
      const routingGateways = await getRoutingGateways();

      // Initialize Wayfinder in service worker
      await swMessenger.initializeWayfinder({
        trustedGateways: trustedGateways.map(gw => gw.url),
        routingGateways: routingGateways.map(u => u.toString()),
        routingStrategy: config.routingStrategy,
        preferredGateway: config.preferredGateway,
        enabled: true,
        strict: config.strictVerification,
        concurrency: config.verificationConcurrency,
        verificationMethod: config.verificationMethod,
      });

      setIsReady(true);
    } catch (err) {
      console.error('[Browse] Service worker initialization failed:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsReady(false);
    } finally {
      setIsRegistering(false);
    }
  }, [
    config.verificationEnabled,
    config.routingStrategy,
    config.preferredGateway,
    config.strictVerification,
    config.verificationConcurrency,
    config.verificationMethod,
    config.trustedGatewayCount,
  ]);

  // Initialize on mount and when config changes
  useEffect(() => {
    initializeServiceWorker();
  }, [initializeServiceWorker]);

  return {
    isReady,
    isRegistering,
    error,
    reinitialize: initializeServiceWorker,
  };
}
