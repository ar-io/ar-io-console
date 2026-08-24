import { useState } from 'react';
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
  const [busy, setBusy] = useState(false);

  return (
    /*
      `dismissible={!busy}` blocks Escape and backdrop clicks while a payment is
      in flight — an accidental dismissal there would let the charge land with
      no UI to report it, and PendingTxRecoveryBanner exists because people do
      lose transfers this way.

      The close button deliberately STAYS. Hiding it too would trap the user
      inside a flow they may have good reason to abandon; the goal is to prevent
      an accident, not to remove the exit.
    */
    <BaseModal onClose={onClose} showCloseButton dismissible={!busy}>
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
              ${minUSDAmount} minimum — the rest stays as credits.
            </p>
          )}
        </div>

        <StripeElementsProvider>
          <TopUpPanel
            embedded
            initialUsdAmount={initialUsdAmount}
            onComplete={onComplete}
            onBusyChange={setBusy}
          />
        </StripeElementsProvider>

        {/* Same wording and destination as Deploy / Upload / Capture / Try It
            Now — this flow was the only paid action without it. */}
        <p className="mt-4 text-center text-xs text-foreground/80">
          By continuing, you agree to our{' '}
          <a
            href="https://ardrive.io/tos-and-privacy/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline transition-colors hover:text-primary/80"
          >
            Terms of Service
          </a>
        </p>
      </div>
    </BaseModal>
  );
}
