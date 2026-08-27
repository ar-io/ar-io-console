import { useQuery } from '@tanstack/react-query';

import { useLinkedSolanaWallet } from '../../../hooks/useLinkedSolanaWallet';
import { useArNSConfigKey } from './useArNSConfigKey';
import { useTurboArNSClient } from './useTurboArNSClient';
import {
  custodyFromTurboName,
  type NameCustody,
} from '../custody/nameCustody';
import { lowerCaseDomain } from '../utils';

/**
 * Custody for every name the connected wallet bought through Turbo.
 *
 * Keyed by lower-cased name so callers can ask about one without re-fetching.
 * A name absent from the map is `unknown`, NOT user-owned — the endpoint is
 * receipt history and says nothing about names bought elsewhere.
 *
 * **Resolves its own address on purpose.** Three surfaces mount this (the names
 * list, the detail page, the record writer). Taking the address as a parameter
 * meant one caller passing a different-but-equivalent value would split the
 * cache key and double the requests — it happens to be the same value today,
 * but only by an implementation detail of `useArNSTurboSigner`. Owning the
 * lookup makes one request structural rather than lucky.
 *
 * Network behaviour, deliberately quiet: custody changes only on a purchase or
 * a transfer, and both invalidate this key explicitly. So it never polls, never
 * refetches on window focus, and retries once — a wallet with no Turbo history
 * is the common case and must not cost a retry storm.
 */
export function useTurboNameCustody() {
  const client = useTurboArNSClient();
  const configKey = useArNSConfigKey();
  const { arnsAddress } = useLinkedSolanaWallet();
  const address = arnsAddress ?? undefined;

  const query = useQuery({
    queryKey: ['turbo-arns-names', address ?? '', configKey],
    enabled: !!client && !!address,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    retry: 1,
    queryFn: async () => {
      const res = await client!.getTurboNames(address!);
      const rows = res.names ?? [];
      const byName = new Map<string, NameCustody>();
      for (const row of rows) {
        // `antId` can be an empty string when the only receipt Turbo holds is
        // an extend/upgrade on a name the caller never owned — those rows say
        // nothing about custody, so they must not overwrite a real one.
        if (!row.name) continue;
        const key = lowerCaseDomain(row.name);
        const custody = custodyFromTurboName(row);
        // A custodial row wins: one receipt showing Turbo still holds it is
        // decisive, while a historical non-custodial row may predate it.
        if (custody === 'turbo-custodial' || !byName.has(key)) {
          byName.set(key, custody);
        }
      }
      return { byName, rows };
    },
  });

  return {
    /** Custody for one name; `unknown` while loading or if never seen. */
    custodyOf: (name: string): NameCustody =>
      query.data?.byName.get(lowerCaseDomain(name)) ?? 'unknown',
    /** Raw receipt rows — the only source for names the ACL cannot see. */
    rows: query.data?.rows,
    isLoading: query.isLoading,
    /**
     * The list degrades rather than breaking: on error `rows` is undefined and
     * the merge returns the on-chain names untouched, so a Turbo outage costs
     * the custodial extras, not the page.
     */
    error: query.error,
  };
}
