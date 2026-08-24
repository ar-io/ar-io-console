import { useQuery } from '@tanstack/react-query';

import { useArNSConfigKey } from './useArNSConfigKey';
import { useTurboArNSClient } from './useTurboArNSClient';
import {
  custodyFromTurboName,
  type NameCustody,
} from '../custody/nameCustody';
import { lowerCaseDomain } from '../utils';

/**
 * Custody for every name this address bought through Turbo.
 *
 * Keyed by lower-cased name so callers can ask about one without re-fetching.
 * A name absent from the map is `unknown`, NOT user-owned — the endpoint is
 * receipt history and says nothing about names bought elsewhere.
 */
export function useTurboNameCustody(address: string | undefined) {
  const client = useTurboArNSClient();
  const configKey = useArNSConfigKey();

  const query = useQuery({
    queryKey: ['turbo-arns-names', address ?? '', configKey],
    enabled: !!client && !!address,
    // Custody only changes on a purchase or a transfer, both of which
    // invalidate this key explicitly. No need to poll for it.
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const res = await client!.getTurboNames(address!);
      const byName = new Map<string, NameCustody>();
      for (const row of res.names ?? []) {
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
      return byName;
    },
  });

  return {
    /** Custody for one name; `unknown` while loading or if never seen. */
    custodyOf: (name: string): NameCustody =>
      query.data?.get(lowerCaseDomain(name)) ?? 'unknown',
    isLoading: query.isLoading,
    error: query.error,
  };
}
