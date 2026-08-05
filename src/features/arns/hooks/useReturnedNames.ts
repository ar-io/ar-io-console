import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getARIO } from '../../../utils';
import { isValidArNSName, lowerCaseDomain } from '../utils';
import { useArNSConfigKey } from './useArNSConfigKey';
import {
  clampPage,
  compareReturnedNames,
  selectActiveReturnedNames,
  type ReturnedNameFees,
} from '../returnedNamePricing';

/** A single returned-name auction entry (subset of the SDK's `ReturnedName`). */
export interface ReturnedNameRecord {
  name: string;
  startTimestamp: number;
  endTimestamp: number;
  initiator: string;
  premiumMultiplier: number;
}

export type ReturnedNameSortKey = 'name' | 'endTimestamp' | 'premiumMultiplier';
export type ReturnedNameSortOrder = 'asc' | 'desc';

/** Structural view of the ARIO reads used by this feature. */
type ARIOReturnedNamesReadable = {
  getArNSReturnedNames(params?: {
    cursor?: string;
    limit?: number;
  }): Promise<{
    items?: ReturnedNameRecord[];
    nextCursor?: string;
    hasMore?: boolean;
  }>;
  getArNSReturnedName(params: { name: string }): Promise<ReturnedNameRecord>;
  getRegistrationFees(): Promise<ReturnedNameFees>;
  getDemandFactor(): Promise<number>;
};

const STALE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch the FULL returned-name auction pool once, looping `getArNSReturnedNames`
 * until `hasMore` is false (mirrors arns-react's `useReturnedNames` and console's
 * `useAllArNSNames` "fetch-all + cache + page-in-memory" approach). Cached per
 * config mode for 5 minutes; all filter/sort/paging happens client-side.
 */
async function loadReturnedNames(): Promise<ReturnedNameRecord[]> {
  const ario = getARIO() as unknown as ARIOReturnedNamesReadable;
  const items: ReturnedNameRecord[] = [];
  let cursor: string | undefined;
  let hasMore = true;
  // Hard ceiling so a misbehaving backend can't loop forever.
  let guard = 0;
  while (hasMore && guard < 100) {
    const res = await ario.getArNSReturnedNames({ cursor, limit: 1000 });
    for (const it of res.items ?? []) items.push(it);
    hasMore = !!res.hasMore && !!res.nextCursor;
    cursor = res.nextCursor;
    guard += 1;
  }
  return items;
}

export interface UseReturnedNamesOptions {
  search?: string;
  sortBy?: ReturnedNameSortKey;
  sortOrder?: ReturnedNameSortOrder;
  page?: number; // 0-indexed
  pageSize?: number;
  /** Live clock for active-filtering + premium sort. Defaults to Date.now(). */
  now?: number;
}

/**
 * Paginated, filterable, sortable view of the active returned-name auctions.
 * Only currently-active auctions (`isAuctionActive(now)`) are surfaced. Sorting
 * and paging are in-memory over the cached pool — zero extra RPC per page.
 */
export function useReturnedNames(options: UseReturnedNamesOptions = {}) {
  const {
    search = '',
    sortBy = 'endTimestamp',
    sortOrder = 'asc',
    page = 0,
    pageSize = 25,
    now = Date.now(),
  } = options;

  const configKey = useArNSConfigKey();

  const query = useQuery<ReturnedNameRecord[]>({
    queryKey: ['arns-returned-names', configKey],
    queryFn: loadReturnedNames,
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const allRecords = useMemo(() => query.data ?? [], [query.data]);

  // Only currently-live auctions are surfaced (recomputed against the live clock
  // so freshly-expired rows drop out without a refetch).
  const active = useMemo(
    () => selectActiveReturnedNames(allRecords, now),
    [allRecords, now],
  );

  // Filter by search, then sort — premium sort uses the same live multiplier the
  // rows render, so the visible order matches the displayed premiums.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = q
      ? active.filter((r) => r.name.toLowerCase().includes(q))
      : active;
    return [...matched].sort((a, b) =>
      compareReturnedNames(a, b, sortBy, sortOrder, now),
    );
  }, [active, search, sortBy, sortOrder, now]);

  const activeCount = active.length;
  const totalFiltered = filtered.length;
  const pageCount = Math.max(1, Math.ceil(totalFiltered / pageSize));
  // Clamp into range so a page beyond a freshly-shrunk set (auctions expiring on
  // the live tick, or a post-purchase refresh) still shows a valid slice. The
  // panel derives its range label + Prev/Next from this same `safePage`.
  const safePage = clampPage(page, pageCount);
  const items = useMemo(
    () => filtered.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [filtered, safePage, pageSize],
  );

  return {
    /** Visible slice for the current page/sort/filter. */
    items,
    /** All returned-name records currently loaded (active + inactive). */
    allRecords,
    totalItems: allRecords.length,
    /** Count of currently-live auctions (before the search filter). */
    activeCount,
    totalFiltered,
    pageCount,
    /** `page` clamped into `[0, pageCount - 1]` — the actually-shown page. */
    safePage,
    loading: query.isLoading,
    error: query.error
      ? query.error instanceof Error
        ? query.error.message
        : 'Failed to load returned-name auctions.'
      : null,
    refresh: () => query.refetch(),
  };
}

/**
 * Freshness re-check for a single returned name — used by the buy modal as a
 * soft, non-blocking signal. A rejection may mean the name left the auction OR a
 * transient gateway/RPC hiccup; the two can't be told apart from the error, so
 * the modal treats the time-based window as authoritative and only surfaces a
 * fetch error as a retryable warning. One retry smooths over a single blip.
 * Enabled only for a valid, non-empty name.
 */
export function useReturnedName(name?: string) {
  const configKey = useArNSConfigKey();
  const normalized = name ? lowerCaseDomain(name) : '';
  const enabled = normalized.length > 0 && isValidArNSName(normalized);

  return useQuery<ReturnedNameRecord>({
    queryKey: ['arns-returned-name', configKey, normalized],
    enabled,
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const ario = getARIO() as unknown as ARIOReturnedNamesReadable;
      return ario.getArNSReturnedName({ name: normalized });
    },
  });
}

export interface ReturnedNamePriceInputs {
  fees: ReturnedNameFees;
  demandFactor: number;
}

/**
 * Fetch the price inputs (registration fees + demand factor) ONCE so the list
 * can compute an estimated ARIO price per row without a per-row RPC. Cached for
 * 5 minutes and keyed by config mode.
 */
export function useReturnedNamePriceInputs() {
  const configKey = useArNSConfigKey();

  return useQuery<ReturnedNamePriceInputs>({
    queryKey: ['arns-returned-name-price-inputs', configKey],
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const ario = getARIO() as unknown as ARIOReturnedNamesReadable;
      const [fees, demandFactor] = await Promise.all([
        ario.getRegistrationFees(),
        ario.getDemandFactor(),
      ]);
      return { fees, demandFactor };
    },
  });
}
