import { useQuery } from '@tanstack/react-query';

import { getANT } from '../../../utils';
import { useArNSConfigKey } from './useArNSConfigKey';

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
  // --- Base `@` record fields (DISTINCT from the ANT-level metadata above). ---
  /** Target storage protocol: 0 = Arweave, 1 = IPFS. */
  targetProtocol?: number;
  priority?: number;
  /** Explicit record owner; undefined defaults to the ANT owner. */
  recordOwner?: string;
  recordDisplayName?: string;
  recordLogo?: string;
  recordDescription?: string;
  recordKeywords?: string[];
}

/** Structural view of the read-only ANT client's state getter. */
type ANTRecordState = {
  transactionId?: string;
  ttlSeconds?: number;
  targetProtocol?: number;
  priority?: number;
  owner?: string;
  displayName?: string;
  logo?: string;
  description?: string;
  keywords?: string[];
};

type ANTStateReadable = {
  getState(opts?: { includeMetadata?: boolean }): Promise<{
    Name?: string;
    Ticker?: string;
    Description?: string;
    Keywords?: string[];
    Logo?: string;
    Records?: Record<string, ANTRecordState | undefined>;
  }>;
};

/**
 * Read an ANT's current metadata + base `@` record so the Details editor can
 * prefill its form. One `getState` (a `getProgramAccounts`/`getMultipleAccounts`
 * read on Solana); cached briefly and only fetched while the editor is open.
 */
export function useANTDetails(processId: string | undefined, enabled: boolean) {
  const configKey = useArNSConfigKey();
  return useQuery<ANTDetails>({
    queryKey: ['ant-details', configKey, processId],
    enabled: enabled && !!processId,
    staleTime: 30_000,
    queryFn: async () => {
      const ant = (await getANT(processId as string)) as unknown as ANTStateReadable;
      const state = await ant.getState({ includeMetadata: true });
      const apex = state.Records?.['@'];
      return {
        name: state.Name ?? '',
        ticker: state.Ticker ?? '',
        description: state.Description ?? '',
        keywords: Array.isArray(state.Keywords) ? state.Keywords : [],
        logo: state.Logo ?? '',
        target: apex?.transactionId,
        ttlSeconds: apex?.ttlSeconds,
        targetProtocol: apex?.targetProtocol,
        priority: apex?.priority,
        recordOwner: apex?.owner,
        recordDisplayName: apex?.displayName,
        recordLogo: apex?.logo,
        recordDescription: apex?.description,
        recordKeywords: Array.isArray(apex?.keywords) ? apex?.keywords : undefined,
      };
    },
  });
}
