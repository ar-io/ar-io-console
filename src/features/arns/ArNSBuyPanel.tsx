import { useState } from 'react';
import { ArrowLeft, Globe, ExternalLink } from 'lucide-react';

import { ArNSNameSearch } from './components/ArNSNameSearch';
import { ArNSPurchaseCard } from './components/ArNSPurchaseCard';
import { ArNSPurchaseStatus } from './components/ArNSPurchaseStatus';
import { useBuyArNSName } from './hooks/useBuyArNSName';
import type { BuyArNSNameInput } from './hooks/useBuyArNSName';

/**
 * ArNS "buy a name with Turbo Credits" — the in-console replacement for the old
 * external `arns.ar.io` deep-link. Phase 1: Solana-native (Model B, user
 * self-owns the ANT), credits-only. Composes search → configure/price → buy →
 * status. Lease/permabuy + lease years are in scope; undername-count-at-purchase
 * and non-credit payment methods are deferred.
 */
export function ArNSBuyPanel({ initialSearch }: { initialSearch?: string } = {}) {
  const [search, setSearch] = useState(initialSearch ?? '');
  const [selectedName, setSelectedName] = useState<string | undefined>();

  const buyState = useBuyArNSName();

  const handleBuy = (input: BuyArNSNameInput) => {
    // Swallow the throw — terminal state is surfaced via buyState (status card).
    void buyState.buy(input).catch(() => undefined);
  };

  const handleDone = () => {
    buyState.reset();
    setSelectedName(undefined);
    setSearch('');
  };

  // Retry the same name: clear the terminal buy state but keep the selection,
  // so the purchase card re-appears for another attempt.
  const handleRetry = () => {
    buyState.reset();
  };

  return (
    <div className="px-4 sm:px-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 bg-primary/20 rounded-2xl flex items-center justify-center flex-shrink-0 mt-1">
          <Globe className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-2xl font-bold font-heading text-foreground mb-1">
            Register an ArNS Name
          </h3>
          <p className="text-sm text-foreground/80">
            Search, price, and buy a name with Turbo Credits or your ARIO tokens
            — no leaving the console.
          </p>
          <a
            href="https://docs.ar.io/learn/arns"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            What is ArNS?
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Search — collapses to a compact "change name" link once a name is
          chosen, so the register/pay flow isn't crowded by the full search box
          (the Register card below already headers with the selected name). */}
      {!selectedName ? (
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl border border-primary/30 p-4 sm:p-6 mb-4">
          <ArNSNameSearch
            value={search}
            onChange={(v) => {
              setSearch(v);
              if (selectedName && v !== selectedName) {
                setSelectedName(undefined);
                buyState.reset();
              }
            }}
            onSelect={(name) => {
              setSelectedName(name);
              buyState.reset();
            }}
            selectedName={selectedName}
          />
        </div>
      ) : (
        <button
          onClick={() => {
            setSelectedName(undefined);
            buyState.reset();
          }}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-opacity hover:opacity-80"
        >
          <ArrowLeft className="h-4 w-4" />
          Search a different name
        </button>
      )}

      {/* Configure + buy. The buy button itself gates on a Solana signer (via
          SolanaGateButton), so the user configures freely and meets the wallet
          step only at the moment of purchase — no upfront wall. */}
      {selectedName && buyState.phase === 'idle' && (
        <ArNSPurchaseCard
          name={selectedName}
          isBusy={buyState.isBusy}
          onBuy={handleBuy}
        />
      )}

      {/* Status / receipt */}
      {selectedName && (
        <ArNSPurchaseStatus
          phase={buyState.phase}
          statusMessage={buyState.statusMessage}
          result={buyState.result}
          error={buyState.error}
          insufficientCredits={buyState.insufficientCredits}
          name={selectedName}
          onDone={handleDone}
          onRetry={handleRetry}
        />
      )}
    </div>
  );
}

export default ArNSBuyPanel;
