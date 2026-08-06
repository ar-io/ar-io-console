/**
 * Pure auction math for ArNS "returned names" (Dutch auction).
 *
 * When a name is released / expires it enters a returned-name auction: the price
 * starts at a large premium multiple of the base registration fee and decays
 * linearly down to 1x over the auction window. All functions here are pure and
 * deterministic — callers pass `now` explicitly so the math is testable and the
 * template-contract "no Date.now inside" style is preserved. No SDK imports.
 *
 * The decay formula mirrors arns-react's RNPChart exactly:
 *   multiplier = START + (1 - START) * clamp01((now - start) / (end - start))
 * which yields START at/before the start and 1 at/after the end.
 */

/** Starting premium multiple at auction open. Matches arns-react START_RNP_PREMIUM. */
export const START_RNP_PREMIUM = 50;

/** Registration fee schedule shape (subset of the SDK's `RegistrationFees`). */
export type ReturnedNameFees = Record<
  number,
  { lease: Record<number, number>; permabuy: number }
>;

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/**
 * Current auction premium multiplier, decaying linearly from `startPremium`
 * (at/before `startTimestamp`) to 1 (at/after `endTimestamp`). Degenerate or
 * zero-length windows collapse to `startPremium` before start and 1 after.
 */
export function auctionMultiplier({
  startTimestamp,
  endTimestamp,
  now,
  startPremium = START_RNP_PREMIUM,
}: {
  startTimestamp: number;
  endTimestamp: number;
  now: number;
  startPremium?: number;
}): number {
  const span = endTimestamp - startTimestamp;
  if (span <= 0) {
    // No meaningful window: full premium until end, then floor at 1x.
    return now >= endTimestamp ? 1 : startPremium;
  }
  const percent = clamp01((now - startTimestamp) / span);
  return startPremium + (1 - startPremium) * percent;
}

/**
 * Estimated ARIO price of a returned name: base annual fee (in mARIO) converted
 * to ARIO, scaled by the network demand factor and the current auction
 * multiplier. An estimate for the list view — the modal's `getCostDetails` is
 * authoritative for the exact debited amount.
 */
export function estimateReturnedNameArio(
  baseAnnualMARIO: number,
  demandFactor: number,
  multiplier: number,
): number {
  return (baseAnnualMARIO / 1e6) * demandFactor * multiplier;
}

/** Milliseconds until the auction ends, never negative. */
export function auctionTimeRemainingMs(endTimestamp: number, now: number): number {
  return Math.max(0, endTimestamp - now);
}

/**
 * Clamp a 0-indexed page into `[0, pageCount - 1]`. Keeps the visible page in
 * range when the filtered set shrinks under it (e.g. live auctions expiring on
 * the `now` tick, or a post-purchase refresh) so range labels and Prev/Next
 * stay coherent without a manual step-down. `pageCount` is floored at 1 so an
 * empty set still yields page 0.
 */
export function clampPage(page: number, pageCount: number): number {
  const lastPage = Math.max(0, Math.max(1, pageCount) - 1);
  if (!Number.isFinite(page)) return 0;
  return Math.max(0, Math.min(Math.floor(page), lastPage));
}

/**
 * Human-readable countdown for a remaining-milliseconds value:
 *   0            → 'Ended'
 *   >= 1 day     → 'Xd Yh'
 *   >= 1 hour    → 'Xh Ym'
 *   otherwise    → 'Xm Ys'
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Ended';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days >= 1) return `${days}d ${hours}h`;
  if (hours >= 1) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

/** True while the auction is live: inclusive start, exclusive end. */
export function isAuctionActive(
  startTimestamp: number,
  endTimestamp: number,
  now: number,
): boolean {
  return now >= startTimestamp && now < endTimestamp;
}

/** Minimal row shape the list filter/sort helpers operate on. */
export interface ReturnedNameWindow {
  name: string;
  startTimestamp: number;
  endTimestamp: number;
}

/** Keep only auctions that are live at `now` (inclusive start, exclusive end). */
export function selectActiveReturnedNames<
  T extends { startTimestamp: number; endTimestamp: number },
>(records: readonly T[], now: number): T[] {
  return records.filter((r) =>
    isAuctionActive(r.startTimestamp, r.endTimestamp, now),
  );
}

/**
 * Comparator for the returned-name table. The "premium" key sorts by the LIVE
 * decayed multiplier at `now` (the same value each row renders) rather than a
 * stale snapshot, so the visible order stays in agreement with the displayed
 * premiums as different auctions decay at different rates.
 */
export function compareReturnedNames<T extends ReturnedNameWindow>(
  a: T,
  b: T,
  sortBy: 'name' | 'endTimestamp' | 'premiumMultiplier',
  sortOrder: 'asc' | 'desc',
  now: number,
): number {
  const dir = sortOrder === 'asc' ? 1 : -1;
  switch (sortBy) {
    case 'name':
      return a.name.localeCompare(b.name) * dir;
    case 'premiumMultiplier':
      return (
        (auctionMultiplier({
          startTimestamp: a.startTimestamp,
          endTimestamp: a.endTimestamp,
          now,
        }) -
          auctionMultiplier({
            startTimestamp: b.startTimestamp,
            endTimestamp: b.endTimestamp,
            now,
          })) *
        dir
      );
    case 'endTimestamp':
    default:
      return (a.endTimestamp - b.endTimestamp) * dir;
  }
}

/**
 * Base annual (1-year lease) fee in mARIO for a name of `nameLength` chars,
 * picking the fee bucket. Lengths > 12 collapse to the "13+" tier (same rule as
 * `useArNSPricing.ts`). Returns undefined when the exact bucket is absent so the
 * caller can hide the estimate rather than show a wrong price. We DON'T fall
 * back to bucket 13 for a 1–12 char name: bucket 13 is the longest/cheapest
 * tier, so that fallback would under-quote a short name.
 */
export function baseAnnualMARIOForName(
  fees: ReturnedNameFees,
  nameLength: number,
): number | undefined {
  const bucketKey = nameLength > 12 ? 13 : Math.max(1, nameLength);
  const entry = fees[bucketKey];
  const annual = entry?.lease?.[1];
  return typeof annual === 'number' && Number.isFinite(annual) ? annual : undefined;
}
