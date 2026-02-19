import { useState, useMemo, useEffect, useRef, useCallback, Fragment } from 'react';
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions, Transition } from '@headlessui/react';
import { ChevronDown, Check, Plus, AlertCircle, Loader2 } from 'lucide-react';
import useDebounce from '@/hooks/useDebounce';
import type { GatewayWithStake } from '../types';

interface GatewayComboboxProps {
  value: string | null;
  onChange: (gateway: string) => void;
  gateways: GatewayWithStake[];
  isLoading?: boolean;
}

// Special value to indicate custom URL input mode
const CUSTOM_URL_OPTION = '__CUSTOM_URL__';

export function GatewayCombobox({ value, onChange, gateways, isLoading = false }: GatewayComboboxProps) {
  const [query, setQuery] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [customUrlError, setCustomUrlError] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState(50);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const debouncedQuery = useDebounce(query, 150);

  // Reset display limit when search query changes
  useEffect(() => {
    setDisplayLimit(50);
  }, [debouncedQuery]);

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  // Check if current value is a custom URL (not in gateway list)
  useEffect(() => {
    if (value && gateways.length > 0) {
      const isKnownGateway = gateways.some(gw => gw.url === value);
      if (!isKnownGateway && value !== 'https://turbo-gateway.com') {
        setIsCustomMode(true);
        setCustomUrl(value);
      }
    }
  }, [value, gateways]);

  // Filter gateways based on search query (full list, before limit)
  const allFilteredGateways = useMemo(() => {
    if (!debouncedQuery) {
      return gateways;
    }

    const lowerQuery = debouncedQuery.toLowerCase();
    return gateways.filter(gw => {
      try {
        const hostname = new URL(gw.url).hostname.toLowerCase();
        return hostname.includes(lowerQuery);
      } catch {
        return gw.url.toLowerCase().includes(lowerQuery);
      }
    });
  }, [gateways, debouncedQuery]);

  // Apply display limit for rendering
  const filteredGateways = useMemo(() => {
    return allFilteredGateways.slice(0, displayLimit);
  }, [allFilteredGateways, displayLimit]);

  // Check if there are more gateways to load
  const hasMoreGateways = allFilteredGateways.length > displayLimit;

  // Callback ref for the sentinel element - sets up IntersectionObserver when element mounts
  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    // Disconnect previous observer
    observerRef.current?.disconnect();

    if (node) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setDisplayLimit(prev => prev + 50);
          }
        },
        { threshold: 0.1 }
      );
      observerRef.current.observe(node);
    }
  }, []);

  /** Format stake amount for display. Stake is in mARIO (1 ARIO = 1,000,000 mARIO) */
  const formatStake = (marioStake: number): string => {
    const arioStake = marioStake / 1_000_000;
    if (arioStake >= 1_000_000) {
      return `${(arioStake / 1_000_000).toFixed(1)}M`;
    } else if (arioStake >= 1_000) {
      return `${(arioStake / 1_000).toFixed(1)}K`;
    } else if (arioStake >= 1) {
      return `${arioStake.toFixed(0)}`;
    }
    return '<1';
  };

  const getHostname = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const validateCustomUrl = (url: string): string | null => {
    if (!url.trim()) {
      return 'Please enter a URL';
    }

    if (!url.startsWith('https://')) {
      return 'URL must start with https://';
    }

    try {
      const parsed = new URL(url);
      // Check for valid hostname with TLD
      const hostname = parsed.hostname;
      if (!hostname.includes('.') || hostname.endsWith('.')) {
        return 'Invalid hostname';
      }
      return null;
    } catch {
      return 'Invalid URL format';
    }
  };

  const handleCustomUrlSubmit = () => {
    const error = validateCustomUrl(customUrl);
    if (error) {
      setCustomUrlError(error);
      return;
    }

    setCustomUrlError(null);
    setIsCustomMode(false);
    onChange(customUrl.trim());
  };

  const handleSelection = (selected: string | null) => {
    if (selected === CUSTOM_URL_OPTION) {
      setIsCustomMode(true);
      setCustomUrl('https://');
      setCustomUrlError(null);
      return;
    }

    if (selected) {
      onChange(selected);
    }
  };

  // Get display value for the combobox input
  const displayValue = useMemo(() => {
    if (!value) return '';
    const gateway = gateways.find(gw => gw.url === value);
    if (gateway) {
      return getHostname(gateway.url);
    }
    // Check for turbo-gateway default
    if (value === 'https://turbo-gateway.com') {
      return 'turbo-gateway.com';
    }
    // Custom URL
    return getHostname(value);
  }, [value, gateways]);

  if (isCustomMode) {
    return (
      <div className="space-y-2">
        <div className="relative">
          <input
            type="text"
            value={customUrl}
            onChange={(e) => {
              setCustomUrl(e.target.value);
              setCustomUrlError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCustomUrlSubmit();
              } else if (e.key === 'Escape') {
                setIsCustomMode(false);
                setCustomUrl('');
                setCustomUrlError(null);
              }
            }}
            placeholder="https://my-gateway.example.com"
            className={`w-full px-3 py-2 bg-card border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary ${
              customUrlError ? 'border-red-500' : 'border-border/20'
            }`}
            autoFocus
          />
        </div>

        {customUrlError && (
          <div className="flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircle className="w-3.5 h-3.5" />
            {customUrlError}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleCustomUrlSubmit}
            className="flex-1 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Save
          </button>
          <button
            onClick={() => {
              setIsCustomMode(false);
              setCustomUrl('');
              setCustomUrlError(null);
            }}
            className="flex-1 py-1.5 bg-card border border-border/20 text-foreground rounded-lg text-sm font-medium hover:bg-card/80 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <Combobox value={value} onChange={handleSelection}>
      <div className="relative">
        <div className="relative">
          <ComboboxInput
            className="w-full px-3 py-2 pr-10 bg-card border border-border/20 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            displayValue={() => displayValue}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isLoading ? "Loading gateways..." : "Search gateways..."}
          />
          <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-3">
            {isLoading ? (
              <Loader2 className="w-4 h-4 text-foreground/40 animate-spin" />
            ) : (
              <ChevronDown className="w-4 h-4 text-foreground/40" />
            )}
          </ComboboxButton>
        </div>

        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          afterLeave={() => setQuery('')}
        >
          <ComboboxOptions className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-card border border-border/20 shadow-lg py-1 text-sm focus:outline-none">
            {/* Default turbo-gateway option */}
            <ComboboxOption
              value="https://turbo-gateway.com"
              className={({ active, selected }) =>
                `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                  active ? 'bg-primary/10 text-foreground' : 'text-foreground'
                } ${selected ? 'bg-primary/5' : ''}`
              }
            >
              {({ selected }) => (
                <>
                  <div className="flex items-center justify-between">
                    <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                      turbo-gateway.com
                    </span>
                    <span className="text-xs text-foreground/50">(default)</span>
                  </div>
                  {selected && (
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary">
                      <Check className="w-4 h-4" />
                    </span>
                  )}
                </>
              )}
            </ComboboxOption>

            {/* Separator */}
            {filteredGateways.length > 0 && (
              <div className="border-t border-border/10 my-1" />
            )}

            {/* Gateway list */}
            {filteredGateways.map((gateway) => (
              <ComboboxOption
                key={gateway.url}
                value={gateway.url}
                className={({ active, selected }) =>
                  `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                    active ? 'bg-primary/10 text-foreground' : 'text-foreground'
                  } ${selected ? 'bg-primary/5' : ''}`
                }
              >
                {({ selected }) => (
                  <>
                    <div className="flex items-center justify-between">
                      <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                        {getHostname(gateway.url)}
                      </span>
                      <span className="text-xs text-foreground/50">
                        {formatStake(gateway.totalStake)} ARIO
                      </span>
                    </div>
                    {selected && (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary">
                        <Check className="w-4 h-4" />
                      </span>
                    )}
                  </>
                )}
              </ComboboxOption>
            ))}

            {/* No results */}
            {filteredGateways.length === 0 && !isLoading && query && (
              <div className="px-4 py-2 text-foreground/50">
                No gateways found matching "{query}"
              </div>
            )}

            {/* Load more sentinel - triggers infinite scroll */}
            {hasMoreGateways && (
              <div
                ref={loadMoreRef}
                className="px-4 py-2 text-xs text-foreground/50 bg-card/50 flex items-center justify-center gap-2"
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading more... ({filteredGateways.length} of {allFilteredGateways.length})
              </div>
            )}

            {/* Separator */}
            <div className="border-t border-border/10 my-1" />

            {/* Custom URL option */}
            <ComboboxOption
              value={CUSTOM_URL_OPTION}
              className={({ active }) =>
                `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                  active ? 'bg-primary/10 text-foreground' : 'text-foreground/80'
                }`
              }
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 absolute left-3" />
                <span>Enter custom URL...</span>
              </div>
            </ComboboxOption>
          </ComboboxOptions>
        </Transition>
      </div>
    </Combobox>
  );
}
