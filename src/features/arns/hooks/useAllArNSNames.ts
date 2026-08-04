import { useCallback, useEffect, useMemo, useState } from 'react';
import { getANT, getARIO } from '../../../utils';
import { readArNSConfigSignature } from './useArNSConfigKey';

/**
 * Browse ALL ArNS names network-wide.
 *
 * Performance note — read before changing the fetch strategy:
 * `ario.getArNSRecords()` on the Solana backend is a SINGLE `getProgramAccounts`
 * that streams the ENTIRE registry to the client and then slices in-JS. Its
 * `cursor`/`limit`/`sortBy` params are applied client-side by the SDK's
 * `paginate()` helper — they do NOT reduce RPC work, and `sortBy` does not
 * actually sort. So calling it per-page would re-download the whole registry on
 * every page turn (RPC spam). Instead we fetch the full set ONCE, cache it in a
 * module-level store with a TTL, and do all sorting/filtering/paging in-memory.
 * Measured: ~3.5k records, ~700KB, <500ms against the prod QuickNode RPC.
 *
 * Per-name ANT target resolution (`getANT().getState()`) is one RPC per name, so
 * it is done lazily on demand (`resolveTarget`) and never for the whole set.
 */

export interface AllArNSRecord {
  name: string;
  processId: string;
  type: 'lease' | 'permabuy';
  startTimestamp?: number;
  endTimestamp?: number;
  undernameLimit?: number;
  purchasePrice?: number;
}

export type AllArNSSortKey = 'name' | 'startTimestamp' | 'endTimestamp' | 'type';
export type SortOrder = 'asc' | 'desc';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Module-level cache so the full registry survives route changes within a
// session without bloating persisted localStorage (~700KB would be wasteful there).
// `signature` pins the cache to the network config it was fetched against, so a
// gateway/program-ID/RPC change (or config-mode switch) discards it rather than
// serving another network's registry.
let registryCache: { records: AllArNSRecord[]; timestamp: number; signature: string } | null = null;
let inflight: Promise<AllArNSRecord[]> | null = null;

// Lazily-resolved ANT targets, keyed by processId. Shared across mounts, and
// dropped alongside the registry when the network config changes.
const targetCache = new Map<string, string | null>();

/**
 * Drop the module-level registry + target caches when the active ArNS network
 * config changes, so no read ever mixes data across networks. No-op when the
 * signature is unchanged. Called at the top of every registry fetch.
 */
function evictCachesOnConfigChange(signature: string): void {
  if (registryCache && registryCache.signature !== signature) {
    registryCache = null;
    inflight = null;
    targetCache.clear();
  }
}

/**
 * Fetch (and cache) the full ArNS registry. Exported so other features — e.g.
 * the Search tab's instant availability check — reuse the SAME single download
 * and module cache instead of issuing their own `getProgramAccounts`.
 */
export async function loadArNSRegistry(forceRefresh = false): Promise<AllArNSRecord[]> {
  const signature = readArNSConfigSignature();
  // Discard a registry fetched against a different network before any cache hit.
  evictCachesOnConfigChange(signature);

  if (!forceRefresh && registryCache && Date.now() - registryCache.timestamp < CACHE_TTL_MS) {
    return registryCache.records;
  }
  // De-dupe concurrent callers (e.g. two components mounting at once).
  if (!forceRefresh && inflight) return inflight;

  inflight = (async () => {
    const ario = getARIO();
    // limit: pass a ceiling well above the registry size so the SDK returns the
    // full set in one shot (it slices client-side; totalItems is ~3.5k today).
    const page = await ario.getArNSRecords({ limit: 1_000_000 });
    const records: AllArNSRecord[] = (page.items || []).map((r: any) => ({
      name: r.name,
      processId: r.processId,
      type: r.type,
      startTimestamp: r.startTimestamp,
      endTimestamp: r.endTimestamp,
      undernameLimit: r.undernameLimit,
      purchasePrice: r.purchasePrice,
    }));
    registryCache = { records, timestamp: Date.now(), signature };
    return records;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export interface UseAllArNSNamesOptions {
  search?: string;
  sortBy?: AllArNSSortKey;
  sortOrder?: SortOrder;
  page?: number; // 0-indexed
  pageSize?: number;
  /** When set, keep only leases whose expiry falls within this many days from now. */
  expiringWithinDays?: number;
}

export function useAllArNSNames(options: UseAllArNSNamesOptions = {}) {
  const {
    search = '',
    sortBy = 'startTimestamp',
    sortOrder = 'desc',
    page = 0,
    pageSize = 25,
    expiringWithinDays,
  } = options;

  const [records, setRecords] = useState<AllArNSRecord[]>(() => registryCache?.records ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(targetCache),
  );

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadArNSRegistry(forceRefresh);
      setRecords(result);
    } catch (e) {
      console.error('Failed to fetch all ArNS records:', e);
      setError(e instanceof Error ? e.message : 'Failed to load the ArNS registry.');
      // Fall back to any stale cache so the UI isn't empty on a transient error.
      if (registryCache) setRecords(registryCache.records);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Resolve a single name's current target on demand (one ANT RPC, cached).
  const resolveTarget = useCallback(async (processId: string) => {
    if (targetCache.has(processId)) return targetCache.get(processId) ?? null;
    try {
      const ant = await getANT(processId);
      const state = await ant.getState();
      const target = state.Records?.['@']?.transactionId ?? null;
      targetCache.set(processId, target);
      setTargets((prev) => ({ ...prev, [processId]: target }));
      return target;
    } catch (e) {
      console.warn('Failed to resolve ANT target for', processId, e);
      targetCache.set(processId, null);
      setTargets((prev) => ({ ...prev, [processId]: null }));
      return null;
    }
  }, []);

  // Client-side filter + sort + paginate over the cached full set. Zero RPC.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = q ? records.filter((r) => r.name.toLowerCase().includes(q)) : records;
    if (expiringWithinDays != null) {
      const now = Date.now();
      const cutoff = now + expiringWithinDays * 24 * 60 * 60 * 1000;
      // Only leases can expire; keep those whose expiry is upcoming within the window.
      base = base.filter(
        (r) =>
          r.type === 'lease' &&
          r.endTimestamp != null &&
          r.endTimestamp >= now &&
          r.endTimestamp <= cutoff,
      );
    }
    const dir = sortOrder === 'asc' ? 1 : -1;
    const sorted = [...base].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'type':
          return a.type.localeCompare(b.type) * dir;
        case 'endTimestamp':
          // permabuys have no end; treat as +Infinity so they sort last on asc.
          return ((a.endTimestamp ?? Infinity) - (b.endTimestamp ?? Infinity)) * dir;
        case 'startTimestamp':
        default:
          return ((a.startTimestamp ?? 0) - (b.startTimestamp ?? 0)) * dir;
      }
    });
    return sorted;
  }, [records, search, sortBy, sortOrder, expiringWithinDays]);

  const totalFiltered = filtered.length;
  const pageCount = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = useMemo(
    () => filtered.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [filtered, safePage, pageSize],
  );

  return {
    /** Visible slice for the current page/sort/filter. */
    items: pageItems,
    /** All records currently loaded (unfiltered). */
    allRecords: records,
    totalItems: records.length,
    totalFiltered,
    pageCount,
    loading,
    error,
    /** Lazily-resolved ANT targets keyed by processId. */
    targets,
    resolveTarget,
    refresh: () => load(true),
  };
}
