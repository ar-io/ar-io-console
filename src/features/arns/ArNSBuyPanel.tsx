import { useState } from 'react';
import { ArrowLeft, Globe, Wallet, Link2 } from 'lucide-react';

import { useStore } from '../../store/useStore';
import { useLinkedSolanaWallet } from '../../hooks/useLinkedSolanaWallet';
import LinkSolanaWalletModal from '../../components/modals/LinkSolanaWalletModal';
import WalletSelectionModal from '../../components/modals/WalletSelectionModal';
import { ArNSNameSearch } from './components/ArNSNameSearch';
import { ArNSPurchaseCard } from './components/ArNSPurchaseCard';
import { ArNSPurchaseStatus } from './components/ArNSPurchaseStatus';
import { useArNSTurboSigner } from './hooks/useArNSTurboSigner';
import { useBuyArNSName } from './hooks/useBuyArNSName';
import type { BuyArNSNameInput } from './hooks/useBuyArNSName';

/**
 * ArNS "buy a name with Turbo Credits" — the in-console replacement for the old
 * external `arns.ar.io` deep-link. Phase 1: Solana-native (Model B, user
 * self-owns the ANT), credits-only. Composes search → configure/price → buy →
 * status. Lease/permabuy + lease years are in scope; undername-count-at-purchase
 * and non-credit payment methods are deferred.
 */
export function ArNSBuyPanel() {
  const address = useStore((s) => s.address);
  const signer = useArNSTurboSigner();
  const { needsLinking } = useLinkedSolanaWallet();

  const [search, setSearch] = useState('');
  const [selectedName, setSelectedName] = useState<string | undefined>();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkReconnect, setLinkReconnect] = useState(false);

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

  const canBuy = signer.isReady;

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

      {/* Wallet gate — shown INSTEAD of the purchase card until a Solana signer
          is ready, so the user sees one clear call-to-action, not two. */}
      {selectedName && !canBuy && buyState.phase === 'idle' && (
        <div className="bg-card rounded-2xl border border-border/20 p-5 mb-4">
          {!address ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="w-5 h-5 text-primary flex-shrink-0" />
                <p className="text-sm font-medium text-foreground">
                  Connect a wallet to continue
                </p>
              </div>
              <p className="text-xs text-foreground/60 mb-3">
                ArNS names are paid with Turbo Credits or ARIO from a Solana
                wallet (plus a little SOL for network rent).
              </p>
              <button
                onClick={() => setShowWalletModal(true)}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Connect wallet
              </button>
            </div>
          ) : needsLinking ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Link2 className="w-5 h-5 text-primary flex-shrink-0" />
                <p className="text-sm font-medium text-foreground">
                  Link a Solana wallet to buy ArNS names
                </p>
              </div>
              <p className="text-xs text-foreground/60 mb-3">
                ArNS names live on Solana. Link a Solana wallet to sign the
                purchase — your primary account stays the same.
              </p>
              <button
                onClick={() => {
                  setLinkReconnect(false);
                  setShowLinkModal(true);
                }}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Link Solana wallet
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="w-5 h-5 text-warning flex-shrink-0" />
                <p className="text-sm font-medium text-foreground">
                  Reconnect your Solana wallet
                </p>
              </div>
              <p className="text-xs text-foreground/60 mb-3">
                Reconnect the Solana wallet that signs this purchase.
              </p>
              <button
                onClick={() => {
                  setLinkReconnect(true);
                  setShowLinkModal(true);
                }}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Reconnect
              </button>
            </div>
          )}
        </div>
      )}

      {/* Configure + buy — only once a signer is ready (no double CTA). */}
      {selectedName && canBuy && buyState.phase === 'idle' && (
        <ArNSPurchaseCard
          name={selectedName}
          canBuy={canBuy}
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

      {showWalletModal && (
        <WalletSelectionModal onClose={() => setShowWalletModal(false)} />
      )}
      {showLinkModal && (
        <LinkSolanaWalletModal
          isReconnect={linkReconnect}
          onClose={() => setShowLinkModal(false)}
        />
      )}
    </div>
  );
}

export default ArNSBuyPanel;
