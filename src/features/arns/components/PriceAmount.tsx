import { useArioUsdRate } from '../../../hooks/useCryptoPrice';
import { formatPriceDisplay } from '../priceDisplay';

/**
 * Presentational price line for the ArNS priced surfaces. Pulls the live
 * ARIO→USD rate once (React
 * Query dedupes the single request across every mounted instance), and renders
 * the `formatPriceDisplay` output: a bold primary value plus a small muted
 * secondary ("≈ …") line. Degrades to ARIO-only when the rate is
 * unavailable, and to '—' when there's no amount.
 *
 * `ario` is the ARIO amount to show; the component owns the currency + rate so
 * the ~3 call sites stay simple and stay in sync.
 */
export default function PriceAmount({
  ario,
  className = '',
  primaryClassName = 'text-lg font-bold text-foreground',
}: {
  ario?: number;
  className?: string;
  /** Classes for the primary value (defaults to the cost-breakdown style). */
  primaryClassName?: string;
}) {
  const usdPerArio = useArioUsdRate();

  const { primary, secondary } = formatPriceDisplay({ ario, usdPerArio });

  return (
    <span className={`inline-flex flex-col items-end ${className}`}>
      <span className={primaryClassName}>{primary}</span>
      {secondary && (
        <span className="text-xs text-foreground/50">{secondary}</span>
      )}
    </span>
  );
}
