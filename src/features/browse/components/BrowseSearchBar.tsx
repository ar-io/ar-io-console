import { useState, useRef, useEffect, memo, type FormEvent } from 'react';
import { Search, Settings, X, ChevronUp, Compass } from 'lucide-react';
import { isValidInput } from '../utils/detectInputType';

interface BrowseSearchBarProps {
  onSearch: (input: string) => void;
  isSearched: boolean;
  currentInput: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSettings: () => void;
  verificationBadge?: React.ReactNode;
}

export const BrowseSearchBar = memo(function BrowseSearchBar({
  onSearch,
  isSearched,
  currentInput,
  isCollapsed,
  onToggleCollapse,
  onOpenSettings,
  verificationBadge,
}: BrowseSearchBarProps) {
  const [input, setInput] = useState(currentInput);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInput(currentInput);
  }, [currentInput]);

  useEffect(() => {
    if (!isSearched) {
      inputRef.current?.focus();
    }
  }, [isSearched]);

  const validateInput = () => {
    const trimmedInput = input.trim();

    if (!trimmedInput) {
      setError('Please enter an ArNS name or transaction ID');
      return false;
    }

    if (!isValidInput(trimmedInput)) {
      setError('Invalid input. Please enter a valid ArNS name or 43-character transaction ID');
      return false;
    }

    setError('');
    return true;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (validateInput()) {
      onSearch(input.trim());
    }
  };

  // Collapsed state - return null, the expand button is rendered in BrowsePanel
  if (isSearched && isCollapsed) {
    return null;
  }

  // Results page - compact header
  if (isSearched) {
    return (
      <div className="w-full bg-background/95 backdrop-blur-sm border-b border-border/20 py-2 sticky top-0 z-10">
        <form onSubmit={handleSubmit} className="max-w-none px-3 sm:px-4">
          <div className="flex gap-1.5 items-center">
            {/* Collapse button */}
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1.5 text-foreground/50 rounded-lg hover:bg-card hover:text-foreground transition-colors flex-shrink-0"
              title="Enter fullscreen"
            >
              <ChevronUp className="w-4 h-4" />
            </button>

            {/* Input field */}
            <div className="relative flex-1 min-w-0">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground/40 font-mono text-sm pointer-events-none select-none">
                ar://
              </div>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setError('');
                }}
                placeholder="name or tx ID..."
                className={`w-full pl-12 pr-7 py-1.5 bg-background border text-foreground placeholder:text-foreground/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm ${
                  error ? 'border-red-500' : 'border-border/20'
                }`}
              />
              {input && (
                <button
                  type="button"
                  onClick={() => {
                    setInput('');
                    setError('');
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-foreground/40 hover:text-foreground transition-colors"
                  title="Clear"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Action buttons */}
            <button
              type="submit"
              className="p-1.5 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity font-medium shadow-sm flex items-center justify-center flex-shrink-0"
              title="Browse"
              aria-label="Browse content"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Verification badge - prominent position */}
            {verificationBadge}

            <button
              type="button"
              onClick={onOpenSettings}
              className="p-1.5 bg-background text-foreground rounded-lg hover:bg-card/80 transition-colors font-medium shadow-sm border border-border/20 flex-shrink-0"
              title="Settings"
              aria-label="Open browse settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
        </form>
      </div>
    );
  }

  // Homepage - panel style with search
  return (
    <div className="px-4 sm:px-6">
      {/* Panel Header - compact */}
      <div className="flex items-center gap-3 mb-3 sm:mb-4">
        <div className="w-9 h-9 bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0 border border-border/20">
          <Compass className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-heading font-bold text-foreground">Browse Data</h3>
          <p className="text-sm text-foreground/60">Access and verify data and apps on the permanent cloud</p>
        </div>
      </div>

      {/* Search Card */}
      <div className="bg-card rounded-2xl border border-border/20 p-4 sm:p-5">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/50 font-mono text-base pointer-events-none select-none">
                  ar://
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter name or transaction ID..."
                  className={`w-full pl-[4.5rem] pr-4 py-3 bg-background border text-foreground placeholder:text-foreground/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-base ${
                    error ? 'border-red-500' : 'border-border/20'
                  }`}
                />
              </div>
              <button
                type="submit"
                className="px-5 py-3 bg-primary text-white rounded-xl hover:opacity-90 transition-opacity font-medium text-sm flex-shrink-0"
              >
                Browse
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-3 bg-background text-foreground/60 rounded-xl hover:bg-card hover:text-foreground transition-colors border border-border/20 flex-shrink-0"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
          </div>

          <div className="mt-4 pt-3 border-t border-border/20">
            <p className="text-xs text-foreground/50 mb-2">Try these examples:</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'ar.io', value: 'ar-io' },
                { label: 'Permaweb Journal', value: 'permaweb-journal' },
                { label: 'AO', value: 'ao' },
                { label: 'CrimRxiv', value: 'crimrxiv' },
                { label: 'ArDrive', value: 'ardrive' },
              ].map((example) => (
                <button
                  key={example.value}
                  type="button"
                  onClick={() => setInput(example.value)}
                  className="px-3 py-1.5 bg-background border border-border/20 rounded-lg text-sm text-foreground hover:bg-card/80 transition-colors"
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
});
