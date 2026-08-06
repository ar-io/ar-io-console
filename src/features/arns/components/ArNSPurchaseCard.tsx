import { useMemo, useState } from 'react';
import { Calendar, Infinity as InfinityIcon, Loader2, Wallet } from 'lucide-react';

import type { ArNSRegistrationType } from '../hooks/useArNSPrice';
import { useArNSPrice } from '../hooks/useArNSPrice';
import type { BuyArNSNameInput } from '../hooks/useBuyArNSName';

interface ArNSPurchaseCardProps {
  name: string;
  canBuy: boolean;
  isBusy: boolean;
  onBuy: (input: BuyArNSNameInput) => void;
}

const LEASE_YEAR_OPTIONS = [1, 2, 3, 4, 5];

/**
 * Registration configurator for a selected name: lease vs permabuy, lease term,
 * live price in Turbo Credits (+ USD estimate), and the buy action. Undername
 * count at purchase is intentionally deferred (Phase 1) — names start with the
 * protocol-default undername allotment.
 */
export function ArNSPurchaseCard({
  name,
  canBuy,
  isBusy,
  onBuy,
}: ArNSPurchaseCardProps) {
  const [type, setType] = useState<ArNSRegistrationType>('lease');
  const [years, setYears] = useState(1);

  const {
    data: price,
    isFetching: priceLoading,
    error: priceError,
  } = useArNSPrice({ name, type, years });

  const creditsLabel = useMemo(() => {
    if (!price) return null;
    return price.credits.toLocaleString(undefined, {
      maximumFractionDigits: 4,
    });
  }, [price]);

  const usdLabel = useMemo(() => {
    if (!price?.usd) return null;
    return price.usd.toLocaleString(undefined, {
      style: 'currency',
      currency: 'USD',
    });
  }, [price]);

  return (
    <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl border border-primary/30 p-4 sm:p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-lg font-bold font-heading text-foreground">
          Register{' '}
          <span className="font-mono text-primary">{name}.ar.io</span>
        </h3>
      </div>

      {/* Lease vs permabuy */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={() => setType('lease')}
          className={`flex items-center gap-2 p-3 rounded-2xl border transition-colors ${
            type === 'lease'
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border/20 bg-card text-foreground/70 hover:border-primary/40'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span className="font-medium">Lease</span>
        </button>
        <button
          onClick={() => setType('permabuy')}
          className={`flex items-center gap-2 p-3 rounded-2xl border transition-colors ${
            type === 'permabuy'
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border/20 bg-card text-foreground/70 hover:border-primary/40'
          }`}
        >
          <InfinityIcon className="w-4 h-4" />
          <span className="font-medium">Permabuy</span>
        </button>
      </div>

      {/* Lease term */}
      {type === 'lease' && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Lease term</label>
          <div className="flex flex-wrap gap-2">
            {LEASE_YEAR_OPTIONS.map((y) => (
              <button
                key={y}
                onClick={() => setYears(y)}
                className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                  years === y
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border/20 bg-card text-foreground/70 hover:border-primary/40'
                }`}
              >
                {y} {y === 1 ? 'year' : 'years'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Price */}
      <div className="bg-card rounded-2xl p-4 border border-border/20 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground/70">Cost</span>
          {priceLoading ? (
            <span className="flex items-center gap-2 text-sm text-foreground/70">
              <Loader2 className="w-4 h-4 animate-spin" /> Fetching price…
            </span>
          ) : priceError ? (
            <span className="text-sm text-error">Price unavailable</span>
          ) : creditsLabel ? (
            <div className="text-right">
              <div className="text-lg font-bold text-foreground">
                {creditsLabel} Credits
              </div>
              {usdLabel && (
                <div className="text-xs text-foreground/60">≈ {usdLabel}</div>
              )}
            </div>
          ) : (
            <span className="text-sm text-foreground/50">—</span>
          )}
        </div>
      </div>

      <button
        onClick={() =>
          onBuy({ name, type, years: type === 'lease' ? years : undefined })
        }
        disabled={!canBuy || isBusy || priceLoading || !price}
        className="w-full px-6 py-3 rounded-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isBusy ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Processing…
          </>
        ) : (
          <>
            <Wallet className="w-4 h-4" /> Buy with Turbo Credits
          </>
        )}
      </button>

      {!canBuy && (
        <p className="mt-3 text-xs text-center text-foreground/60">
          Connect a Solana wallet to pay with Turbo Credits.
        </p>
      )}
    </div>
  );
}
