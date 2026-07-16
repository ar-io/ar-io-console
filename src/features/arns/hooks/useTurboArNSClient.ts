import { useMemo } from 'react';

import { useStore } from '../../../store/useStore';
import { TurboArNSClient } from '../services/TurboArNSClient';

/**
 * Build a {@link TurboArNSClient} bound to the active console config
 * (payment/upload/gateway URLs), rebuilt when the config mode changes. This is
 * the single construction point for the ArNS service across the feature.
 */
export function useTurboArNSClient(): TurboArNSClient {
  const getCurrentConfig = useStore((s) => s.getCurrentConfig);
  const configMode = useStore((s) => s.configMode);

  return useMemo(() => {
    const config = getCurrentConfig();
    return new TurboArNSClient({
      paymentUrl: config.paymentServiceUrl,
      uploadUrl: config.uploadServiceUrl,
      gatewayUrl: config.arioGatewayUrl,
    });
    // configMode drives getCurrentConfig()'s result; rebuild on change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getCurrentConfig, configMode]);
}
