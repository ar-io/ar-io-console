import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getARIO } from '../../../utils/arIOConfig';
import { isValidArNSName, lowerCaseDomain } from '../utils';
import { loadArNSRegistry } from './useAllArNSNames';
import { useArNSConfigKey } from './useArNSConfigKey';

export type ArNSAvailability = {
  available: boolean;
  name: string;
  /** Protocol-reserved: not registrable, but not owned by anyone either. */
  reserved?: boolean;
};

type RegistryIndex = {
  taken: Set<string>;
  reserved: Set<string>;
};

/**
 * Whole-registry index (every registered name + every reserved name), fetched
 * once and shared app-wide via React Query. Two `getProgramAccounts` calls in
 * total — see `useAllArNSNames` for why the registry is fetched in one shot
 * rather than paged.
 */
function useArNSRegistryIndex() {
  const configKey = useArNSConfigKey();
  return useQuery<RegistryIndex>({
    queryKey: ['arns-registry-index', configKey],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const ario = getARIO();
      const [records, reserved] = await Promise.all([
        loadArNSRegistry(),
        ario
          .getArNSReservedNames({ limit: 1_000_000 })
          .then((p) => p.items || [])
          .catch(() => [] as Array<{ name: string }>),
      ]);
      return {
        taken: new Set(records.map((r) => r.name)),
        reserved: new Set(reserved.map((r: any) => r.name)),
      };
    },
  });
}

/**
 * Check whether an ArNS name is registrable.
 *
 * Backed by the in-memory registry index, so availability is an O(1) Set lookup:
 * instant, and no RPC per keystroke. This also fixes a correctness bug in the
 * previous per-name implementation, which treated ANY lookup failure (including
 * a transient network error) as "available" — a false positive that could send a
 * user into the buy flow for a name that is actually taken. Set membership has
 * no such failure mode.
 *
 * While the index is still loading, we fall back to the original single-name
 * `getArNSRecord` lookup so the search box works immediately on a cold load.
 *
 * Returns the same `{ data, isFetching }` shape as before, plus `suggestions`.
 */
export function useArNSAvailability(name: string) {
  const normalized = lowerCaseDomain(name);
  const enabled = normalized.length > 0 && isValidArNSName(normalized);
  const configKey = useArNSConfigKey();

  const index = useArNSRegistryIndex();
  const indexReady = !!index.data;

  // Only runs until the index becomes available.
  const fallback = useQuery<ArNSAvailability>({
    queryKey: ['arns-availability', configKey, normalized],
    enabled: enabled && !indexReady,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      const ario = getARIO();
      try {
        const record = await ario.getArNSRecord({ name: normalized });
        return { name: normalized, available: !record };
      } catch (err) {
        // ONLY an explicit "record not found" means the name is available. Any
        // other failure (gateway/RPC/network) must NOT be reported as available
        // — rethrow so the query errors and the UI shows nothing rather than a
        // false "available" that could send the user to buy a taken name.
        const msg = err instanceof Error ? err.message : String(err);
        if (/not found|does not exist|no record|notfound/i.test(msg)) {
          return { name: normalized, available: true };
        }
        throw err instanceof Error ? err : new Error(msg);
      }
    },
  });

  const data: ArNSAvailability | undefined = useMemo(() => {
    if (!enabled) return undefined;
    if (index.data) {
      const taken = index.data.taken.has(normalized);
      const reserved = index.data.reserved.has(normalized);
      return { name: normalized, available: !taken && !reserved, reserved };
    }
    return fallback.data;
  }, [enabled, index.data, normalized, fallback.data]);

  /** Available alternatives to offer when the desired name is taken/reserved. */
  const suggestions = useMemo(() => {
    if (!enabled || !index.data || data?.available !== false) return [] as string[];
    const { taken, reserved } = index.data;
    const variants = [
      `get${normalized}`,
      `${normalized}app`,
      `${normalized}-app`,
      `my${normalized}`,
      `${normalized}hq`,
      `${normalized}labs`,
      `${normalized}dao`,
      `the${normalized}`,
      `${normalized}xyz`,
      `${normalized}io`,
    ];
    const out: string[] = [];
    for (const v of variants) {
      if (out.length >= 5) break;
      if (isValidArNSName(v) && !taken.has(v) && !reserved.has(v)) out.push(v);
    }
    return out;
  }, [enabled, index.data, normalized, data?.available]);

  return {
    data,
    // Once the index is loaded, results are synchronous — never "fetching".
    isFetching: indexReady ? false : fallback.isFetching,
    suggestions,
    indexReady,
  };
}
