/**
 * Top Up's ARIO preset amounts, small first: at about $0.0015 per ARIO these
 * are about $1.50, $7, $15 and $36.
 */
export const ARIO_PRESETS: readonly number[] = [1_000, 5_000, 10_000, 25_000];

/**
 * Returns the ARIO presets that fit under the per-top-up cap. Any preset at or
 * above `maxTokens` is dropped and the cap itself offered in its place, so a
 * button never asks for more than the limit. With the rate still loading
 * (`maxTokens` undefined) the presets are returned unchanged; the panel blocks
 * Continue until the cap is known.
 */
export function arioPresetsFor(maxTokens: number | undefined): number[] {
  if (maxTokens === undefined) return [...ARIO_PRESETS];
  const under = ARIO_PRESETS.filter((a) => a < maxTokens);
  return under.length === ARIO_PRESETS.length ? under : [...under, maxTokens];
}
