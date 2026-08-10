import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Flame,
  Globe,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';

import useDebounce from '../../../hooks/useDebounce';
import {
  ReturnedNameSortKey,
  ReturnedNameSortOrder,
  useReturnedNames,
  useReturnedNamePriceInputs,
} from '../hooks/useReturnedNames';
import type { ReturnedNameRecord } from '../hooks/useReturnedNames';
import {
  auctionMultiplier,
  baseAnnualMARIOForName,
  estimateReturnedNameArio,
  formatCountdown,
} from '../returnedNamePricing';
import {
  returnedNameOrigin,
  useArnsSettingsPda,
} from '../hooks/useArnsSettingsPda';
import PriceAmount from './PriceAmount';
import PriceDisplayToggle from './PriceDisplayToggle';
import ReturnedNameBuyModal from './ReturnedNameBuyModal';
import { toUnicodeName } from '../../../utils/punycode';

const PAGE_SIZE = 25;

/** Color-grade the premium badge by magnitude so high premiums draw attention. */
function premiumClasses(multiplier: number): string {
  if (multiplier >= 10) return 'bg-error/15 text-error';
  if (multiplier >= 3) return 'bg-warning/15 text-warning';
  return 'bg-primary/15 text-primary';
}

export default function ReturnedNamesPanel() {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput);
  const [sortBy, setSortBy] = useState<ReturnedNameSortKey>('endTimestamp');
  const [sortOrder, setSortOrder] = useState<ReturnedNameSortOrder>('asc');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ReturnedNameRecord | undefined>();

  // Live now-tick so premium + countdown decay on screen.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const resetPage = () => setPage(0);

  const {
    items,
    activeCount,
    totalFiltered,
    pageCount,
    safePage,
    loading,
    error,
    refresh,
  } = useReturnedNames({
    search,
    sortBy,
    sortOrder,
    page,
    pageSize: PAGE_SIZE,
    now,
  });

  const { data: priceInputs } = useReturnedNamePriceInputs();
  const settingsPda = useArnsSettingsPda();

  const toggleSort = (key: ReturnedNameSortKey) => {
    if (sortBy === key) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      // Sensible default direction per column.
      setSortOrder(key === 'name' ? 'asc' : key === 'premiumMultiplier' ? 'desc' : 'asc');
    }
    resetPage();
  };

  const SortHeader = ({
    label,
    keyName,
  }: {
    label: string;
    keyName: ReturnedNameSortKey;
  }) => (
    <button
      onClick={() => toggleSort(keyName)}
      className="flex items-center gap-1 font-semibold text-foreground/70 transition-colors hover:text-foreground"
    >
      {label}
      {sortBy === keyName &&
        (sortOrder === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        ))}
    </button>
  );

  // Derive the label from `safePage` (the actually-shown page) rather than the
  // raw `page` state, which can sit beyond the set after it shrinks on the live
  // tick — otherwise the label reads nonsensically (e.g. "76–30 of 30").
  const rangeLabel = useMemo(() => {
    if (totalFiltered === 0) return '0';
    const start = safePage * PAGE_SIZE + 1;
    const end = Math.min((safePage + 1) * PAGE_SIZE, totalFiltered);
    return `${start.toLocaleString()}–${end.toLocaleString()} of ${totalFiltered.toLocaleString()}`;
  }, [safePage, totalFiltered]);

  // Estimated ARIO price for a row's current premium, or undefined when the fee
  // schedule isn't loaded/usable — PriceAmount renders '—' for undefined.
  const estPriceArio = (
    r: ReturnedNameRecord,
    multiplier: number,
  ): number | undefined => {
    if (!priceInputs) return undefined;
    const base = baseAnnualMARIOForName(priceInputs.fees, r.name.length);
    if (base == null) return undefined;
    const ario = estimateReturnedNameArio(base, priceInputs.demandFactor, multiplier);
    return Number.isFinite(ario) ? ario : undefined;
  };

  return (
    <div className="px-4 sm:px-6">
      {/* Header */}
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/20">
          <Flame className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="mb-1 font-heading text-2xl font-bold text-foreground">
            Returned Name Auctions
          </h3>
          <p className="text-sm text-foreground/80">
            Recently expired or released names, buyable now at a premium that
            decays over time
            {activeCount > 0 && (
              <>
                {' '}
                —{' '}
                <span className="font-semibold text-foreground">
                  {activeCount.toLocaleString()}
                </span>{' '}
                up for auction
              </>
            )}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <PriceDisplayToggle />
          <button
            onClick={refresh}
            disabled={loading}
            title="Refresh auctions"
            className="flex items-center gap-2 rounded-full border border-border/20 bg-card px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-primary/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="flex items-center rounded-2xl border border-border/20 bg-card transition-colors focus-within:border-primary">
          <Search className="ml-3 h-4 w-4 flex-shrink-0 text-foreground/50" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
              resetPage();
            }}
            className="min-w-0 flex-1 bg-transparent p-3 font-mono text-foreground focus:outline-none"
            placeholder="Filter names…"
            aria-label="Filter returned names"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('');
                resetPage();
              }}
              className="px-3 text-sm text-foreground/60 hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border/20 bg-card">
        {/* Column headers (hidden on mobile) */}
        <div className="hidden grid-cols-12 gap-3 border-b border-border/20 px-4 py-3 text-xs sm:grid">
          <div className="col-span-4">
            <SortHeader label="Name" keyName="name" />
          </div>
          <div className="col-span-2">
            <SortHeader label="Premium" keyName="premiumMultiplier" />
          </div>
          <div className="col-span-2">
            <SortHeader label="Ends in" keyName="endTimestamp" />
          </div>
          <div className="col-span-2 font-semibold text-foreground/70">Est. price</div>
          <div className="col-span-2 text-right font-semibold text-foreground/70">
            Action
          </div>
        </div>

        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-foreground/60">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading auctions…
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-foreground/60">
            {search
              ? `No auctions match "${search}".`
              : 'No names are up for auction right now.'}
          </div>
        ) : (
          items.map((r) => {
            const multiplier = auctionMultiplier({
              startTimestamp: r.startTimestamp,
              endTimestamp: r.endTimestamp,
              now,
            });
            const remaining = Math.max(0, r.endTimestamp - now);
            return (
              <div
                key={r.name}
                className="grid grid-cols-2 items-center gap-2 border-b border-border/10 px-4 py-3 transition-colors last:border-0 hover:bg-primary/5 sm:grid-cols-12 sm:gap-3"
              >
                {/* Name */}
                <div className="col-span-2 min-w-0 sm:col-span-4">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 flex-shrink-0 text-primary" />
                    <span className="truncate font-heading font-bold text-foreground">
                      {toUnicodeName(r.name)}
                    </span>
                    <span className="flex-shrink-0 text-sm text-foreground/50">
                      .ar.io
                    </span>
                  </div>
                  {(() => {
                    const origin = returnedNameOrigin(r.initiator, settingsPda);
                    return origin ? (
                      <span className="ml-6 text-xs text-foreground/50">
                        {origin}
                      </span>
                    ) : null;
                  })()}
                </div>

                {/* Premium */}
                <div className="col-span-2 flex items-center justify-between sm:col-span-2 sm:block">
                  <span className="text-xs text-foreground/50 sm:hidden">Premium</span>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${premiumClasses(
                      multiplier,
                    )}`}
                  >
                    {multiplier.toFixed(1)}x
                  </span>
                </div>

                {/* Ends in */}
                <div className="col-span-2 flex items-center justify-between text-sm text-foreground/80 sm:col-span-2 sm:block">
                  <span className="text-xs text-foreground/50 sm:hidden">Ends in</span>
                  <span>{formatCountdown(remaining)}</span>
                </div>

                {/* Est. price */}
                <div className="col-span-2 flex items-center justify-between font-mono text-sm text-foreground/80 sm:col-span-2 sm:block">
                  <span className="font-sans text-xs text-foreground/50 sm:hidden">Est. price</span>
                  <PriceAmount
                    ario={estPriceArio(r, multiplier)}
                    compact
                    unit={false}
                    primaryClassName="text-sm text-foreground/80 tabular-nums"
                  />
                </div>

                {/* Action */}
                <div className="col-span-2 flex items-center justify-end sm:col-span-2">
                  <button
                    onClick={() => setSelected(r)}
                    disabled={remaining <= 0}
                    className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Buy
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalFiltered > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-foreground/60">{rangeLabel}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage === 0}
              className="rounded-full border border-border/20 bg-card px-4 py-2 text-foreground/80 transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-1 text-foreground/60">
              {safePage + 1} / {pageCount}
            </span>
            <button
              onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
              disabled={safePage >= pageCount - 1}
              className="rounded-full border border-border/20 bg-card px-4 py-2 text-foreground/80 transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selected && (
        <ReturnedNameBuyModal
          name={selected.name}
          startTimestamp={selected.startTimestamp}
          endTimestamp={selected.endTimestamp}
          onClose={() => {
            setSelected(undefined);
            refresh();
          }}
        />
      )}
    </div>
  );
}
