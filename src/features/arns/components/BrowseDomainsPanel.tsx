import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Clock,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { daysRemaining } from '../../../utils';
import {
  AllArNSSortKey,
  SortOrder,
  useAllArNSNames,
} from '../hooks/useAllArNSNames';
import useDebounce from '../../../hooks/useDebounce';

const PAGE_SIZE = 25;
const EXPIRING_WINDOW_DAYS = 60;

const shortId = (id: string) => (id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id);

export default function BrowseDomainsPanel() {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput);
  const [sortBy, setSortBy] = useState<AllArNSSortKey>('startTimestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(0);
  const [expiringOnly, setExpiringOnly] = useState(false);

  // Reset to first page whenever the query or sort changes.
  const resetPage = () => setPage(0);

  const toggleExpiring = () => {
    setExpiringOnly((on) => {
      const next = !on;
      // Expiring view is only meaningful sorted by soonest expiry.
      if (next) {
        setSortBy('endTimestamp');
        setSortOrder('asc');
      } else {
        setSortBy('startTimestamp');
        setSortOrder('desc');
      }
      return next;
    });
    resetPage();
  };

  const {
    items,
    totalItems,
    totalFiltered,
    pageCount,
    loading,
    error,
    targets,
    resolveTarget,
    refresh,
  } = useAllArNSNames({
    search,
    sortBy,
    sortOrder,
    page,
    pageSize: PAGE_SIZE,
    expiringWithinDays: expiringOnly ? EXPIRING_WINDOW_DAYS : undefined,
  });

  const toggleSort = (key: AllArNSSortKey) => {
    if (sortBy === key) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      // Sensible default direction per column.
      setSortOrder(key === 'name' || key === 'type' ? 'asc' : 'desc');
    }
    resetPage();
  };

  const SortHeader = ({ label, keyName }: { label: string; keyName: AllArNSSortKey }) => (
    <button
      onClick={() => toggleSort(keyName)}
      className="flex items-center gap-1 font-semibold text-foreground/70 hover:text-foreground transition-colors"
    >
      {label}
      {sortBy === keyName &&
        (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
    </button>
  );

  const rangeLabel = useMemo(() => {
    if (totalFiltered === 0) return '0';
    const start = page * PAGE_SIZE + 1;
    const end = Math.min((page + 1) * PAGE_SIZE, totalFiltered);
    return `${start.toLocaleString()}–${end.toLocaleString()} of ${totalFiltered.toLocaleString()}`;
  }, [page, totalFiltered]);

  return (
    <div className="px-4 sm:px-6">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 bg-primary/20 rounded-2xl flex items-center justify-center flex-shrink-0 mt-1">
          <Globe className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-2xl font-bold font-heading text-foreground mb-1">Browse Domains</h3>
          <p className="text-sm text-foreground/80">
            Explore every ArNS name registered on the ar.io network
            {totalItems > 0 && (
              <>
                {' '}
                — <span className="font-semibold text-foreground">{totalItems.toLocaleString()}</span> registered
              </>
            )}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          title="Refresh registry"
          className="flex items-center gap-2 px-3 py-2 rounded-full bg-card border border-border/20 text-sm text-foreground/80 hover:bg-primary/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="flex items-center border border-border/20 rounded-2xl bg-card focus-within:border-primary transition-colors">
          <Search className="w-4 h-4 text-foreground/50 ml-3 flex-shrink-0" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
              resetPage();
            }}
            className="flex-1 p-3 bg-transparent text-foreground font-mono focus:outline-none min-w-0"
            placeholder="Filter names…"
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

        {/* Quick filters */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            onClick={() => expiringOnly && toggleExpiring()}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              !expiringOnly
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-foreground/70 border-border/20 hover:bg-primary/10'
            }`}
          >
            All
          </button>
          <button
            onClick={() => !expiringOnly && toggleExpiring()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              expiringOnly
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-foreground/70 border-border/20 hover:bg-primary/10'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Expiring soon
          </button>
          {expiringOnly && (
            <span className="text-xs text-foreground/60">
              Leases expiring within {EXPIRING_WINDOW_DAYS} days, soonest first
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-2xl bg-error/10 border border-error/20 text-sm text-error">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border/20 overflow-hidden">
        {/* Column headers (hidden on mobile) */}
        <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-3 border-b border-border/20 text-xs">
          <div className="col-span-4">
            <SortHeader label="Name" keyName="name" />
          </div>
          <div className="col-span-2">
            <SortHeader label="Type" keyName="type" />
          </div>
          <div className="col-span-3">
            <SortHeader label="Registered" keyName="startTimestamp" />
          </div>
          <div className="col-span-2">
            <SortHeader label="Expires" keyName="endTimestamp" />
          </div>
          <div className="col-span-1 text-right font-semibold text-foreground/70">Links</div>
        </div>

        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-foreground/60">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading registry…
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-foreground/60 text-sm">
            {search ? `No names match "${search}".` : 'No names found.'}
          </div>
        ) : (
          items.map((r) => {
            const target = targets[r.processId];
            return (
              <div
                key={r.name}
                className="grid grid-cols-2 sm:grid-cols-12 gap-2 sm:gap-3 px-4 py-3 border-b border-border/10 last:border-0 items-center hover:bg-primary/5 transition-colors"
              >
                {/* Name */}
                <div className="col-span-2 sm:col-span-4 min-w-0">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="font-heading font-bold text-foreground truncate">{r.name}</span>
                    <span className="text-foreground/50 text-sm flex-shrink-0">.ar.io</span>
                  </div>
                  <button
                    onClick={() => resolveTarget(r.processId)}
                    className="mt-0.5 text-xs text-foreground/50 font-mono hover:text-primary transition-colors block truncate max-w-full"
                    title="Resolve current target"
                  >
                    {target === undefined
                      ? `→ ${shortId(r.processId)} (resolve target)`
                      : target === null
                        ? '→ no target set'
                        : `→ ${shortId(target)}`}
                  </button>
                </div>

                {/* Type */}
                <div className="sm:col-span-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.type === 'permabuy'
                        ? 'bg-primary/15 text-primary'
                        : 'bg-foreground/10 text-foreground/80'
                    }`}
                  >
                    {r.type === 'permabuy' ? 'Permanent' : 'Lease'}
                  </span>
                </div>

                {/* Registered */}
                <div className="sm:col-span-3 text-sm text-foreground/80">
                  {r.startTimestamp ? new Date(r.startTimestamp).toLocaleDateString() : '—'}
                </div>

                {/* Expires */}
                <div className="sm:col-span-2 text-sm text-foreground/80">
                  {r.type === 'permabuy'
                    ? 'Never'
                    : r.endTimestamp
                      ? `${daysRemaining(new Date(r.endTimestamp))}d`
                      : '—'}
                </div>

                {/* Links */}
                <div className="col-span-2 sm:col-span-1 flex items-center justify-end gap-2">
                  <a
                    href={`https://${r.name}.ar.io`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Visit"
                    className="p-2 rounded-full hover:bg-primary/10 text-foreground/70 hover:text-primary transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalFiltered > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-foreground/60">{rangeLabel}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-4 py-2 rounded-full bg-card border border-border/20 text-foreground/80 hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-foreground/60 px-1">
              {page + 1} / {pageCount}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              className="px-4 py-2 rounded-full bg-card border border-border/20 text-foreground/80 hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
