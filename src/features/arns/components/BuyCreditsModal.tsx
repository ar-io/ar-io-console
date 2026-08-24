import { CreditCard } from 'lucide-react';

import BaseModal from '../../../components/modals/BaseModal';
import StripeElementsProvider from '../../../components/StripeElementsProvider';
import TopUpPanel from '../../../components/panels/TopUpPanel';
import { minUSDAmount } from '../../../constants';

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
      <div className="w-[92vw] max-w-xl p-6">
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
          {/*
            The exact shortfall is pre-filled below, but purchases have a
            ${minUSDAmount} floor, so a name costing cents still charges the
            minimum. Saying so is the difference between "why am I being charged
            $5?" and a understood trade — and the remainder is not lost, it
            stays spendable. Only shown when the minimum actually binds.
          */}
          {initialUsdAmount != null && initialUsdAmount < minUSDAmount && (
            <p className="mt-2 text-xs text-foreground/60">
              Purchases start at ${minUSDAmount}. Anything you don&apos;t spend on
              this name stays in your balance for future names and uploads.
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
