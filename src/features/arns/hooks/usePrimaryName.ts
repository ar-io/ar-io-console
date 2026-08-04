import { useQuery } from '@tanstack/react-query';

import { getARIO } from '../../../utils';
import { isValidSolanaAddress } from '../utils';

/** The primary (reverse-resolution) name currently set for an address. */
export interface PrimaryName {
  owner: string;
  processId: string;
  /** On-chain (possibly punycode `xn--…`) registry form. */
  name: string;
  startTimestamp: number;
}

/** A pending primary-name request awaiting the base name's ANT-owner approval. */
export interface PrimaryNameRequest {
  name: string;
  initiator: string;
  startTimestamp: number;
  endTimestamp: number;
}

/** What `usePrimaryName` resolves to: the current primary and any pending request. */
export interface PrimaryNameState {
  current?: PrimaryName;
  request?: PrimaryNameRequest;
}

/** Structural view of the read-only ARIO client's primary-name getters. */
type ARIOPrimaryReadable = {
  getPrimaryName(p: { address: string }): Promise<PrimaryName>;
  getPrimaryNameRequest(p: { initiator: string }): Promise<PrimaryNameRequest>;
};

/**
 * Read the reverse-resolution state for a Solana address: its current primary
 * name (`getPrimaryName`) and any pending primary-name request it initiated
 * (`getPrimaryNameRequest`). Both SDK reads THROW when absent, so each is
 * wrapped in `.catch(() => undefined)` and treated as "not set" rather than an
 * error.
 *
 * Dedicated to the management UI: unlike `hooks/usePrimaryArNSName` (which
 * caches into the Zustand store and also resolves a logo for the header), this
 * hook reflects writes immediately via react-query `refetch`/`invalidate` on
 * the `['arns-primary-name', address]` key.
 */
export function usePrimaryName(address: string | null | undefined, enabled: boolean) {
  return useQuery<PrimaryNameState>({
    queryKey: ['arns-primary-name', address],
    enabled: enabled && !!address && isValidSolanaAddress(address),
    staleTime: 60_000,
    queryFn: async () => {
      const ario = getARIO() as unknown as ARIOPrimaryReadable;
      const addr = address as string;
      const [current, request] = await Promise.all([
        ario.getPrimaryName({ address: addr }).catch(() => undefined),
        ario.getPrimaryNameRequest({ initiator: addr }).catch(() => undefined),
      ]);
      return { current, request };
    },
  });
}
