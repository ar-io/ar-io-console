import { useMemo } from 'react';
import { useStore } from '../store/useStore';

/**
 * The Turbo config for a token, from an already-read app config. Split out of
 * the hook so code that needs several tokens' configs in one render (the
 * payment picker's per-token quotes) builds exactly what the hook would.
 */
export const turboConfigFor = (
  config: ReturnType<ReturnType<typeof useStore.getState>['getCurrentConfig']>,
  tokenType?: string,
): any => {
  const baseConfig = {
    paymentServiceConfig: { url: config.paymentServiceUrl },
    uploadServiceConfig: { url: config.uploadServiceUrl },
  };

  // If token type is provided and has a custom RPC, pass it as gatewayUrl
  if (tokenType && config.tokenMap[tokenType as keyof typeof config.tokenMap]) {
    return {
      ...baseConfig,
      gatewayUrl: config.tokenMap[tokenType as keyof typeof config.tokenMap],
    };
  }

  return baseConfig;
};

export const useTurboConfig = (tokenType?: string): any => {
  const getCurrentConfig = useStore((state) => state.getCurrentConfig);

  return useMemo(
    () => turboConfigFor(getCurrentConfig(), tokenType),
    [getCurrentConfig, tokenType],
  );
};
