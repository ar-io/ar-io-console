import { useQuery } from '@tanstack/react-query';

import { getARIO } from '../../../utils';
import { isValidSolanaAddress } from '../utils';
import { useArNSConfigKey } from './useArNSConfigKey';

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
 * The primary-name reads THROW when there's simply nothing set — but ALSO on a
 * gateway/RPC/network failure. Only the former is a valid "unset" state; the
 * latter must propagate so react-query surfaces an error instead of the UI
 * treating a failed read as "no primary name". Swallow ONLY the not-found case.
 */
async function absentToUndefined<T>(p: Promise<T>): Promise<T | undefined> {
  try {
    return await p;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not found|does not exist|no record|notfound|no primary/i.test(msg)) {
      return undefined;
    }
    throw err instanceof Error ? err : new Error(msg);
  }
}

/**
 * Read the reverse-resolution state for a Solana address: its current primary
 * name (`getPrimaryName`) and any pending primary-name request it initiated
 * (`getPrimaryNameRequest`). Both SDK reads THROW when absent, so each is
 * wrapped in `absentToUndefined` — a not-found becomes "not set" while any
 * other (gateway/RPC/network) failure propagates as a real query error.
 *
 * Dedicated to the management UI: unlike `hooks/usePrimaryArNSName` (which
 * caches into the Zustand store and also resolves a logo for the header), this
 * hook reflects writes immediately via react-query `refetch`/`invalidate` on
 * the `['arns-primary-name', configKey, address]` key.
 */
export function usePrimaryName(address: string | null | undefined, enabled: boolean) {
  const configKey = useArNSConfigKey();
  return useQuery<PrimaryNameState>({
    queryKey: ['arns-primary-name', configKey, address],
    enabled: enabled && !!address && isValidSolanaAddress(address),
    staleTime: 60_000,
    queryFn: async () => {
      const ario = getARIO() as unknown as ARIOPrimaryReadable;
      const addr = address as string;
      const [current, request] = await Promise.all([
        absentToUndefined(ario.getPrimaryName({ address: addr })),
        absentToUndefined(ario.getPrimaryNameRequest({ initiator: addr })),
      ]);
      return { current, request };
    },
  });
}
