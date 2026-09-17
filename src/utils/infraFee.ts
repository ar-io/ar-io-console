import { inclusiveFeeMultiplier } from '../features/arns/priceRate';

/**
 * Turbo's infrastructure fee as a percentage of what the buyer pays.
 *
 * Read from the `fees` on one of Turbo's own price quotes ("Turbo
 * Infrastructure Fee", `operator: "multiply"`, `operatorMagnitude: 0.65` — the
 * buyer receives 65% of the payment as credits). The fee is inclusive: it is
 * already inside the ar.io rate, so 35% here means 35% OF that rate, not 35%
 * on top of the network cost.
 *
 * Undefined when the quote carried no `fees` array at all — an unknown fee is
 * not a zero fee. An empty array is a real answer: nothing was deducted.
 */
export function infraFeePercent(
  fees: Array<{ operator?: string; operatorMagnitude?: number }> | undefined,
): number | undefined {
  if (!Array.isArray(fees)) return undefined;
  return (1 - inclusiveFeeMultiplier(fees)) * 100;
}

/**
 * "35%", or "35.5%" when the fee isn't a whole number. "—" when unknown.
 */
export function formatFeePercent(percent: number | undefined): string {
  if (percent === undefined || !Number.isFinite(percent)) return '—';
  const whole = Math.round(percent);
  return Math.abs(percent - whole) < 0.05 ? `${whole}%` : `${percent.toFixed(1)}%`;
}
