import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getANT } from '../../../utils';
import { useArNSConfigKey } from './useArNSConfigKey';

/**
 * Structural view of the read-only ANT client's bulk summary loader. One
 * instance (any processId) can summarize MANY mints in a handful of
 * `getMultipleAccounts` calls — see `getANTSummaries` in the SDK's
 * `SolanaANTReadable`. We only need each summary's `logo` txId here.
 */
type ANTSummariesReadable = {
  getANTSummaries(
    mints: ReadonlyArray<string>,
  ): Promise<Record<string, { logo?: string; processId?: string }>>;
};

/**
 * Batch-fetch the logo txId for a set of ANT process IDs (owned-name rows) and
 * return a `processId -> logo txId` map. Uses the SDK's bulk `getANTSummaries`
 * (a few RPC calls total, not one per name) and caches the result for ~5 min.
 * Missing/unfetched names simply have no entry — callers fall back to a
 * placeholder icon. Returns an empty map while loading or when given no ids.
 */
export function useAntLogos(processIds: string[]): Map<string, string> {
  // Stable, de-duplicated key so identical row sets share one cache entry.
  const mints = useMemo(
    () => Array.from(new Set(processIds.filter(Boolean))).sort(),
    [processIds],
  );

  const configKey = useArNSConfigKey();
  const { data } = useQuery<Record<string, string>>({
    queryKey: ['ant-logos', configKey, mints],
    enabled: mints.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const ant = (await getANT(mints[0])) as unknown as ANTSummariesReadable;
      const summaries = await ant.getANTSummaries(mints);
      const out: Record<string, string> = {};
      for (const [processId, summary] of Object.entries(summaries)) {
        if (summary?.logo) out[processId] = summary.logo;
      }
      return out;
    },
  });

  return useMemo(() => new Map(Object.entries(data ?? {})), [data]);
}
