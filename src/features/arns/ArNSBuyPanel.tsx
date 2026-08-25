import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Globe, ExternalLink, Flame } from 'lucide-react';

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
  /**
   * The user paid for credits but the registration hasn't settled. Lives here,
   * not on the purchase card: that card is unmounted the instant `phase` leaves
   * 'idle', which is exactly when this matters.
   */
  const [tokenFunded, setTokenFunded] = useState(false);

  const handleBuy = (input: BuyArNSNameInput) => {
    /*
      Returns the promise rather than swallowing it. The status card still owns
      the terminal UI, but the token path ALSO needs to know: it has already
      taken the user's money for credits, so a registration failure there is
      "funded, not registered" — a different message with a different remedy.
      Rejections stay handled at the call site.
    */
    return buyState.buy(input).catch(() => undefined);
  };

  const handleDone = () => {
    setTokenFunded(false);
    buyState.reset();
    setSelectedName(undefined);
    setSearch('');
  };

  // Retry the same name: clear the terminal buy state but keep the selection,
  // so the purchase card re-appears for another attempt.
  const handleRetry = () => {
    /*
      Deliberately does NOT clear `tokenFunded`. Retrying re-runs only the
      registration — the credits are already bought and still theirs, so if it
      fails again they should see the same "you already paid" guidance rather
      than a bare error. It clears when the flow actually ends (`handleDone`) or
      the user picks a different name.
    */
    buyState.reset();
  };

  return (
    <div className="px-4 sm:px-6">
      {/* Header — only during search. Once a name is selected the purchase card
          headers with that name and the "Search a different name" link keeps
          context, so this intro would just crowd the register/pay step. */}
      {!selectedName && (
        <div className="flex items-start gap-3 mb-6">
          <div className="w-10 h-10 bg-primary/20 rounded-2xl flex items-center justify-center flex-shrink-0 mt-1">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-2xl font-extrabold font-heading text-foreground mb-1">
              Register an ArNS Name
            </h3>
            <p className="text-sm text-foreground/80">
              {/* Named the two crypto routes and omitted the one that needs no
                  crypto at all — which is the option a newcomer is looking for.
                  Lead with the card. */}
              Search, price, and buy a name with a card, ARIO, or SOL — no
              leaving the console.
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
      )}

      {/* Search — collapses to a compact "change name" link once a name is
          chosen, so the register/pay flow isn't crowded by the full search box
          (the Register card below already headers with the selected name). */}
      {!selectedName ? (
        <>
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

          {/* Cross-links to the other domain surfaces */}
          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Link
              to="/domains"
              className="inline-flex items-center gap-1.5 font-medium text-primary transition-opacity hover:opacity-80"
            >
              <Globe className="h-4 w-4" /> Browse all names
            </Link>
            <Link
              to="/returned-names"
              className="inline-flex items-center gap-1.5 font-medium text-foreground/70 transition-colors hover:text-foreground"
            >
              <Flame className="h-4 w-4" /> Returned-name auctions
            </Link>
          </div>
        </>
      ) : (
        <button
          onClick={() => {
            setSelectedName(undefined);
            setTokenFunded(false);
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
          onTokenFunded={() => setTokenFunded(true)}
          onCardSuccess={(messageId) =>
            buyState.markExternalSuccess({
              nonce: '',
              messageId,
              receipt: {},
            })
          }
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
          alreadyFunded={tokenFunded}
          name={selectedName}
          onDone={handleDone}
          onRetry={handleRetry}
        />
      )}
    </div>
  );
}

export default ArNSBuyPanel;
