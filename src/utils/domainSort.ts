import {
  domainStatus,
  type DomainStatus,
  type OwnedNameLike,
} from './domainExpiry';

export type DomainSortKey = 'domain' | 'status' | 'expires';
export type SortDirection = 'asc' | 'desc';

/**
 * The fields sorting reads.
 *
 * Extends OwnedNameLike so `domainStatus` can be reused rather than
 * reimplemented here — the status a row sorts by is then guaranteed to be the
 * status its pill shows.
 */
export type DomainSortable = OwnedNameLike;

/**
 * Status sorts by urgency, not alphabetically.
 *
 * Alphabetical would read active, expired, expiring, permanent — which buries
 * the row you need to act on between two you don't. Ascending here means "most
 * urgent first", matching the table's default of soonest-expiring first.
 */
const STATUS_URGENCY: Record<DomainStatus, number> = {
  expired: 0,
  expiring: 1,
  active: 2,
  permanent: 3,
};

/**
 * A name that never expires sorts as infinitely far away, so ascending
 * ("soonest first") puts permabuys last rather than at the top with a 0
 * timestamp — which is what treating a missing endTimestamp as 0 would do.
 */
function expiryValue(row: DomainSortable): number {
  if (row.type === 'permabuy') return Number.POSITIVE_INFINITY;
  if (typeof row.endTimestamp !== 'number' || row.endTimestamp <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return row.endTimestamp;
}

function label(row: DomainSortable): string {
  return (row.displayName || row.name || '').toLowerCase();
}

export function sortDomains<T extends DomainSortable>(
  rows: readonly T[],
  key: DomainSortKey,
  direction: SortDirection,
  now: number = Date.now(),
): T[] {
  const sign = direction === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    let primary = 0;

    if (key === 'domain') {
      primary = label(a).localeCompare(label(b));
    } else if (key === 'status') {
      primary =
        STATUS_URGENCY[domainStatus(a, now)] -
        STATUS_URGENCY[domainStatus(b, now)];
    } else {
      const av = expiryValue(a);
      const bv = expiryValue(b);
      // Infinity - Infinity is NaN, which would corrupt the comparator.
      primary = av === bv ? 0 : av - bv;
    }

    // Name breaks ties in a stable direction, so equal rows never shuffle
    // between renders — and it stays ascending regardless, because a
    // reversed tiebreak reads as randomness rather than as a sort.
    if (primary === 0) return label(a).localeCompare(label(b));
    return primary * sign;
  });
}
