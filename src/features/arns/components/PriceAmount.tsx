import { useArioUsdRate } from '../../../hooks/useCryptoPrice';
import { useStore } from '../../../store/useStore';
import { formatPriceDisplay } from '../priceDisplay';

/**
 * Presentational price line for the ArNS priced surfaces. Reads the app-wide
 * `priceDisplayCurrency` preference, pulls the live ARIO→USD rate once (React
 * Query dedupes the single request across every mounted instance), and renders
 * the `formatPriceDisplay` output: a bold primary value plus, unless `compact`,
 * a small muted secondary ("≈ …") line. Degrades to ARIO-only when the rate is
 * unavailable, and to '—' when there's no amount.
 *
 * `ario` is the ARIO amount to show; the component owns the currency + rate so
 * the ~3 call sites stay simple and stay in sync.
 */
export default function PriceAmount({
  ario,
  compact = false,
  unit = true,
  className = '',
  primaryClassName = 'text-lg font-bold text-foreground',
}: {
  ario?: number;
  /** Hide the secondary "≈ …" line (for tight table cells). */
  compact?: boolean;
  /** Append the " ARIO" unit to the value. Off for dense tables where the unit
   *  is shown once via the ARIO/USD toggle. USD keeps its "$". */
  unit?: boolean;
  className?: string;
  /** Classes for the primary value (defaults to the cost-breakdown style). */
  primaryClassName?: string;
}) {
  const currency = useStore((s) => s.priceDisplayCurrency);
  const usdPerArio = useArioUsdRate();

  const { primary, secondary } = formatPriceDisplay({
    ario,
    usdPerArio,
    currency,
    withUnit: unit,
  });

  return (
    <span className={`inline-flex flex-col items-end ${className}`}>
      <span className={primaryClassName}>{primary}</span>
      {!compact && secondary && (
        <span className="text-xs text-foreground/50">{secondary}</span>
      )}
    </span>
  );
}
