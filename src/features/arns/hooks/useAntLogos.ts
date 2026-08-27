import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getANT } from '../../../utils';
import { useArNSConfigKey } from './useArNSConfigKey';

/** The slice of each ANT's summary the owned-names UI needs. */
export interface AntSummary {
  /** Logo txId (may be the default AR.IO placeholder). */
  logo?: string;
  /** Current ANT (NFT) owner address. */
  owner?: string;
  /** Delegated controller addresses. */
  controllers: string[];
}

/**
 * Structural view of the read-only ANT client's bulk summary loader. One
 * instance (any processId) can summarize MANY mints in a handful of
 * `getMultipleAccounts` calls — see `getANTSummaries` in the SDK's
 * `SolanaANTReadable`. Each summary carries logo + owner + controllers.
 */
type ANTSummariesReadable = {
  getANTSummaries(mints: ReadonlyArray<string>): Promise<
    Record<
      string,
      {
        logo?: string;
        owner?: string;
        controllers?: string[];
        processId?: string;
      }
    >
  >;
};

/**
 * Bulk-fetch summary state (logo + owner + controllers) for a set of ANT process
 * IDs and return a `processId -> AntSummary` map. Uses the SDK's bulk
 * `getANTSummaries` (a few RPC calls total, not one per name) and caches for
 * ~5 min. Missing/unfetched names simply have no entry. Returns an empty map
 * while loading or when given no ids.
 */
export function useAntSummaries(processIds: string[]): Map<string, AntSummary> {
  // Stable, de-duplicated key so identical row sets share one cache entry.
  const mints = useMemo(
    () => Array.from(new Set(processIds.filter(Boolean))).sort(),
    [processIds],
  );

  const configKey = useArNSConfigKey();
  const { data } = useQuery<Record<string, AntSummary>>({
    queryKey: ['ant-summaries', configKey, mints],
    enabled: mints.length > 0,
    staleTime: 5 * 60_000,
    // Owner/controllers/logo change rarely and this is a bulk multi-account
    // read — skip the tab-refocus refetch.
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const ant = (await getANT(mints[0])) as unknown as ANTSummariesReadable;
      const summaries = await ant.getANTSummaries(mints);
      const out: Record<string, AntSummary> = {};
      for (const [processId, s] of Object.entries(summaries)) {
        out[processId] = {
          logo: s?.logo,
          owner: s?.owner,
          controllers: Array.isArray(s?.controllers) ? s.controllers : [],
        };
      }
      return out;
    },
  });

  return useMemo(() => new Map(Object.entries(data ?? {})), [data]);
}

/**
 * Logo-only view over {@link useAntSummaries} — kept for existing callers that
 * only need `processId -> logo txId`. Shares the same cached bulk fetch.
 */
export function useAntLogos(processIds: string[]): Map<string, string> {
  const summaries = useAntSummaries(processIds);
  return useMemo(() => {
    const out = new Map<string, string>();
    for (const [processId, s] of summaries) {
      if (s.logo) out.set(processId, s.logo);
    }
    return out;
  }, [summaries]);
}
