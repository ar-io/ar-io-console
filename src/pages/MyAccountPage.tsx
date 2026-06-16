import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { User, Globe, RefreshCw, ArrowRight, Link2, Unlink } from 'lucide-react';
import { usePrimaryArNSName } from '../hooks/usePrimaryArNSName';
import { useOwnedArNSNames } from '../hooks/useOwnedArNSNames';
import { useLinkedSolanaWallet } from '../hooks/useLinkedSolanaWallet';
import { makePossessive, formatWalletAddress } from '../utils';
import BalanceCardsGrid from '../components/account/BalanceCardsGrid';
import CreditSharingSection from '../components/account/CreditSharingSection';
import ActivityOverview from '../components/account/ActivityOverview';
import OwnedName from '@/components/OwnedName';
import LinkSolanaWalletModal from '../components/modals/LinkSolanaWalletModal';

export default function MyAccountPage() {
  const { address, walletType, isPaymentServiceAvailable } = useStore();
  const navigate = useNavigate();
  const { hasArNSAccess, arnsAddress, isPrimarySolana, isSolanaConnected, linkedWalletName, linkedAddress, unlinkWallet } = useLinkedSolanaWallet();
  const { arnsName, profile, loading: loadingArNS } = usePrimaryArNSName(arnsAddress);
  const { names: ownedNames, loading: loadingDomains, fetchOwnedNames } = useOwnedArNSNames();
  const [showLinkModal, setShowLinkModal] = useState(false);

  // Redirect to home if not logged in
  if (!address) {
    navigate('/');
    return null;
  }

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
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground mb-1">
            {loadingArNS ? 'Loading...' : arnsName ? `${makePossessive(arnsName)} Account` : 'My Account'}
          </h1>
          <p className="text-sm text-foreground/80">
            {walletType && 'View your account details, like credits and recent activity.'}
          </p>
        </div>
      </div>

      {/* Wallet Overview Section - Hide balance/sharing in x402-only mode */}
      {isPaymentServiceAvailable() && (
        <div className="mb-8">
          <h2 className="font-heading font-bold text-xl text-foreground mb-4">Overview</h2>
          <div className="space-y-4">
            <BalanceCardsGrid />
            <CreditSharingSection />
          </div>
        </div>
      )}

      {/* Linked Wallets Section - Show for non-Solana primary users */}
      {!isPrimarySolana && (
        <div className="mb-8">
          <h2 className="font-heading font-bold text-xl text-foreground mb-4">Linked Wallets</h2>
          <div className="rounded-2xl border border-border/20 bg-card p-6">
            {linkedAddress ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Link2 className="w-4 h-4 text-purple-500" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {linkedWalletName || 'Solana Wallet'} <span className="text-xs text-foreground/60">(ArNS)</span>
                    </div>
                    <div className="text-xs text-foreground/60 font-mono">
                      {formatWalletAddress(linkedAddress, 6)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isSolanaConnected ? (
                    <span className="text-xs text-green-500">Connected</span>
                  ) : (
                    <button onClick={() => setShowLinkModal(true)} className="text-xs text-primary hover:underline">
                      Reconnect
                    </button>
                  )}
                  <button onClick={unlinkWallet} className="p-1.5 text-foreground/40 hover:text-error transition-colors" title="Unlink wallet">
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
            >
              <RefreshCw className={`w-4 h-4 ${loadingDomains ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl border border-primary/30 p-6">
            {loadingDomains ? (
              <div className="text-center py-8">
                <RefreshCw className="w-6 h-6 text-primary mx-auto mb-3 animate-spin" />
                <p className="text-sm text-foreground/80">Loading your domains...</p>
              </div>
            ) : ownedNames.length === 0 ? (
              <div className="text-center py-8">
                <Globe className="w-12 h-12 text-primary/50 mx-auto mb-4" />
                <h3 className="font-heading font-bold text-foreground mb-2">No Domains Yet</h3>
                <p className="text-sm text-foreground/80 mb-4">
                  Register an ArNS domain to give your apps and sites friendly names
                </p>
                <button
                  onClick={() => navigate('/domains')}
                  className="px-4 py-2 bg-primary text-white rounded-full font-medium hover:bg-primary/90 transition-colors"
                >
                  Search for Your Name
                </button>
              </div>
            ) : (
              <>
                <div className="grid gap-4 mb-6">
                  {ownedNames.slice(0, 5).map((domain) => (
                    <OwnedName key={domain.name} domain={domain} />
                  ))}
                </div>

                {ownedNames.length > 0 && (
                  <div className="text-center pt-4 border-t border-primary/20">
                    <button
                      onClick={() => window.open('https://arns.ar.io/#/manage/names', '_blank')}
                      className="flex items-center justify-center gap-2 px-6 py-3 text-foreground hover:text-foreground/80 transition-colors font-medium"
                    >
                      View All Domains
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showLinkModal && (
        <LinkSolanaWalletModal onClose={() => setShowLinkModal(false)} />
      )}

      {/* Activity & Management */}
      <div className="space-y-6">
        <h2 className="font-heading font-bold text-xl text-foreground">Activity</h2>

        {/* Activity Overview */}
        <ActivityOverview />
      </div>
    </div>
  );
}
