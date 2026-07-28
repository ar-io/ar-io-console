/**
 * Exact fixed-point formatting for smallest-unit token amounts — pure, dependency-free,
 * node-testable. Uses BigInt so 18-decimal values (wei) don't lose precision the way
 * `Number(quantity) / 10 ** decimals` does above Number.MAX_SAFE_INTEGER (~9e15).
 */

/**
 * Format an integer `quantity` of a token's smallest unit as a human decimal string.
 *
 * @param quantity - the amount in smallest units, as an integer string (e.g. wei)
 * @param decimals - the token's decimal places (e.g. 18 for ETH, 6 for USDC)
 * @param maxFractionDigits - cap the fractional digits (truncated, not rounded); omit for full precision
 * @returns the decimal string with trailing zeros trimmed, or `null` if `quantity`
 *          isn't a valid integer string.
 */
export function formatUnitsExact(
  quantity: string,
  decimals: number,
  maxFractionDigits?: number,
): string | null {
  // Caller-config errors (vs. bad data): fail loudly instead of via a cryptic
  // BigInt RangeError (e.g. `10n ** BigInt(-1)`) deeper in the function.
  if (!Number.isSafeInteger(decimals) || decimals < 0) {
    throw new RangeError(`formatUnitsExact: decimals must be a non-negative safe integer, got ${decimals}`);
  }
  if (
    maxFractionDigits !== undefined &&
    (!Number.isSafeInteger(maxFractionDigits) || maxFractionDigits < 0)
  ) {
    throw new RangeError(
      `formatUnitsExact: maxFractionDigits must be a non-negative safe integer, got ${maxFractionDigits}`,
    );
  }

  const s = quantity.trim();
  // Validate first: BigInt('') is 0n and BigInt(' ') throws — a regex is unambiguous.
  if (!/^-?\d+$/.test(s)) return null;
  const q = BigInt(s);

  const negative = q < 0n;
  const abs = negative ? -q : q;
  const divisor = 10n ** BigInt(decimals);
  const intPart = (abs / divisor).toString();

  let frac = decimals > 0 ? (abs % divisor).toString().padStart(decimals, '0') : '';
  if (maxFractionDigits !== undefined && frac.length > maxFractionDigits) {
    frac = frac.slice(0, maxFractionDigits); // truncate — never overstate the amount
  }
  frac = frac.replace(/0+$/, ''); // trim trailing zeros

  const sign = negative ? '-' : '';
  return frac ? `${sign}${intPart}.${frac}` : `${sign}${intPart}`;
}
