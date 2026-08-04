/**
 * Pure conversion + formatting for the ARIO ⇄ USD price-display toggle.
 *
 * No imports, no side-effects, no `Date`/`Math.random` — every function is
 * deterministic given its arguments so the whole module is node-testable. The
 * React layer (`PriceAmount`) supplies the live `usdPerArio` rate (from
 * `useArioUsdRate`) and the current `currency` preference (from the store); all
 * the actual math lives here.
 */

export type PriceDisplayCurrency = 'ario' | 'usd';

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
  currency,
  withUnit = true,
}: {
  ario: number | undefined;
  usdPerArio: number | undefined;
  currency: PriceDisplayCurrency;
  /**
   * Append the " ARIO" unit to the primary value. Set false for dense tables
   * where the unit is shown once (via the ARIO/USD toggle) instead of on every
   * cell — the disambiguating secondary "≈ …" line always keeps its unit.
   * The USD primary always keeps its "$" (a compact, universal prefix).
   */
  withUnit?: boolean;
}): PriceDisplay {
  if (ario == null || !Number.isFinite(ario)) {
    return { primary: '—' };
  }

  const usd = arioToUsd(ario, usdPerArio);
  const arioBare = formatArioAmount(ario);
  const arioStr = `${arioBare} ARIO`;

  if (currency === 'usd') {
    if (usd == null) {
      // Graceful fallback: no rate → show ARIO rather than a broken dollar value.
      return { primary: withUnit ? arioStr : arioBare };
    }
    return { primary: formatUsdAmount(usd), secondary: `≈ ${arioStr}` };
  }

  // currency === 'ario'
  return {
    primary: withUnit ? arioStr : arioBare,
    secondary: usd == null ? undefined : `≈ ${formatUsdAmount(usd)}`,
  };
}
