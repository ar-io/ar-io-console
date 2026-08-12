import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { User } from 'lucide-react';
import { usePrimaryArNSName } from '@/hooks/usePrimaryArNSName';
import { useLinkedSolanaWallet } from '@/hooks/useLinkedSolanaWallet';
import { makePossessive } from '@/utils';
import WalletIdentityCard from '@/components/account/WalletIdentityCard';
import BalanceCard from '@/components/account/BalanceCard';
import CreditSharingSection from '@/components/account/CreditSharingSection';
import PaymentHistorySection from '@/components/account/PaymentHistorySection';
import LinkSolanaWalletModal from '@/components/modals/LinkSolanaWalletModal';

/**
 * Account (`/account`) — wallet identity + billing only: credits balance,
 * payment history, and credit sharing. Domain management lives on its own page
 * (`/my-domains`), so this page has a single job.
 */
export default function MyAccountPage() {
  const { address, walletType, isPaymentServiceAvailable } = useStore();
  const { arnsAddress, isPrimarySolana, isSolanaConnected, linkedAddress, unlinkWallet } =
    useLinkedSolanaWallet();
  const { arnsName, profile } = usePrimaryArNSName(arnsAddress);
  const [showLinkModal, setShowLinkModal] = useState(false);

  // Redirect to home if not logged in (declarative — never navigate during render)
  if (!address) {
    return <Navigate to="/" replace />;
  }

  const paymentAvailable = isPaymentServiceAvailable();

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
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-foreground mb-1 break-words">
            {arnsName ? `${makePossessive(arnsName)} Account` : 'My Account'}
          </h1>
          <p className="text-sm text-foreground/80">
            Your wallet, credits, and billing.
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
