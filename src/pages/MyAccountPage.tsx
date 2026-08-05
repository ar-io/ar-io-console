import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { User, Globe, RefreshCw, AlertTriangle, Download } from 'lucide-react';
import { getExpiringDomains, expiryLabel, expirySortKey } from '@/utils/domainExpiry';
import { downloadDomainsCsv } from '@/utils/domainCsv';
import { ManageDomainModal } from '@/features/arns';
import type { ArNSName } from '@/types';
import { usePrimaryArNSName } from '@/hooks/usePrimaryArNSName';
import { useOwnedArNSNames } from '@/hooks/useOwnedArNSNames';
import { useLinkedSolanaWallet } from '@/hooks/useLinkedSolanaWallet';
import { makePossessive } from '@/utils';
import WalletIdentityCard from '@/components/account/WalletIdentityCard';
import BalanceCard from '@/components/account/BalanceCard';
import CreditSharingSection from '@/components/account/CreditSharingSection';
import PaymentHistorySection from '@/components/account/PaymentHistorySection';
import DomainsTable from '@/components/account/DomainsTable';
import SyncOwnershipBanner from '@/components/account/SyncOwnershipBanner';
import PrimaryNameCard from '@/components/account/PrimaryNameCard';
import LinkSolanaWalletModal from '@/components/modals/LinkSolanaWalletModal';

const DOMAINS_SHOWN = 10;

export default function MyAccountPage() {
  const { address, walletType, isPaymentServiceAvailable } = useStore();
  const navigate = useNavigate();
  const { hasArNSAccess, arnsAddress, isPrimarySolana, isSolanaConnected, linkedAddress, unlinkWallet } = useLinkedSolanaWallet();
  const { arnsName, profile } = usePrimaryArNSName(arnsAddress);
  const { names: ownedNames, loading: loadingDomains, fetchOwnedNames } = useOwnedArNSNames();
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [renewDomain, setRenewDomain] = useState<ArNSName | null>(null);
  const [showAllDomains, setShowAllDomains] = useState(false);

  // Redirect to home if not logged in (declarative — never navigate during render)
  if (!address) {
    return <Navigate to="/" replace />;
  }

  const paymentAvailable = isPaymentServiceAvailable();
  const now = Date.now();
  // Leases expiring within the warning window (soonest first) — powers the banner.
  const expiringDomains = getExpiringDomains(ownedNames, now);
  // Show expiring-soon domains first so at-risk names surface within the table too.
  const sortedDomains = [...ownedNames].sort((a, b) => expirySortKey(a, now) - expirySortKey(b, now));

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
            Your wallet, credits, names and recent activity.
          </p>
        </div>
      </div>

      {/* Identity + Balance — cards stretch to equal height (grid default). */}
      <h2 className="sr-only">Account overview</h2>
      {(() => {
        const walletCard = (
          <WalletIdentityCard
            address={address}
            walletType={walletType}
            isPrimarySolana={isPrimarySolana}
            linkedAddress={linkedAddress}
            isSolanaConnected={isSolanaConnected}
            onLink={() => setShowLinkModal(true)}
            onUnlink={unlinkWallet}
          />
        );
        return paymentAvailable ? (
          <div className="grid gap-4 md:grid-cols-2 mb-8">
            {walletCard}
            <BalanceCard />
          </div>
        ) : (
          <div className="mb-8">{walletCard}</div>
        );
      })()}

      {/* Top-up history (full width) — hidden in x402-only mode */}
      {paymentAvailable && (
        <div className="mb-8">
          <PaymentHistorySection />
        </div>
      )}

      {/* Domains Section */}
      {hasArNSAccess && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold text-xl text-foreground">Domains</h2>
            <div className="flex items-center gap-1">
              {ownedNames.length > 0 && (
                <button
                  onClick={() => downloadDomainsCsv(sortedDomains)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-foreground hover:text-foreground/80 transition-colors"
                  title="Export domains to CSV"
                  aria-label="Export domains to CSV"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>
              )}
              <button
                onClick={() => fetchOwnedNames(true)}
                disabled={loadingDomains}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-foreground hover:text-foreground/80 transition-colors disabled:opacity-50"
                title="Refresh domains"
                aria-label="Refresh domains"
              >
                <RefreshCw className={`w-4 h-4 ${loadingDomains ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
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
                    Renew before the lease ends to keep {expiringDomains.length === 1 ? 'it' : 'them'} — an expired domain can be registered by someone else.
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
                <button
                  onClick={() => {
                    const target = ownedNames.find(
                      (n) => n.name === expiringDomains[0].name,
                    );
                    if (target) setRenewDomain(target);
                  }}
                  className="flex-shrink-0 self-center rounded-full bg-warning px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Renew
                </button>
              </div>
            </div>
          )}

          {arnsAddress && (
            <div className="mb-4">
              <PrimaryNameCard
                address={arnsAddress}
                ownedNames={ownedNames}
                onChanged={() => fetchOwnedNames(true)}
              />
            </div>
          )}

          {/* Names owned on-chain but missing from the ACL index (out-of-band
              ANT transfers) — shown regardless of the owned-names state, since
              drifted names are exactly the ones not in that list. */}
          <SyncOwnershipBanner
            address={arnsAddress}
            onSynced={() => fetchOwnedNames(true)}
          />

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
                Register an ArNS name to give your sites and apps a friendly address
              </p>
              <button
                onClick={() => navigate('/domains')}
                className="px-4 py-2 bg-primary text-white rounded-full font-medium hover:bg-primary/90 transition-colors"
              >
                Search for a domain
              </button>
            </div>
          ) : (
            <>
              <DomainsTable
                domains={
                  showAllDomains
                    ? sortedDomains
                    : sortedDomains.slice(0, DOMAINS_SHOWN)
                }
                onChanged={() => fetchOwnedNames(true)}
                walletAddress={arnsAddress}
              />

              {ownedNames.length > DOMAINS_SHOWN && (
                <div className="text-center mt-4">
                  <button
                    onClick={() => setShowAllDomains((v) => !v)}
                    className="inline-flex items-center justify-center gap-2 py-2 font-medium text-primary hover:underline"
                  >
                    {showAllDomains
                      ? 'Show fewer'
                      : `Show all ${ownedNames.length} names`}
                  </button>
                </div>
              )}
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

      {renewDomain && (
        <ManageDomainModal
          domain={renewDomain}
          onClose={() => setRenewDomain(null)}
          onSuccess={() => fetchOwnedNames(true)}
        />
      )}
    </div>
  );
}
