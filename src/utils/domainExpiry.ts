/**
 * Domain-expiry logic for ArNS leases — pure and dependency-free so it stays
 * node-testable. Permabuy names never expire; leases have an `endTimestamp`
 * (ms epoch). We warn when a lease is within a threshold of expiring (or already
 * in its post-expiry grace period, i.e. a negative day count).
 */

export const EXPIRY_WARNING_DAYS = 30;
const MS_PER_DAY = 86_400_000;

/** Minimal shape an owned name needs for expiry checks. */
export interface OwnedNameLike {
  name: string;
  displayName: string;
  /** 'lease' | 'permabuy' (permabuy never expires). */
  type?: string;
  /** Lease end, ms epoch. Absent/0 for permabuy or when unknown. */
  endTimestamp?: number;
}

export interface ExpiringDomain {
  name: string;
  displayName: string;
  /** Whole days until expiry; negative once past (in grace period). */
  daysRemaining: number;
}

/**
 * Whole days from `now` until `endTimestamp` (negative once past). Future durations
 * round up ("in N days"); past durations round down, so a lease even 1ms past reads
 * as expired (-1) rather than "today" (0).
 */
export function daysUntil(endTimestamp: number, now: number): number {
  const days = (endTimestamp - now) / MS_PER_DAY;
  return days >= 0 ? Math.ceil(days) : Math.floor(days);
}

/** True for a lease that is within `thresholdDays` of expiring (or already past). */
export function isExpiringSoon(
  name: OwnedNameLike,
  now: number,
  thresholdDays: number = EXPIRY_WARNING_DAYS,
): boolean {
  if (name.type === 'permabuy') return false;
  if (typeof name.endTimestamp !== 'number' || name.endTimestamp <= 0) return false;
  return daysUntil(name.endTimestamp, now) <= thresholdDays;
}

/**
 * The leases expiring within `thresholdDays` (including any already in grace),
 * soonest-first. Permabuy names and names without a known `endTimestamp` are
 * excluded — we never warn on data we don't have.
 */
export function getExpiringDomains(
  names: OwnedNameLike[],
  now: number,
  thresholdDays: number = EXPIRY_WARNING_DAYS,
): ExpiringDomain[] {
  return names
    .filter((n) => isExpiringSoon(n, now, thresholdDays))
    .map((n) => ({
      name: n.name,
      displayName: n.displayName,
      daysRemaining: daysUntil(n.endTimestamp!, now),
    }))
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/**
 * Sort key that floats expiring-soon leases to the front (soonest first) while
 * leaving everything else in place — expiring names get their day count, all
 * others get `Infinity`. Use as `names.sort((a,b) => expirySortKey(a,now) - expirySortKey(b,now))`.
 */
export function expirySortKey(
  name: OwnedNameLike,
  now: number,
  thresholdDays: number = EXPIRY_WARNING_DAYS,
): number {
  return isExpiringSoon(name, now, thresholdDays) ? daysUntil(name.endTimestamp!, now) : Infinity;
}

/** Compact human label for a remaining-days count, e.g. "in 5 days" / "today" / "expired". */
export function expiryLabel(daysRemaining: number): string {
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining === 0) return 'today';
  if (daysRemaining === 1) return 'in 1 day';
  return `in ${daysRemaining} days`;
}
