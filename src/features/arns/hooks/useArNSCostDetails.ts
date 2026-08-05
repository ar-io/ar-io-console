import { useQuery } from '@tanstack/react-query';
import type { CostDetailsResult } from '@ar.io/sdk/solana';

import { getARIO } from '../../../utils';
import { useArNSConfigKey } from './useArNSConfigKey';
import { lowerCaseDomain } from '../utils';

/** ArNS intents that carry a cost. */
export type ArNSCostIntent =
  | 'Buy-Name'
  | 'Extend-Lease'
  | 'Increase-Undername-Limit'
  | 'Upgrade-Name';

/**
 * Funding source for the name's ARIO price.
 *  - 'turbo'   → Turbo Credits (credits balance covers the mARIO price)
 *  - 'balance' → wallet's liquid ARIO
 *  - 'stakes'  → active delegations only (SDK funding-planner)
 *  - 'any'     → liquid + delegations + vaults (SDK funding-planner)
 */
export type ArNSFundFrom = 'turbo' | 'balance' | 'stakes' | 'any';

const M_ARIO_PER_ARIO = 1e6; // mARIO has 6 decimals
const LAMPORTS_PER_SOL = 1e9;

export interface ArNSCostDetails {
  /** Protocol name price in ARIO (tokenCost / 1e6). */
  arioCost: number;
  /** Raw protocol price in mARIO. */
  mARIO: number;
  /** Total operator/discount applied, in ARIO. */
  discountArio: number;
  /**
   * mARIO the chosen funding source can't cover. > 0 ⇒ insufficient ARIO for
   * this source. Always 0 for 'turbo' (credits are gated separately).
   */
  shortfallMARIO: number;
  /** SOL the wallet must hold for this action (rent + fees). Same for all sources. */
  gasTotalSol: number;
  /** Rent-exempt deposit portion (SOL) — dominates; partly reclaimable. */
  gasRentSol: number;
  /** Transaction-fee portion (SOL). */
  gasFeeSol: number;
}

/**
 * Structural view of the readable ARIO client's getCostDetails. The return type
 * is the SDK's published `CostDetailsResult` (not a hand-rolled all-optional
 * shape) so any drift in `tokenCost`, `fundingPlan.shortfall`, or the
 * `gasEstimate.*Lamports` fields surfaces as a compile error here instead of
 * silently casting to 0 and letting the affordability gate pass.
 */
type ARIOCostReadable = {
  getCostDetails(params: {
    intent: ArNSCostIntent;
    name: string;
    type?: 'lease' | 'permabuy';
    years?: number;
    quantity?: number;
    fundFrom?: ArNSFundFrom;
    fromAddress?: string;
  }): Promise<CostDetailsResult>;
};

/**
 * Live cost + affordability + SOL-gas for an ArNS action, via the ARIO
 * contract's `getCostDetails`. One call yields the ARIO price, the
 * funding-plan shortfall for the chosen source (the native affordability
 * gate), and the SOL the wallet must hold for rent/fees (identical across
 * funding sources — even a Turbo-Credits buy pays this SOL rent from the
 * user's wallet). Keyed by `fundFrom` so switching payment source re-fetches.
 *
 * For the credits price display keep using `useArNSPrice` (winc) — this hook's
 * `tokenCost` is the ARIO-denominated protocol price used by the native path.
 */
export function useArNSCostDetails({
  intent,
  name,
  type,
  years,
  increaseQty,
  fundFrom,
  fromAddress,
  refreshTick,
  enabled = true,
}: {
  intent: ArNSCostIntent;
  name: string;
  type?: 'lease' | 'permabuy';
  years?: number;
  increaseQty?: number;
  fundFrom: ArNSFundFrom;
  /** Wallet address whose ARIO balance the funding plan is checked against. */
  fromAddress?: string;
  /**
   * Optional coarse cache-busting token folded into the query key. For
   * time-priced intents (a returned-name Dutch auction, whose premium decays
   * every second) callers pass a value that changes on a slow cadence (e.g.
   * every ~20s) so the quote re-prices periodically instead of staying frozen
   * for the full 60s staleTime while the displayed premium keeps falling. Omit
   * for fixed-price intents — the key then stays stable and nothing re-fetches.
   */
  refreshTick?: number | string;
  enabled?: boolean;
}) {
  const configKey = useArNSConfigKey();
  const normalized = lowerCaseDomain(name);
  const active = enabled && normalized.length > 0;

  return useQuery<ArNSCostDetails>({
    queryKey: [
      'arns-cost-details',
      intent,
      normalized,
      type ?? '',
      intent === 'Extend-Lease' || type === 'lease' ? years : 'permabuy',
      increaseQty ?? '',
      fundFrom,
      fromAddress ?? '',
      refreshTick ?? '',
      configKey,
    ],
    enabled: active,
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const ario = getARIO() as unknown as ARIOCostReadable;
      // 'turbo' is a UI-only funding source (pay with Turbo Credits). The SDK's
      // funding planner only accepts balance|stakes|any, so map it to 'balance'
      // for the SOL-gas/price estimate; the wallet-ARIO shortfall it computes is
      // irrelevant on the credits path and is zeroed out below.
      const payWithCredits = fundFrom === 'turbo';
      const sdkFundFrom = payWithCredits ? 'balance' : fundFrom;
      const cd = await ario.getCostDetails({
        intent,
        name: normalized,
        ...(type ? { type } : {}),
        ...((intent === 'Extend-Lease' || type === 'lease') && years ? { years } : {}),
        ...(intent === 'Increase-Undername-Limit' && increaseQty
          ? { quantity: increaseQty }
          : {}),
        fundFrom: sdkFundFrom,
        ...(fromAddress ? { fromAddress } : {}),
      });

      const mARIO = cd.tokenCost ?? 0;
      const discountMARIO = (cd.discounts ?? []).reduce(
        (sum, d) => sum + (d.discountTotal ?? 0),
        0,
      );
      const gas = cd.gasEstimate;
      return {
        arioCost: mARIO / M_ARIO_PER_ARIO,
        mARIO,
        discountArio: discountMARIO / M_ARIO_PER_ARIO,
        // On the credits path the wallet-ARIO shortfall never gates the buy
        // (credits pay the ARIO), so don't surface the SDK's balance shortfall.
        shortfallMARIO: payWithCredits ? 0 : (cd.fundingPlan?.shortfall ?? 0),
        gasTotalSol: (gas?.totalLamports ?? 0) / LAMPORTS_PER_SOL,
        gasRentSol: (gas?.rentLamports ?? 0) / LAMPORTS_PER_SOL,
        gasFeeSol: (gas?.feeLamports ?? 0) / LAMPORTS_PER_SOL,
      };
    },
  });
}
