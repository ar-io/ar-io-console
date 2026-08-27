/**
 * Token amount needed to buy a given number of winc, rounded UP.
 *
 * The conversion is integer division, so an exact answer lands just BELOW the
 * target. That is harmless for a display estimate and harmful when the number
 * is what we charge: the top-up buys a fraction too few credits, and the
 * purchase it was funding fails for want of that fraction — after the user has
 * already paid.
 *
 * Extracted from the hook so the rounding rule itself can be pinned; the hook
 * does the same arithmetic against a live rate.
 */
export function tokenUnitsForWinc({
  winc,
  wincPerToken,
  tokenSmallestUnit,
  roundUp,
}: {
  winc: bigint;
  wincPerToken: bigint;
  tokenSmallestUnit: bigint;
  roundUp: boolean;
}): bigint {
  if (wincPerToken <= 0n) return 0n;
  const numerator = winc * tokenSmallestUnit;
  const floor = numerator / wincPerToken;
  return roundUp && numerator % wincPerToken !== 0n ? floor + 1n : floor;
}
