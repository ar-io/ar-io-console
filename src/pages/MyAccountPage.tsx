import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { User, Globe, RefreshCw, ExternalLink, Link2, Unlink, AlertTriangle } from 'lucide-react';
import { getExpiringDomains, expiryLabel } from '../utils/domainExpiry';
import { usePrimaryArNSName } from '../hooks/usePrimaryArNSName';
import { useOwnedArNSNames } from '../hooks/useOwnedArNSNames';
import { useLinkedSolanaWallet } from '../hooks/useLinkedSolanaWallet';
import { makePossessive, formatWalletAddress } from '../utils';
import WalletIdentityCard from '../components/account/WalletIdentityCard';
import BalanceCard from '../components/account/BalanceCard';
import CreditSharingSection from '../components/account/CreditSharingSection';
import PaymentHistorySection from '@/components/account/PaymentHistorySection';
import OwnedName from '@/components/OwnedName';
import LinkSolanaWalletModal from '../components/modals/LinkSolanaWalletModal';

export default function MyAccountPage() {
  const { address, walletType, isPaymentServiceAvailable } = useStore();
  const navigate = useNavigate();
  const { hasArNSAccess, arnsAddress, isPrimarySolana, isSolanaConnected, linkedWalletName, linkedAddress, unlinkWallet } = useLinkedSolanaWallet();
  const { arnsName, profile, loading: loadingArNS } = usePrimaryArNSName(arnsAddress);
  const { names: ownedNames, loading: loadingDomains, fetchOwnedNames } = useOwnedArNSNames();
  const [showLinkModal, setShowLinkModal] = useState(false);

  // Redirect to home if not logged in (declarative — never navigate during render)
  if (!address) {
    return <Navigate to="/" replace />;
  }

  const paymentAvailable = isPaymentServiceAvailable();
  // Leases expiring within the warning window (soonest first) — powers the banner.
  const expiringDomains = getExpiringDomains(ownedNames, Date.now());

  return (
    <div className="px-4 sm:px-6">
      {/* Page Header */}
      <div className="flex items-start gap-4 mb-6">
        {/* Profile Image or User Icon */}
        {profile.logo ? (
          <div className="w-12 h-12 rounded-2xl overflow-hidden bg-card border border-border/20 flex items-center justify-center flex-shrink-0 mt-1">
            <img
              src={profile.logo}
              alt={`${profile.name} logo`}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to user icon on error
                const target = e.target as HTMLImageElement;
                const container = target.parentElement;
                if (container) {
                  target.style.display = 'none';
                  const fallback = container.querySelector('.fallback-icon') as HTMLElement;
                  if (fallback) {
                    fallback.style.display = 'flex';
                  }
                }
              }}
            />
            <div className="fallback-icon hidden w-full h-full bg-foreground/20 rounded-2xl items-center justify-center border border-border/20">
              <User className="w-6 h-6 text-foreground" />
            </div>
          </div>
        ) : (
          <div className="w-12 h-12 bg-foreground/20 rounded-2xl flex items-center justify-center flex-shrink-0 mt-1 border border-border/20">
            <User className="w-6 h-6 text-foreground" />
          </div>
        )}

        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground mb-1 break-words">
            {arnsName ? `${makePossessive(arnsName)} Account` : 'My Account'}
          </h1>
          <p className="text-sm text-foreground/80">
            Your wallet, credits, domains and recent activity.
          </p>
        </div>
      </div>

      {/* Identity + Balance — cards stretch to equal height (grid default). */}
      <h2 className="sr-only">Account overview</h2>
      {paymentAvailable ? (
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <WalletIdentityCard
            address={address}
            walletType={walletType}
            arnsName={arnsName}
            loadingArNS={loadingArNS}
          />
          <BalanceCard />
        </div>
      ) : (
        <div className="mb-8">
          <WalletIdentityCard
            address={address}
            walletType={walletType}
            arnsName={arnsName}
            loadingArNS={loadingArNS}
          />
        </div>
      )}

      {/* Top-up history (full width) — hidden in x402-only mode */}
      {paymentAvailable && (
        <div className="mb-8">
          <PaymentHistorySection />
        </div>
      )}

      {/* Linked Wallets Section - Show for non-Solana primary users */}
      {!isPrimarySolana && (
        <div className="mb-8">
          <h2 className="font-heading font-bold text-xl text-foreground mb-4">Linked Wallets</h2>
          <div className="rounded-2xl border border-border/20 bg-card p-4 sm:p-6">
            {linkedAddress ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="w-8 h-8 flex-shrink-0 bg-primary/20 rounded-lg flex items-center justify-center">
                    <Link2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {linkedWalletName || 'Solana Wallet'} <span className="text-xs text-foreground/60">(ArNS)</span>
                    </div>
                    <div className="text-xs text-foreground/60 font-mono">
                      {formatWalletAddress(linkedAddress, 6)}
                    </div>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-4">
                  {isSolanaConnected ? (
                    <span className="text-xs text-success">Connected</span>
                  ) : (
                    <button onClick={() => setShowLinkModal(true)} className="text-xs text-primary hover:underline">
                      Reconnect
                    </button>
                  )}
                  <button onClick={() => setShowLinkModal(true)} className="text-xs text-foreground/60 hover:text-foreground transition-colors">
                    Change
                  </button>
                  <button onClick={unlinkWallet} className="p-1.5 text-foreground/40 hover:text-error transition-colors" title="Unlink wallet" aria-label="Unlink Solana wallet">
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-foreground/80 mb-3">
                  Link a Solana wallet to manage ArNS domains
                </p>
                <button
                  onClick={() => setShowLinkModal(true)}
                  className="px-4 py-2 bg-primary text-white rounded-full font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
                >
                  <Link2 className="w-4 h-4" />
                  Link Solana Wallet
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Domains Section */}
      {hasArNSAccess && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold text-xl text-foreground">Domains</h2>
            <button
              onClick={() => fetchOwnedNames(true)}
              disabled={loadingDomains}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-foreground hover:text-foreground/80 transition-colors disabled:opacity-50"
              title="Refresh domain list"
              aria-label="Refresh domain list"
            >
              <RefreshCw className={`w-4 h-4 ${loadingDomains ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {/* Expiry warning — spans the owned leases we've loaded (the 100 most recent
              from the batch), so it surfaces at-risk names beyond the 5 shown below. */}
          {expiringDomains.length > 0 && (
            <div className="mb-4 rounded-2xl border border-warning/40 bg-warning/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-warning" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {expiringDomains.length === 1
                      ? '1 domain is expiring soon'
                      : `${expiringDomains.length} domains are expiring soon`}
                  </p>
                  <p className="mt-0.5 text-xs text-foreground/80">
                    Renew before the lease ends to keep {expiringDomains.length === 1 ? 'it' : 'them'} — an expired name can be registered by someone else.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {expiringDomains.slice(0, 6).map((d) => (
                      <span key={d.name} className="text-xs text-foreground/80">
                        <span className="font-medium text-foreground">{d.displayName}</span>{' '}
                        <span className={d.daysRemaining < 0 ? 'text-error' : 'text-warning'}>
                          ({expiryLabel(d.daysRemaining)})
                        </span>
                      </span>
                    ))}
                    {expiringDomains.length > 6 && (
                      <span className="text-xs text-foreground/60">+{expiringDomains.length - 6} more</span>
                    )}
                  </div>
                </div>
                <a
                  href="https://arns.ar.io/#/manage/names"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 self-center rounded-full bg-warning px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Renew
                </a>
              </div>
            </div>
          )}

          {loadingDomains ? (
            <div className="rounded-2xl border border-border/20 bg-card p-4 sm:p-6 text-center">
              <RefreshCw className="w-6 h-6 text-primary mx-auto mb-3 animate-spin" />
              <p className="text-sm text-foreground/80">Loading your domains…</p>
            </div>
          ) : ownedNames.length === 0 ? (
            <div className="rounded-2xl border border-border/20 bg-card p-6 sm:p-8 text-center">
              <Globe className="w-12 h-12 text-primary/50 mx-auto mb-4" />
              <h3 className="font-heading font-bold text-foreground mb-2">No domains yet</h3>
              <p className="text-sm text-foreground/80 mb-4">
                Register an ArNS domain to give your apps and sites friendly names
              </p>
              <button
                onClick={() => navigate('/domains')}
                className="px-4 py-2 bg-primary text-white rounded-full font-medium hover:bg-primary/90 transition-colors"
              >
                Search for your name
              </button>
            </div>
          ) : (
            <>
              <div className="grid gap-4">
                {ownedNames.slice(0, 5).map((domain) => (
                  <OwnedName key={domain.name} domain={domain} />
                ))}
              </div>

              <div className="text-center mt-4">
                <a
                  href="https://arns.ar.io/#/manage/names"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 py-2 text-primary hover:underline font-medium"
                >
                  View all domains
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </>
          )}
        </div>
      )}

      {/* Credit sharing — an advanced feature most users don't need, so it lives at
          the bottom. Hidden in x402-only mode. */}
      {paymentAvailable && (
        <div className="mb-8">
          <CreditSharingSection />
        </div>
      )}

      {showLinkModal && (
        <LinkSolanaWalletModal onClose={() => setShowLinkModal(false)} />
      )}
    </div>
  );
}
