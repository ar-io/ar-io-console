import { useQuery } from '@tanstack/react-query';
import type { FundFrom, Intent } from '@ar.io/sdk/solana';

import { getARIO } from '../../../utils';
import { useArNSConfigKey } from './useArNSConfigKey';
import { lowerCaseDomain } from '../utils';

/** ArNS intents that carry a cost. */
export type ArNSCostIntent = Extract<
  Intent,
  'Buy-Name' | 'Extend-Lease' | 'Increase-Undername-Limit' | 'Upgrade-Name'
>;

/**
 * Funding source for the name's ARIO price. Re-exports the SDK's `FundFrom`
 * union; 'turbo' is mapped to 'balance' before calling getCostDetails (the SDK
 * doesn't handle 'turbo' for gas estimates).
 */
export type ArNSFundFrom = FundFrom;

const M_ARIO_PER_ARIO = 1e6; // mARIO has 6 decimals
const LAMPORTS_PER_SOL = 1e9;

export interface ArNSCostDetails {
  /** Protocol name price in ARIO (tokenCost / 1e6). */
  arioCost: number;
  /** Raw protocol price in mARIO. */
  mARIO: number;
  /** Total operator/discount applied, in ARIO. `arioCost` is already net of it. */
  discountArio: number;
  /**
   * The gateway this quote claimed the operator discount through, when one
   * was named and the quote honoured it. Writes pass exactly this, so a
   * purchase names a gateway only if the quote just accepted it.
   */
  discountGatewayAddress?: string;
  /**
   * mARIO the chosen funding source can't cover. > 0 ⇒ insufficient ARIO for
   * this source. Always 0 for 'turbo' (credits are gated separately).
   */
  shortfallMARIO: number;
  /** SOL the wallet must hold for this action (rent + fees). Same for all sources. */
  gasTotalSol: number;
  /**
   * Solana account rent (SOL); dominates. Not refunded to the buyer: on lease
   * expiry it goes to whoever prunes the record, on release to the releasing
   * owner (ar-io-solana-contracts prune.rs / manage.rs).
   */
  gasRentSol: number;
  /** Transaction-fee portion (SOL). */
  gasFeeSol: number;
}

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
  payWithCredits = false,
  fromAddress,
  refreshTick,
  discountGatewayAddress,
  enabled = true,
}: {
  intent: ArNSCostIntent;
  name: string;
  type?: 'lease' | 'permabuy';
  years?: number;
  increaseQty?: number;
  fundFrom: ArNSFundFrom;
  /**
   * The name is paid for with Turbo credits, so the wallet's ARIO shortfall is
   * irrelevant and the estimate should price gas only.
   */
  payWithCredits?: boolean;
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
  /**
   * Gateway (its operator's address) to claim the operator discount through,
   * for an operations wallet (`useOperatorDiscountGateway`). Omit otherwise:
   * the SDK tries the signer's own gateway by itself.
   */
  discountGatewayAddress?: string;
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
      discountGatewayAddress ?? '',
      configKey,
    ],
    enabled: active,
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const ario = getARIO();
      // 'turbo' is a UI-only funding source (pay with Turbo Credits). The SDK's
      // funding planner only accepts balance|stakes|any, so map it to 'balance'
      // for the SOL-gas/price estimate; the wallet-ARIO shortfall it computes is
      // irrelevant on the credits path and is zeroed out below.
      /*
        Told, not inferred. This used to read `fundFrom === 'turbo'` — the value
        that turned out to be a lie, since @ar.io/sdk ignores it and spends
        ARIO. With 'turbo' gone the inference silently became "never", which
        would have shown an ARIO shortfall to someone paying with credits.
      */
      const sdkFundFrom = payWithCredits ? 'balance' : fundFrom;
      const base = {
        intent,
        name: normalized,
        ...(type ? { type } : {}),
        ...((intent === 'Extend-Lease' || type === 'lease') && years ? { years } : {}),
        ...(intent === 'Increase-Undername-Limit' && increaseQty
          ? { quantity: increaseQty }
          : {}),
        fundFrom: sdkFundFrom,
        ...(fromAddress ? { fromAddress } : {}),
      };
      /*
        A named gateway that does not qualify THROWS rather than quoting full
        price. It was checked before being named, but the gateway can change
        between that read and this one (a missed epoch), and a failed quote
        would take the whole checkout down with it, credits route included,
        since every route reads its SOL estimate from here. So a refusal falls
        back to the plain quote, and the write is told no gateway was honoured.
      */
      let cd: Awaited<ReturnType<typeof ario.getCostDetails>>;
      let honoured: string | undefined;
      if (discountGatewayAddress && fromAddress) {
        try {
          cd = await ario.getCostDetails({ ...base, discountGatewayAddress });
          honoured = discountGatewayAddress;
        } catch {
          cd = await ario.getCostDetails(base);
        }
      } else {
        cd = await ario.getCostDetails(base);
      }

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
        ...(honoured && discountMARIO > 0 ? { discountGatewayAddress: honoured } : {}),
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
