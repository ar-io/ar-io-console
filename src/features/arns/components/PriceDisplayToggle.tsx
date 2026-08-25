import { useStore } from '../../../store/useStore';
import type { PriceDisplayCurrency } from '../priceDisplay';

/**
 * `'ario'` is really "the native unit of whatever you're paying with" — ARIO on
 * the token path, credits on the Turbo path. The stored value keeps its name so
 * the persisted preference stays valid; only the label changes per surface.
 */
const usdOption = { label: 'USD', value: 'usd' as PriceDisplayCurrency };

/**
 * Small, reusable segmented ARIO | USD pill bound to the app-wide
 * `priceDisplayCurrency` store preference. Styled after RecordFieldsEditor's
 * Arweave/IPFS toggle so it reads as native. Flipping it here re-labels every
 * priced surface that renders `PriceAmount`, and the choice persists across
 * reloads (see the store's `partialize`).
 */
export default function PriceDisplayToggle({
  className = '',
  nativeLabel = 'ARIO',
}: {
  className?: string;
  /** Label for the non-USD side — "ARIO" or "Credits". */
  nativeLabel?: string;
}) {
  const OPTIONS: { label: string; value: PriceDisplayCurrency }[] = [
    { label: nativeLabel, value: 'ario' },
    usdOption,
  ];
  const currency = useStore((s) => s.priceDisplayCurrency);
  const setCurrency = useStore((s) => s.setPriceDisplayCurrency);

  return (
    <div
      className={`inline-flex rounded-full border border-border/20 bg-card p-1 ${className}`}
      role="group"
      aria-label="Price display currency"
    >
      {OPTIONS.map(({ label, value }) => {
        const active = currency === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setCurrency(value)}
            aria-pressed={active}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground/70 hover:text-foreground'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
