import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useArNSPricing } from '@/hooks/useArNSPricing';
import { useStore } from '@/store/useStore';
import { isValidArNSName, lowerCaseDomain } from '../utils';
import {
  arnsUndernameFees,
  findTierIndexForLength,
  formatTierCharacterLabel,
} from '../arnsPriceTable';
import PriceAmount from './PriceAmount';
import PriceDisplayToggle from './PriceDisplayToggle';

/**
 * ArNS fee-schedule table: registration price by name character length.
 *
 * Backed entirely by `useArNSPricing()` — one tier per character length (1..12)
 * plus a collapsed "13+" tier, each carrying the 1-year lease and permabuy price
 * in ARIO (demand factor already baked in). We feed the ARIO amount to the
 * shared `PriceAmount`, which converts to USD via the live `useArioUsdRate`
 * when the app-wide `PriceDisplayToggle` is set to USD — so this surface never
 * hardcodes a rate and stays in sync with every other priced surface.
 *
 * A name-lookup input highlights the row whose character bucket matches the
 * typed name (via the pure `findTierIndexForLength` helper), and a subtle chip
 * surfaces the current network demand factor.
 */
export default function ArNSPriceTable() {
  const { pricingTiers, loading, error, demandFactor } = useArNSPricing();
  const currency = useStore((s) => s.priceDisplayCurrency);
  const [nameQuery, setNameQuery] = useState('');

  const trimmed = lowerCaseDomain(nameQuery);
  const validQuery = trimmed.length > 0 && isValidArNSName(trimmed);

  const highlightIndex = useMemo(
    () =>
      validQuery
        ? findTierIndexForLength(
            trimmed.length,
            pricingTiers.map((t) => t.characterLength),
          )
        : -1,
    [validQuery, trimmed, pricingTiers],
  );

  return (
    // Full-width container matching the storage PricingCalculatorPanel — the
    // page-level "Pricing" header already titles this, so no sub-header here.
    <div className="px-4 sm:px-6">
      {/* Controls: name lookup + demand factor + currency toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="w-full sm:max-w-xs">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
            <input
              type="text"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Enter a name to see its price"
              aria-label="Enter a name to see its price"
              className="w-full rounded-full border border-border/20 bg-card pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary"
            />
          </div>
          {validQuery && highlightIndex >= 0 && (
            <p className="text-xs text-foreground/60 mt-1 px-1">
              {trimmed.length}-character name — highlighted below
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!loading && Number.isFinite(demandFactor) && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
              title="A network-wide price multiplier that rises when many names are being registered and eases back over time. It's already included in the prices below."
            >
              Demand factor:{' '}
              {demandFactor.toLocaleString(undefined, {
                maximumFractionDigits: 3,
              })}
            </span>
          )}
          <PriceDisplayToggle />
        </div>
      </div>

      {/* Card — matches the storage panel's card (p-4 sm:p-6) */}
      <div className="bg-card rounded-2xl border border-border/20 p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="py-12 text-center text-sm text-foreground/60">
            {error}
          </div>
        ) : pricingTiers.length === 0 ? (
          <div className="py-12 text-center text-sm text-foreground/60">
            No pricing available right now.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <p className="mb-2 px-3 text-right text-xs text-foreground/50">
              Amounts in {currency === 'usd' ? 'USD' : 'ARIO'}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-foreground/60 border-b border-border/20">
                  <th className="py-2 px-3 font-semibold">Characters</th>
                  <th className="py-2 px-3 font-semibold text-right">
                    1-year lease
                  </th>
                  <th className="py-2 px-3 font-semibold text-right">
                    Renewal / yr
                  </th>
                  <th className="py-2 px-3 font-semibold text-right">
                    Permabuy
                  </th>
                  <th
                    className="py-2 px-3 font-semibold text-right"
                    title="Cost to add one undername (label.name.ar.io) to a leased name"
                  >
                    + Undername
                  </th>
                  <th
                    className="py-2 px-3 font-semibold text-right"
                    title="Cost to add one undername to a permanently-owned name"
                  >
                    + Undername (perm.)
                  </th>
                </tr>
              </thead>
              <tbody>
                {pricingTiers.map((tier, i) => (
                  <tr
                    key={tier.characterLength}
                    className={`border-b border-border/10 ${
                      i === highlightIndex ? 'bg-primary/10' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-medium text-foreground">
                      {formatTierCharacterLabel(tier.characterLength)}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex justify-end">
                        <PriceAmount
                          ario={tier.pricesInARIO.year1}
                          compact
                          unit={false}
                          primaryClassName="text-sm font-semibold text-foreground tabular-nums"
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex justify-end">
                        {/* Marginal cost of one extra lease year = year2 − year1. */}
                        <PriceAmount
                          ario={Math.max(
                            0,
                            tier.pricesInARIO.year2 - tier.pricesInARIO.year1,
                          )}
                          compact
                          unit={false}
                          primaryClassName="text-sm font-medium text-foreground/80 tabular-nums"
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex justify-end">
                        <PriceAmount
                          ario={tier.pricesInARIO.permabuy}
                          compact
                          unit={false}
                          primaryClassName="text-sm font-semibold text-foreground tabular-nums"
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex justify-end">
                        <PriceAmount
                          ario={arnsUndernameFees(tier.pricesInARIO.year1).lease}
                          compact
                          unit={false}
                          primaryClassName="text-sm font-medium text-foreground/80 tabular-nums"
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex justify-end">
                        <PriceAmount
                          ario={
                            arnsUndernameFees(tier.pricesInARIO.year1).permabuy
                          }
                          compact
                          unit={false}
                          primaryClassName="text-sm font-medium text-foreground/80 tabular-nums"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
