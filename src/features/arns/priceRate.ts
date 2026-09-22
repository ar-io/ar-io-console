/**
 * The inclusive fee already deducted from a quoted winc amount, as a multiplier.
 *
 * Turbo's `/v1/price/*` endpoints answer "how much winc do I RECEIVE", so a
 * fiat quote comes back with the infrastructure fee already taken out
 * (`operator: "multiply", operatorMagnitude: 0.65` — you get 65%). Token quotes
 * carry a fee too, and not always the same one: AR and SOL match the fiat rate,
 * while ARIO's is lower, and was zero until recently. The rate is service
 * config and changes without a release, so never assume it — read `fees` on
 * each response.
 *
 * That asymmetry is a trap for any rate built by dividing one leg by the other:
 * the fee survives in the ratio instead of cancelling. Returns 1 when there is
 * nothing to undo, so a fee-free response is a no-op.
 */
export function inclusiveFeeMultiplier(
  fees: Array<{ operator?: string; operatorMagnitude?: number }> | undefined,
): number {
  if (!fees?.length) return 1;
  let m = 1;
  for (const fee of fees) {
    // Only multiplicative fees can be undone by scaling. An additive fee is not
    // a rate adjustment and must not be folded into one.
    if (fee.operator !== 'multiply') continue;
    const mag = fee.operatorMagnitude;
    if (typeof mag !== 'number' || !Number.isFinite(mag) || mag <= 0) continue;
    m *= mag;
  }
  return m > 0 ? m : 1;
}

/**
 * USD value of one ARIO, with both legs on the same fee footing.
 *
 * `wincPerArio / wincPerUsd` looks like a rate but is not one: each leg comes
 * back net of whatever infrastructure fee its currency carries, and the two
 * currencies carry different fees (35% on USD, 25% on ARIO), so a raw ratio
 * keeps the difference instead of cancelling it. When ARIO was fee-free that
 * overstated ARIO by 1/0.65 ≈ 1.54x — a name priced at 1,734 ARIO rendered as
 * $2.09, the fee-inclusive CARD price, when the tokens were worth $1.36.
 *
 * So both legs are scaled back to fee-free, each by its own quote's fees. Doing
 * only the USD leg was right while ARIO paid nothing, and silently wrong by
 * exactly ARIO's own multiplier the moment it paid something. An absent or
 * empty fee list is a multiplier of 1, so this is a no-op for a fee-free leg.
 */
export function usdPerArioFromLegs({
  wincPerArio,
  wincPerUsd,
  usdFees,
  arioFees,
}: {
  wincPerArio: number;
  wincPerUsd: number;
  usdFees?: Array<{ operator?: string; operatorMagnitude?: number }>;
  arioFees?: Array<{ operator?: string; operatorMagnitude?: number }>;
}): number | undefined {
  if (
    !Number.isFinite(wincPerArio) ||
    !Number.isFinite(wincPerUsd) ||
    wincPerArio <= 0 ||
    wincPerUsd <= 0
  ) {
    return undefined;
  }
  const feeFreeWincPerUsd = wincPerUsd / inclusiveFeeMultiplier(usdFees);
  const feeFreeWincPerArio = wincPerArio / inclusiveFeeMultiplier(arioFees);
  if (
    !Number.isFinite(feeFreeWincPerUsd) ||
    feeFreeWincPerUsd <= 0 ||
    !Number.isFinite(feeFreeWincPerArio) ||
    feeFreeWincPerArio <= 0
  ) {
    return undefined;
  }
  return feeFreeWincPerArio / feeFreeWincPerUsd;
}
