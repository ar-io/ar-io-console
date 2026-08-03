import { useQuery } from '@tanstack/react-query';

import { getANT } from '../../../utils';

/** The editable metadata + base `@` record of an ANT, read for prefill. */
export interface ANTDetails {
  /** Display nickname (`Name`). */
  name: string;
  ticker: string;
  description: string;
  keywords: string[];
  /** Logo Arweave txId (may be the default AR.IO logo). */
  logo: string;
  /** Base `@` record target, or undefined if the name has no `@` record yet. */
  target?: string;
  /** Base `@` record TTL in seconds. */
  ttlSeconds?: number;
}

/** Structural view of the read-only ANT client's state getter. */
type ANTStateReadable = {
  getState(): Promise<{
    Name?: string;
    Ticker?: string;
    Description?: string;
    Keywords?: string[];
    Logo?: string;
    Records?: Record<
      string,
      { transactionId?: string; ttlSeconds?: number } | undefined
    >;
  }>;
};

/**
 * Read an ANT's current metadata + base `@` record so the Details editor can
 * prefill its form. One `getState` (a `getProgramAccounts`/`getMultipleAccounts`
 * read on Solana); cached briefly and only fetched while the editor is open.
 */
export function useANTDetails(processId: string | undefined, enabled: boolean) {
  return useQuery<ANTDetails>({
    queryKey: ['ant-details', processId],
    enabled: enabled && !!processId,
    staleTime: 30_000,
    queryFn: async () => {
      const ant = (await getANT(processId as string)) as unknown as ANTStateReadable;
      const state = await ant.getState();
      const apex = state.Records?.['@'];
      return {
        name: state.Name ?? '',
        ticker: state.Ticker ?? '',
        description: state.Description ?? '',
        keywords: Array.isArray(state.Keywords) ? state.Keywords : [],
        logo: state.Logo ?? '',
        target: apex?.transactionId,
        ttlSeconds: apex?.ttlSeconds,
      };
    },
  });
}
