import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getARIO } from '../../../utils';
import { useArNSConfigKey } from './useArNSConfigKey';
import {
  operatorDiscountIneligibility,
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

type OperationsGateway = GatewayForDiscount & { gatewayAddress: string };

/** Enough pages for the whole registry (~620 gateways) with room to grow. */
const MAX_PAGES = 20;
const STALE_MS = 10 * 60_000;
const GC_MS = 30 * 60_000;

/**
 * Whether the ArNS signer (the Solana wallet that owns and pays for names:
 * the session wallet on a Solana session, else the linked one) can claim the
 * gateway-operator discount, and which gateway to name to claim it.
 *
 * Two reads, each cached for ten minutes per signer:
 *
 * - The signer's own gateway: one account, always read, so an operator's
 *   hint shows on every route.
 * - The gateway that lists the signer as its operations address: a full
 *   registry scan in the SDK (~620 accounts). Run only when
 *   `scanOperations` is true, which the hosts set on the ARIO route (the only
 *   route that can use the discount), and never when the signer's own gateway
 *   already qualifies. Toggling the route does not refetch: the result stays
 *   cached under the signer.
 *
 * Any read failure resolves to "not eligible": the discount is never claimed
 * on a guess, because a named gateway that does not qualify fails the
 * purchase outright.
 */
export function useOperatorDiscountGateway(
  signerAddress: string | undefined,
  { scanOperations = false }: { scanOperations?: boolean } = {},
): {
  discount: OperatorDiscount | undefined;
  /** A lookup that could still find a discount is in flight. */
  checking: boolean;
} {
  const configKey = useArNSConfigKey();

  const own = useQuery<GatewayForDiscount | null>({
    queryKey: ['arns-operator-gateway-own', configKey, signerAddress ?? ''],
    enabled: !!signerAddress,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    retry: 1,
    queryFn: async () => {
      const ario = getARIO() as unknown as GatewayReadable;
      // The SDK throws "Gateway not found" for a wallet that runs none.
      return ario.getGateway({ address: signerAddress! }).catch(() => null);
    },
  });

  // No scan when the signer's own gateway already gives the discount.
  const ownQualifies =
    !!signerAddress &&
    !!own.data &&
    !operatorDiscountIneligibility(own.data, {
      operator: signerAddress,
      signer: signerAddress,
      nowMs: Date.now(),
    });

  const scanEnabled = !!signerAddress && scanOperations && own.isFetched && !ownQualifies;

  const ops = useQuery<OperationsGateway | null>({
    queryKey: ['arns-operator-gateway-ops', configKey, signerAddress ?? ''],
    enabled: scanEnabled,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    retry: 1,
    queryFn: async () => {
      const signer = signerAddress!;
      const ario = getARIO() as unknown as GatewayReadable;
      try {
        let cursor: string | undefined;
        for (let page = 0; page < MAX_PAGES; page++) {
          const res = await ario.getGateways({
            limit: 1000,
            filters: { operationsAddress: signer },
            ...(cursor ? { cursor } : {}),
          });
          // Filtered inside the SDK, checked again here: a gateway is only
          // used when it names this signer, whatever the filter did.
          const hit = res.items.find((g) => g.operationsAddress === signer);
          if (hit) return hit;
          if (!res.nextCursor) break;
          cursor = res.nextCursor;
        }
      } catch {
        // Unreadable counts as none.
      }
      return null;
    },
  });

  const discount = useMemo(() => {
    if (!signerAddress || !own.isFetched) return undefined;
    return resolveOperatorDiscount({
      signer: signerAddress,
      ownGateway: own.data ?? null,
      operationsGateway: ops.data ?? null,
      nowMs: Date.now(),
    });
  }, [signerAddress, own.isFetched, own.data, ops.data]);

  return {
    discount,
    checking: !!signerAddress && (own.isLoading || (scanEnabled && ops.isLoading)),
  };
}
