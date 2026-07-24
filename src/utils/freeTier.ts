/**
 * Free-tier upload logic — pure, dependency-free so it stays node-testable.
 *
 * The bundler's free tier has two axes: a per-item size cap and the wallet's
 * remaining lifetime/IP allowance (via `getFreeStatus`). "Free" must satisfy both,
 * otherwise a wallet that has used up its allowance would be shown "FREE" and then
 * charged. When the remaining allowance is unknown, we fall back to the size-only
 * check (advisory) to preserve prior behavior.
 *
 * `isFileFree` decides a SINGLE item against the full remaining allowance. For a
 * multi-file batch, use `computeFreeFlags`, which consumes the shared allowance
 * cumulatively across the batch — otherwise every file would independently pass a
 * partial allowance and the cost would be undercounted.
 */

/**
 * Whether a file uploads for free.
 *
 * @param fileSize - file size in bytes
 * @param freeLimit - the bundler's per-item free size cap (0 = no free tier)
 * @param bytesRemaining - the wallet's remaining free-tier bytes:
 *   a number = bytes left (0 = none), `null` = unlimited (exempt/partner wallet),
 *   `undefined` = unknown/not loaded (falls back to the size-only, advisory check).
 */
export function isFileFree(
  fileSize: number,
  freeLimit: number,
  bytesRemaining?: number | null,
): boolean {
  // Per-item size cap must pass first, and a free tier must exist.
  if (!(fileSize < freeLimit && freeLimit > 0)) return false;
  // Unknown (not loaded) or unlimited (exempt) → the size cap alone decides.
  if (bytesRemaining === undefined || bytesRemaining === null) return true;
  // Finite allowance: the file must fit within what's left (0 => never free).
  return fileSize <= bytesRemaining;
}

/**
 * Per-file free flags for a batch, consuming a finite free-tier allowance
 * cumulatively (greedy, in list order): once the remaining allowance can't cover
 * the next file, it and every later file is billable. Unlimited (`null`) or
 * unknown (`undefined`) reduces to the per-item size check with no drawdown, so
 * the exhausted (`0`) and unlimited cases stay exact.
 */
export function computeFreeFlags(
  sizes: number[],
  freeLimit: number,
  bytesRemaining?: number | null,
): boolean[] {
  let remaining = bytesRemaining;
  return sizes.map((size) => {
    const free = isFileFree(size, freeLimit, remaining);
    if (free && typeof remaining === 'number') remaining -= size;
    return free;
  });
}
