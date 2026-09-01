import { useQuery } from '@tanstack/react-query';
import type { ArNSAction } from '@ardrive/turbo-sdk/web';

import { useArNSConfigKey } from './useArNSConfigKey';
import { useTurboArNSClient } from './useTurboArNSClient';
import { wincToCredits } from '../utils';

/**
 * What one non-purchase action costs this wallet, in credits.
 *
 * Fetched, never assumed. The prices differ per environment — removing a
 * record is free on testnet and 0.05 credits on production — so a hardcoded
 * figure would be right in development and wrong in front of real users, which
 * is the worst way to be wrong about money.
 *
 * Keyed by config so switching environments refetches rather than showing the
 * other network's price.
 */
export function useArNSActionPrice(action: ArNSAction | undefined) {
  const client = useTurboArNSClient();
  const configKey = useArNSConfigKey();

  const { data, isFetching, error } = useQuery({
    queryKey: ['arns-action-price', configKey, action],
    enabled: !!action && !!client,
    // A margin, not a market rate — it moves rarely.
    staleTime: 10 * 60_000,
    retry: 1,
    queryFn: async () => {
      const res = await client!.getArNSActionPrice(action!);
      return wincToCredits(res.wincQty);
    },
  });

  return {
    /** Cost in credits, or undefined while loading or if the lookup failed. */
    credits: data,
    isLoading: isFetching,
    /**
     * True when the price is known to be zero — some actions are free on some
     * networks. Distinct from "not loaded yet", which must never render as free.
     */
    isFree: data === 0,
    error: error instanceof Error ? error : undefined,
  };
}
