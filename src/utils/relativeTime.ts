/**
 * "2d ago" — coarse on purpose.
 *
 * `now` is injected rather than read from the clock so this stays pure and
 * testable. A timestamp in the future (clock skew, a restored backup) returns
 * undefined rather than "in 3 days", which would read as a bug in the row.
 */
export function relativeTime(
  timestamp: number | undefined,
  now: number,
): string | undefined {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp <= 0) {
    return undefined;
  }
  const diff = now - timestamp;
  if (diff < 0) return undefined;

  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  // 360–364 days is twelve 30-day months but not yet a year; cap at 11 so it
  // never falls through to "0y ago".
  if (days < 365) return `${Math.min(Math.floor(days / 30), 11)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
