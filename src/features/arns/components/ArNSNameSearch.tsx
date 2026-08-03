import { Search, CheckCircle, XCircle, Loader2 } from 'lucide-react';

import useDebounce from '../../../hooks/useDebounce';
import { useArNSAvailability } from '../hooks/useArNSAvailability';
import { isValidArNSName } from '../utils';

interface ArNSNameSearchProps {
  value: string;
  onChange: (name: string) => void;
  /** Fired when a name is confirmed available and selected for purchase. */
  onSelect: (name: string) => void;
  /** The currently selected (locked-in) name, if any. */
  selectedName?: string;
}

/**
 * ArNS name search + on-chain availability check. Debounced; renders the
 * available/taken result and lets the user select an available name to buy.
 * Restyled to console's Tailwind house classes (from arns-react's search UX).
 */
export function ArNSNameSearch({
  value,
  onChange,
  onSelect,
  selectedName,
}: ArNSNameSearchProps) {
  const debounced = useDebounce(value);
  const invalidHyphens = /^-|-$/.test(value);
  const validName = isValidArNSName(debounced);

  const { data, isFetching, suggestions } = useArNSAvailability(debounced);
  const showResult = !!debounced && validName && !isFetching && !!data;
  const isSelected = selectedName === debounced;

  return (
    <div>
      <label className="block text-sm font-medium mb-3">Search for a name</label>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <div className="flex items-center border border-border/20 rounded-2xl bg-card focus-within:border-primary transition-colors">
            <Search className="w-4 h-4 text-foreground/50 ml-3 flex-shrink-0" />
            <input
              type="text"
              value={value}
              onChange={(e) => {
                const cleaned = e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, '');
                onChange(cleaned);
              }}
              className="flex-1 p-3 bg-transparent text-foreground font-mono focus:outline-none min-w-0"
              placeholder="my-awesome-app"
              spellCheck={false}
            />
            <div className="px-3 text-sm text-foreground/80 font-mono border-l border-border/20 flex-shrink-0">
              .ar.io
            </div>
          </div>
        </div>
      </div>

      {invalidHyphens && (
        <p className="mt-2 text-xs text-warning">
          ArNS names cannot start or end with a hyphen.
        </p>
      )}

      {isFetching && !!debounced && validName && (
        <div className="mt-4 flex items-center gap-2 text-sm text-foreground/70">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking availability…
        </div>
      )}

      {showResult && (
        <div
          className={`mt-4 p-4 rounded-2xl border ${
            data.available
              ? 'bg-card border-primary/30'
              : 'bg-error/10 border-error/20'
          }`}
        >
          {data.available ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="font-semibold text-foreground">
                  "{debounced}.ar.io" is available
                </span>
              </div>
              {isSelected ? (
                <span className="text-sm text-primary font-medium">
                  Selected
                </span>
              ) : (
                <button
                  onClick={() => onSelect(debounced)}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Select this name
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-error flex-shrink-0" />
                <span className="font-semibold text-error">
                  "{debounced}.ar.io" is {data.reserved ? 'reserved' : 'already taken'}
                </span>
              </div>
              {suggestions.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm text-foreground/80 mb-2">Try one of these instead:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => onChange(s)}
                        className="px-3 py-1.5 rounded-full bg-card border border-primary/30 text-sm font-mono text-foreground hover:bg-primary/10 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
