/**
 * Pure conversion + formatting for the ArNS priced surfaces.
 *
 * No imports, no side-effects, no `Date`/`Math.random` — every function is
 * deterministic given its arguments so the whole module is node-testable. The
 * React layer (`PriceAmount`) supplies the live `usdPerArio` rate (from
 * `useArioUsdRate`); all the actual math lives here.
 *
 * Dollars lead, always. This used to swap primary and secondary based on a
 * user toggle, but both values were rendered either way — the control only
 * chose which one was bold, which is a thin reason to make someone operate a
 * switch. USD is the unit everyone can price against; the token amount is what
 * actually leaves the wallet, so it stays as the secondary line rather than
 * being hidden behind a preference.
 */

/**
 * Convert an ARIO amount to USD given `usdPerArio` (USD per 1 ARIO). Returns
 * `undefined` when either input is missing or non-finite, or when the rate is
 * not strictly positive — callers treat `undefined` as "no USD available" and
 * fall back to ARIO rather than render a broken value.
 */
export function arioToUsd(
  ario: number | undefined,
  usdPerArio: number | undefined,
): number | undefined {
  if (ario == null || !Number.isFinite(ario)) return undefined;
  if (usdPerArio == null || !Number.isFinite(usdPerArio) || usdPerArio <= 0) {
    return undefined;
  }
  return ario * usdPerArio;
}

/**
 * Format an ARIO amount. Mirrors the existing `fmtArio` rule used across the
 * returned-name surfaces: drop decimals at/above 100 (big round numbers), keep
 * up to 2 below, always with locale thousands separators.
 */
export function formatArioAmount(n: number): string {
  return n.toLocaleString(undefined, {
    maximumFractionDigits: n >= 100 ? 0 : 2,
  });
}

/**
 * Format a USD amount with adaptive sub-dollar precision so small prices don't
 * collapse to "$0.00": >= $1 → 2dp; >= $0.01 → up to 4dp; otherwise up to 6dp.
 * Always a leading '$' and a minimum of 2 decimal places.
 */
export function formatUsdAmount(n: number): string {
  const abs = Math.abs(n);
  const maximumFractionDigits = abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return (
    '$' +
    n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits,
    })
  );
}

export interface PriceDisplay {
  primary: string;
  secondary?: string;
}

/**
 * Build the primary/secondary strings for a priced surface given the ARIO
 * amount, the (optional) live USD rate, and the user's currency preference.
 *
 * - `ario` currency: primary = "N ARIO", secondary = "≈ $X" when the rate
 *   resolves (omitted otherwise).
 * - `usd` currency: primary = "$X", secondary = "≈ N ARIO" when the rate
 *   resolves; when it doesn't, gracefully falls back to an ARIO-only primary
 *   (never a broken "$—").
 * - Missing/non-finite `ario`: primary = '—', no secondary.
 */
export function formatPriceDisplay({
  ario,
  usdPerArio,
}: {
  ario: number | undefined;
  usdPerArio: number | undefined;
}): PriceDisplay {
  if (ario == null || !Number.isFinite(ario)) {
    return { primary: '—' };
  }

  const usd = arioToUsd(ario, usdPerArio);
  const arioStr = `${formatArioAmount(ario)} ARIO`;

  // No rate → show ARIO alone rather than a broken or absent number. The unit
  // is always kept here: a bare figure where dollars were expected reads as
  // dollars.
  if (usd == null) return { primary: arioStr };

  return { primary: formatUsdAmount(usd), secondary: `≈ ${arioStr}` };
}
