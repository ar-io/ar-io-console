import { useQuery } from '@tanstack/react-query';

import { useArNSConfigKey } from './useArNSConfigKey';
import { useCreditsForFiat } from '../../../hooks/useCreditsForFiat';
import { useTurboArNSClient } from './useTurboArNSClient';
import type { TurboArNSIntent } from '../services/TurboArNSClient';
import { lowerCaseDomain, wincToCredits } from '../utils';

export type ArNSRegistrationType = 'lease' | 'permabuy';

export type ArNSPriceResult = {
  /** Raw winc cost (bundler-authoritative — this is what settles). */
  winc: string;
  /** Cost in Turbo Credits (winc / 1e12). */
  credits: number;
  /** Cost in mARIO (registry units). */
  mARIO: string;
  /** Best-effort USD estimate, from the bundler fiat estimate or the rate. */
  usd: number | undefined;
};

/**
 * Live ArNS Buy-Name price for the given name/type/years, from the bundler's
 * `/v1/arns/price` endpoint (authoritative winc — the exact amount that will be
 * debited). USD is taken from the bundler's fiat estimate when present, else
 * derived from console's existing credits-per-USD rate so the display matches
 * the rest of the app.
 */
export function useArNSPrice({
  name,
  type,
  years,
  intent = 'Buy-Name',
  increaseQty,
  enabled = true,
}: {
  name: string;
  /** Required for Buy-Name; unused by Extend/Upgrade/Increase intents. */
  type?: ArNSRegistrationType;
  /** Lease term for Buy-Name (lease) and Extend-Lease. */
  years?: number;
  /** Which ArNS intent to price. Defaults to Buy-Name (registration). */
  intent?: TurboArNSIntent;
  /** Undername slots to add — only for Increase-Undername-Limit. */
  increaseQty?: number;
  enabled?: boolean;
}) {
  const client = useTurboArNSClient();
  const configKey = useArNSConfigKey();
  const [creditsPerUSD] = useCreditsForFiat(1, () => {});

  const normalized = lowerCaseDomain(name);
  const active = enabled && normalized.length > 0;

  return useQuery<ArNSPriceResult>({
    queryKey: [
      'arns-price',
      intent,
      normalized,
      type ?? '',
      type === 'lease' || intent === 'Extend-Lease' ? years : 'permabuy',
      increaseQty ?? '',
      configKey,
    ],
    enabled: active,
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const price = await client.getArNSPrice({
        name: normalized,
        intent,
        type,
        years,
        increaseQty,
      });
      const credits = wincToCredits(price.winc);
      const fiatUsd = price.fiatEstimate?.paymentAmount;
      const usd =
        typeof fiatUsd === 'number' && fiatUsd > 0
          ? fiatUsd
          : creditsPerUSD
            ? credits / creditsPerUSD
            : undefined;
      return { winc: price.winc, credits, mARIO: price.mARIO, usd };
    },
  });
}
