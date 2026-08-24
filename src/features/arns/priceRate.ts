/**
 * The inclusive fee already deducted from a quoted winc amount, as a multiplier.
 *
 * Turbo's `/v1/price/*` endpoints answer "how much winc do I RECEIVE", so a
 * fiat quote comes back with the infrastructure fee already taken out
 * (`operator: "multiply", operatorMagnitude: 0.65` — you get 65%). Token quotes
 * come back with `fees: []`, fee-free.
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
 * `wincPerArio / wincPerUsd` looks like a rate but is not one: the ARIO leg is
 * fee-free and the USD leg is net of the ~35% infrastructure fee, so the raw
 * ratio overstates ARIO by 1/0.65 ≈ 1.54x. Measured against the live service, a
 * name priced at 1,734 ARIO rendered as $2.09 — the fee-inclusive CARD price —
 * when the tokens are worth $1.36. Paying in ARIO then looked identical to
 * paying by card, hiding the discount that is the whole reason to hold ARIO.
 *
 * Scaling the USD leg back to fee-free puts both sides in the same units.
 */
export function usdPerArioFromLegs({
  wincPerArio,
  wincPerUsd,
  usdFees,
}: {
  wincPerArio: number;
  wincPerUsd: number;
  usdFees?: Array<{ operator?: string; operatorMagnitude?: number }>;
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
  if (!Number.isFinite(feeFreeWincPerUsd) || feeFreeWincPerUsd <= 0) {
    return undefined;
  }
  return wincPerArio / feeFreeWincPerUsd;
}
