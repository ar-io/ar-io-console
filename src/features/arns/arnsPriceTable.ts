/**
 * Pure, dependency-free helpers for the ArNS fee-schedule table.
 *
 * No imports, no side-effects, no `Date`/`Math.random` — every function is
 * deterministic given its arguments so the whole module is node-testable
 * without dragging in `@solana/web3.js` (which `../utils` pulls in). Mirrors the
 * character-length bucketing that `useArNSPricing` applies to the registration
 * fee schedule: names longer than 12 characters all share one collapsed tier
 * (keyed as character length `13`).
 */

/** Longest character length that gets its own dedicated pricing tier. */
export const MAX_TIER_CHAR_LENGTH = 12;

/**
 * Map a name's raw character length onto its pricing tier bucket:
 * - 1..12 → itself (one tier per length),
 * - > 12 → 13 (the collapsed "13+ characters" tier),
 * - non-positive / non-finite input → 0 (no tier).
 *
 * Fractional lengths are floored so only whole-character counts are bucketed.
 */
export function bucketCharacterLength(length: number): number {
  if (!Number.isFinite(length) || length <= 0) return 0;
  const n = Math.floor(length);
  return n > MAX_TIER_CHAR_LENGTH ? 13 : n;
}

/**
 * Index of the tier that a name of `length` characters falls into, given the
 * tiers' `characterLength` values (in the order they are rendered). Returns -1
 * when the length is invalid or no tier matches its bucket.
 */
export function findTierIndexForLength(
  length: number,
  tierCharacterLengths: number[],
): number {
  const bucket = bucketCharacterLength(length);
  if (bucket === 0) return -1;
  return tierCharacterLengths.findIndex((c) => c === bucket);
}

/** Short "Characters" column label for a tier: numeric, or "13+" for the collapsed tier. */
export function formatTierCharacterLabel(characterLength: number): string {
  return characterLength >= 13 ? '13+' : String(characterLength);
}
