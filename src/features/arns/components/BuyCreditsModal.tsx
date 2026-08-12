import { CreditCard } from 'lucide-react';

import BaseModal from '../../../components/modals/BaseModal';
import StripeElementsProvider from '../../../components/StripeElementsProvider';
import TopUpPanel from '../../../components/panels/TopUpPanel';

interface BuyCreditsModalProps {
  /** USD to pre-seed the top-up amount (rounded up to cover the shortfall). */
  initialUsdAmount?: number;
  /** Credits still needed — shown as context in the header. */
  shortfallCredits?: number;
  onClose: () => void;
  /** Fired when a top-up completes (credits landed). */
  onComplete: () => void;
}

/**
 * On-demand credit top-up during an ArNS purchase: the full console top-up flow
 * (Card + Crypto incl. SOL) in a modal, pre-seeded with the credit shortfall.
 * On completion the store's credit balance refreshes and the ArNS buy re-enables
 * — the user never leaves the checkout.
 */
export default function BuyCreditsModal({
  initialUsdAmount,
  shortfallCredits,
  onClose,
  onComplete,
}: BuyCreditsModalProps) {
  return (
    <BaseModal onClose={onClose} showCloseButton>
      <div className="max-h-[90vh] w-[92vw] max-w-xl overflow-y-auto p-6">
        <div className="mb-5">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-xl font-extrabold text-foreground">
              Buy Turbo Credits
            </h3>
          </div>
          {shortfallCredits != null && shortfallCredits > 0 && (
            <p className="mt-1 text-sm text-foreground/70">
              You need about{' '}
              {shortfallCredits.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}{' '}
              more credits to continue.
            </p>
          )}
        </div>

        <StripeElementsProvider>
          <TopUpPanel
            embedded
            initialUsdAmount={initialUsdAmount}
            onComplete={onComplete}
          />
        </StripeElementsProvider>
      </div>
    </BaseModal>
  );
}
