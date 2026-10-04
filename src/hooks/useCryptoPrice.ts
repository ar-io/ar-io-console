import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';

import { usdPerArioFromLegs } from '../features/arns/priceRate';
import { TurboFactory, USD } from '@ardrive/turbo-sdk/web';
import { SupportedTokenType } from '../constants';
import { turboConfigFor, useTurboConfig } from './useTurboConfig';
import { useStore } from '../store/useStore';

/**
 * Get the smallest unit for a token type (e.g., 10^18 wei for ETH)
 */
/** Smallest unit per whole token (lamports per SOL, wei per ETH, …). */
export const getTokenSmallestUnit = (tokenType: SupportedTokenType): bigint => {
  switch (tokenType) {
    case 'arweave':
      return BigInt(10 ** 12); // winston
    case 'ario':
    case 'base-ario':
      return BigInt(10 ** 6); // mARIO - 1 ARIO = 1,000,000 mARIO (same for AO and Base)
    case 'ethereum':
    case 'base-eth':
      return BigInt(10 ** 18); // wei
    case 'solana':
      return BigInt(10 ** 9); // lamports
    case 'pol':
      return BigInt(10 ** 18); // wei equivalent
    case 'kyve':
      return BigInt(10 ** 6); // ukyve
    case 'usdc':
    case 'base-usdc':
    case 'polygon-usdc':
    case 'solana-usdc':
      return BigInt(10 ** 6); // USDC uses 6 decimals on every chain it is issued on
    default:
      return BigInt(10 ** 12); // default
  }
};

/**
 * Hook to convert winc amount to crypto token amount
 * Uses React Query for caching to avoid excessive API calls
 *
 * @param wincAmount - Amount in winc (smallest unit)
 * @param tokenType - Crypto token to convert to
 * @returns Token amount in display units (e.g., ETH not wei) or undefined if not loaded
 */
export function useCryptoPriceForWinc(
  wincAmount: number | undefined,
  tokenType: SupportedTokenType,
  /**
   * Round the token amount UP to the next smallest unit.
   *
   * The conversion below is integer division, which truncates — so an exact
   * "how much SOL buys N credits" answer lands just BELOW N. Fine for a display
   * estimate, not fine when the number is what we actually charge: the top-up
   * then buys slightly too few credits and the purchase it was funding fails
   * for want of a fraction, after taking the user's money.
   */
  roundUp = false,
): number | undefined {
  const turboConfig = useTurboConfig(tokenType);

  const { data: tokenAmount } = useQuery({
    queryKey: ['cryptoPriceForWinc', wincAmount, tokenType, roundUp, turboConfig.paymentServiceConfig.url],
    queryFn: async () => {
      if (!wincAmount || wincAmount <= 0) return undefined;

      const turbo = TurboFactory.unauthenticated({
        ...turboConfig,
        token: tokenType as any,
      });

      // Get the exchange rate by checking cost of 1 full token
      const oneToken = getTokenSmallestUnit(tokenType);
      const { winc: wincForOneToken } = await turbo.getWincForToken({
        tokenAmount: oneToken,
      });

      // Convert winc to BigInt (API returns string)
      const wincForOneTokenBigInt = BigInt(wincForOneToken);

      // Calculate token amount: (wincAmount / wincForOneToken) * oneToken
      // Then convert to display units by dividing by smallest unit
      const numerator = BigInt(Math.round(wincAmount)) * oneToken;
      let tokenInSmallestUnit = numerator / wincForOneTokenBigInt;
      if (roundUp && numerator % wincForOneTokenBigInt !== 0n) {
        tokenInSmallestUnit += 1n;
      }

      // Convert to display units (e.g., wei to ETH)
      return Number(tokenInSmallestUnit) / Number(oneToken);
    },
    enabled: !!wincAmount && wincAmount > 0,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 2, // Retry failed requests twice
  });

  return tokenAmount;
}

/**
 * Token amount for a given winc, in the token's SMALLEST unit.
 *
 * `useCryptoPriceForWinc` returns display units (whole SOL, whole ETH), which
 * is right for showing a price and wrong for spending one: `topUpWithTokens`
 * documents `tokenAmount` as "the smallest unit value" and rejects a decimal —
 * "0.019876422 cannot be converted to a BigInt because it is not an integer".
 *
 * Returned as a bigint straight from the integer arithmetic rather than scaling
 * the display figure back up, because that round-trip goes through a float:
 * harmless at SOL's 1e9, lossy at ETH's 1e18.
 *
 * Rounds UP for the same reason the display quote does — a unit over is
 * invisible, a unit short is a purchase that fails after taking the money.
 */
export function useSmallestUnitForWinc(
  wincAmount: number | undefined,
  tokenType: SupportedTokenType,
): bigint | undefined {
  const turboConfig = useTurboConfig(tokenType);
  const { data } = useQuery(smallestUnitForWincQuery(wincAmount, tokenType, turboConfig));

  // Serialized as a string through the query cache — bigint isn't JSON-safe.
  return data == null ? undefined : BigInt(data);
}

/**
 * The query behind `useSmallestUnitForWinc`, shared so the multi-token hook
 * below reads and fills the SAME cache entries. The price a picker row shows
 * for SOL is then the very figure the purchase charges when SOL is chosen, not
 * a second quote that could disagree with it.
 */
function smallestUnitForWincQuery(
  wincAmount: number | undefined,
  tokenType: SupportedTokenType,
  turboConfig: any,
) {
  return {
    queryKey: [
      'smallestUnitForWinc',
      wincAmount,
      tokenType,
      turboConfig.paymentServiceConfig.url,
    ],
    queryFn: async () => {
      if (!wincAmount || wincAmount <= 0) return null;
      const turbo = TurboFactory.unauthenticated({
        ...turboConfig,
        token: tokenType as any,
      });
      const oneToken = getTokenSmallestUnit(tokenType);
      const { winc: wincForOneToken } = await turbo.getWincForToken({
        tokenAmount: oneToken,
      });
      const wincPerToken = BigInt(wincForOneToken);
      if (wincPerToken <= 0n) return null;
      const numerator = BigInt(Math.round(wincAmount)) * oneToken;
      const floor = numerator / wincPerToken;
      return (numerator % wincPerToken === 0n ? floor : floor + 1n).toString();
    },
    enabled: !!wincAmount && wincAmount > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  };
}

/**
 * `useSmallestUnitForWinc` for several tokens at once, in WHOLE tokens.
 *
 * For the payment picker, which states each token's price in its own row. A
 * hook per token would break the rules of hooks as the token list changes with
 * the session, so this runs one query per token through `useQueries`. Tokens
 * whose quote has not landed (or failed) are simply absent: an unquoted row
 * reads as affordable, never as short.
 */
export function useTokenPricesForWinc(
  wincAmount: number | undefined,
  tokens: readonly SupportedTokenType[],
): Partial<Record<SupportedTokenType, number>> {
  const getCurrentConfig = useStore((s) => s.getCurrentConfig);
  const config = getCurrentConfig();
  const results = useQueries({
    queries: tokens.map((token) =>
      smallestUnitForWincQuery(wincAmount, token, turboConfigFor(config, token)),
    ),
  });
  /*
    Stable while the quotes are. `useQueries` returns a fresh array every
    render, and a fresh object here would re-run every memo and effect that
    reads it (the checkout's rows and its one-time preselection) on every
    render for nothing.
  */
  const signature = results
    .map((r, i) => `${tokens[i]}=${r.data ?? ''}`)
    .join('|');
  return useMemo(() => {
    const prices: Partial<Record<SupportedTokenType, number>> = {};
    for (const entry of signature ? signature.split('|') : []) {
      const [token, data] = entry.split('=') as [SupportedTokenType, string];
      if (!data) continue;
      prices[token] = Number(BigInt(data)) / Number(getTokenSmallestUnit(token));
    }
    return prices;
  }, [signature]);
}

/**
 * Hook to convert crypto token amount to winc
 * Uses React Query for caching to avoid excessive API calls
 *
 * @param tokenAmount - Amount of crypto token (in smallest unit, e.g., wei for ETH)
 * @param tokenType - Crypto token to convert from
 * @returns Winc amount or undefined if not loaded
 */
export function useWincForCrypto(
  tokenAmount: bigint | undefined,
  tokenType: SupportedTokenType
): number | undefined {
  const turboConfig = useTurboConfig(tokenType);

  const { data: wincAmount } = useQuery({
    queryKey: ['wincForCrypto', tokenAmount?.toString(), tokenType, turboConfig.paymentServiceConfig.url],
    queryFn: async () => {
      if (!tokenAmount || tokenAmount <= 0n) return undefined;

      const turbo = TurboFactory.unauthenticated({
        ...turboConfig,
        token: tokenType as any,
      });

      const result = await turbo.getWincForToken({
        tokenAmount,
      });

      return Number(result.winc);
    },
    enabled: !!tokenAmount && tokenAmount > 0n,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 2, // Retry failed requests twice
  });

  return wincAmount;
}

/**
 * USD value of 1 ARIO, derived at runtime from Turbo's own rates — the same
 * primitives the credit-pricing flows already trust (`getWincForToken` /
 * `getWincForFiat`). Because winc is the common denominator, it cancels out:
 *
 *   usdPerArio = wincForOneArio / wincForOneUsd
 *
 * This keeps the toggle's USD consistent with what the user actually pays via
 * Turbo (no hardcoded rate, no separate CoinGecko call). Returns `undefined`
 * while loading or when either denominator is zero/non-finite, so display code
 * degrades to ARIO-only rather than showing a broken value.
 */
export function useArioUsdRate(
  /** Off where the payment service is (x402-only mode): there is nothing to ask. */
  enabled = true,
): number | undefined {
  const turboConfig = useTurboConfig('ario');

  const { data } = useQuery({
    // Key on the ARIO gateway too: it can change independently of the
    // payment-service URL, and a stale cached rate would otherwise survive it.
    queryKey: [
      'arioUsdRate',
      turboConfig.paymentServiceConfig.url,
      turboConfig.gatewayUrl,
    ],
    queryFn: async () => {
      const turbo = TurboFactory.unauthenticated({
        ...turboConfig,
        token: 'ario' as any,
      });

      // 1 ARIO = 1,000,000 mARIO (smallest unit).
      const oneArio = BigInt(10 ** 6);
      const [arioQuote, usdQuote] = await Promise.all([
        turbo.getWincForToken({ tokenAmount: oneArio }),
        turbo.getWincForFiat({ amount: USD(1), promoCodes: [] }),
      ]);

      const wincPerArio = Number(arioQuote.winc);
      const wincPerUsd = Number(usdQuote.winc);
      /*
        The two legs are NOT quoted on the same footing: each comes back net of
        its own currency's infrastructure fee — 35% on USD, 25% on ARIO — so a
        raw ratio keeps the difference instead of cancelling it. Each leg's own
        `fees` are passed so both are scaled back to fee-free. Passing only the
        USD fees was correct while ARIO was fee-free, and read a quarter low
        once it was not.
      */
      const rate = usdPerArioFromLegs({
        wincPerArio,
        wincPerUsd,
        usdFees: usdQuote.fees,
        arioFees: arioQuote.fees,
      });
      // TanStack Query v5 forbids a queryFn resolving `undefined`.
      return rate ?? null;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 2, // Retry failed requests twice
  });

  return data ?? undefined;
}
