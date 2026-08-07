import { useQuery } from '@tanstack/react-query';

import { getARIO } from '@/utils';
import { useArNSConfigKey } from './useArNSConfigKey';

/** One ArNS name's on-chain registration record (subset used by the detail page). */
export interface ArNSNameRecord {
  name: string;
  processId: string;
  type: 'lease' | 'permabuy';
  startTimestamp?: number;
  endTimestamp?: number;
  undernameLimit?: number;
  purchasePrice?: number;
}

export interface ArNSNameLookup {
  /** The record, or null when the name is unregistered (available). */
  record: ArNSNameRecord | null;
  /** True when the name is confirmed unregistered (a "not found", not an error). */
  available: boolean;
}

/**
 * Fetch a single ArNS name's registration record by name — the targeted lookup
 * behind the Name Detail page. Works for ANY name (no ownership needed): a
 * registered name returns its record; an unregistered name resolves to
 * `{ record: null, available: true }`. A gateway/RPC failure (NOT a "not found")
 * throws so the page shows an error rather than a false "available".
 */
export function useArNSNameRecord(name: string | undefined) {
  const configKey = useArNSConfigKey();
  return useQuery<ArNSNameLookup>({
    queryKey: ['arns-name-record', configKey, name],
    enabled: !!name,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const normalized = (name ?? '').toLowerCase();
      const ario = getARIO();
      try {
        const rec = await ario.getArNSRecord({ name: normalized });
        if (!rec || !(rec as { processId?: string }).processId) {
          return { record: null, available: true };
        }
        const r = rec as ArNSNameRecord;
        return {
          record: {
            name: normalized,
            processId: r.processId,
            type: r.type,
            startTimestamp: r.startTimestamp,
            endTimestamp: r.endTimestamp,
            undernameLimit: r.undernameLimit,
            purchasePrice: r.purchasePrice,
          },
          available: false,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Only an explicit "not found" means available; anything else is a real
        // error and must not read as "this name is free".
        if (/not found|does not exist|no record|notfound/i.test(msg)) {
          return { record: null, available: true };
        }
        throw err instanceof Error ? err : new Error(msg);
      }
    },
  });
}
