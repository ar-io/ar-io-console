import { useQuery } from '@tanstack/react-query';

import { getARIO } from '../../../utils';
import { useArNSConfigKey } from './useArNSConfigKey';
import {
  resolveOperatorDiscount,
  type GatewayForDiscount,
  type OperatorDiscount,
} from '../purchase/operatorDiscount';

/** Structural view of the two gateway reads this needs. */
type GatewayReadable = {
  getGateway(p: { address: string }): Promise<GatewayForDiscount>;
  getGateways(p: {
    cursor?: string;
    limit?: number;
    filters?: Record<string, string>;
  }): Promise<{
    items: Array<GatewayForDiscount & { gatewayAddress: string }>;
    nextCursor?: string;
  }>;
};

/** Enough pages for the whole registry (~620 gateways) with room to grow. */
const MAX_PAGES = 20;

/**
 * Whether the ArNS signer (the Solana wallet that owns and pays for names:
 * the session wallet on a Solana session, else the linked one) can claim the
 * gateway-operator discount, and which gateway to name to claim it.
 *
 * Two reads, cached for ten minutes: the signer's own gateway, and (only when
 * that does not qualify) the gateway that lists the signer as its operations
 * address. The second is a full registry scan in the SDK, which is why it is
 * cached and skipped for an operator whose own gateway already qualifies.
 *
 * Any read failure resolves to "not eligible": the discount is never claimed
 * on a guess, because a named gateway that does not qualify fails the
 * purchase outright.
 */
export function useOperatorDiscountGateway(signerAddress: string | undefined): {
  discount: OperatorDiscount | undefined;
  loading: boolean;
} {
  const configKey = useArNSConfigKey();

  const query = useQuery<OperatorDiscount>({
    queryKey: ['arns-operator-discount', configKey, signerAddress ?? ''],
    enabled: !!signerAddress,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    queryFn: async () => {
      const signer = signerAddress!;
      const ario = getARIO() as unknown as GatewayReadable;
      const nowMs = Date.now();

      // The SDK throws "Gateway not found" for a wallet that runs none.
      const ownGateway = await ario.getGateway({ address: signer }).catch(() => null);
      const own = resolveOperatorDiscount({
        signer,
        ownGateway,
        operationsGateway: null,
        nowMs,
      });
      if (own.eligible) return own;

      let operationsGateway: (GatewayForDiscount & { gatewayAddress: string }) | null = null;
      try {
        let cursor: string | undefined;
        for (let page = 0; page < MAX_PAGES; page++) {
          const res = await ario.getGateways({
            limit: 1000,
            filters: { operationsAddress: signer },
            ...(cursor ? { cursor } : {}),
          });
          // Filtered server side of the SDK, checked again here: a gateway is
          // only used when it names this signer, whatever the filter did.
          const hit = res.items.find((g) => g.operationsAddress === signer);
          if (hit) {
            operationsGateway = hit;
            break;
          }
          if (!res.nextCursor) break;
          cursor = res.nextCursor;
        }
      } catch {
        operationsGateway = null;
      }

      return resolveOperatorDiscount({ signer, ownGateway, operationsGateway, nowMs });
    },
  });

  return {
    discount: signerAddress ? query.data : undefined,
    loading: !!signerAddress && query.isLoading,
  };
}
