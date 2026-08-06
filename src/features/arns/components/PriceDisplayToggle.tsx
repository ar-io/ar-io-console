import { useStore } from '../../../store/useStore';
import type { PriceDisplayCurrency } from '../priceDisplay';

const OPTIONS: { label: string; value: PriceDisplayCurrency }[] = [
  { label: 'ARIO', value: 'ario' },
  { label: 'USD', value: 'usd' },
];

/**
 * Small, reusable segmented ARIO | USD pill bound to the app-wide
 * `priceDisplayCurrency` store preference. Styled after RecordFieldsEditor's
 * Arweave/IPFS toggle so it reads as native. Flipping it here re-labels every
 * priced surface that renders `PriceAmount`, and the choice persists across
 * reloads (see the store's `partialize`).
 */
export default function PriceDisplayToggle({
  className = '',
}: {
  className?: string;
}) {
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
