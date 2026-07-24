/**
 * Free-tier upload logic — pure, dependency-free so it stays node-testable.
 *
 * The bundler's free tier has two axes: a per-item size cap and the wallet's
 * remaining lifetime/IP allowance (via `getFreeStatus`). "Free" must satisfy both,
 * otherwise a wallet that has used up its allowance would be shown "FREE" and then
 * charged. When the remaining allowance is unknown, we fall back to the size-only
 * check (advisory) to preserve prior behavior.
 *
 * This is a per-file check against the FULL remaining allowance; it does not draw
 * down cumulatively across a multi-file batch. So the exhausted (`0`) and unlimited
 * (`null`) cases are exact, but a partial finite allowance straddled by a batch is
 * an approximation — acceptable because it's advisory and the bundler charges the
 * true amount at upload.
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
