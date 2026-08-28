import { useState } from 'react';
import { CreditCard, Wallet } from 'lucide-react';

import BaseModal from '../../../components/modals/BaseModal';
import StripeElementsProvider from '../../../components/StripeElementsProvider';
import TopUpPanel, {
  type TopUpHostStep,
} from '../../../components/panels/TopUpPanel';
import type { SupportedTokenType } from '../../../constants';
import ModalHeader from '../../../components/modals/ModalHeader';

interface ArNSPaymentModalProps {
  /** USD to pre-seed the amount (rounded up to cover the name's price). */
  initialUsdAmount?: number;
  /** Credits still needed — shown as context in the header. */
  shortfallCredits?: number;
  /** Card or token, already chosen on the checkout surface. */
  paymentMethod: 'fiat' | 'crypto';
  /** Which token, when paying with crypto. */
  token?: SupportedTokenType;
  /** Ticker for the header, e.g. "SOL". */
  tokenLabel?: string;
  /** The name being bought — makes the fiat panels speak about it, not storage. */
  arnsName?: string;
  /**
   * SOL the wallet still pays for network costs, on top of this payment.
   *
   * This route funds the NAME only; the ANT's account rent is paid by the
   * user's own Solana wallet at registration. "This covers your name" is true
   * and easy to read as "this covers everything", which it does not.
   */
  networkSol?: number;
  onClose: () => void;
  /** Fired when payment completes (credits landed). */
  onComplete: () => void;
}

/**
 * The payment step of an ArNS purchase, for the methods that can't pay the
 * contract directly.
 *
 * ARIO settles a name in one transaction; a card or SOL has to become credits
 * first. That conversion is real and can't be wished away, but it is *our*
 * plumbing, not a decision — so this modal continues the payment the user
 * already chose rather than starting a new one. It opens on their method, with
 * the amount sized to the name, and never re-asks how they want to pay.
 *
 * Previously this was `BuyCreditsModal`: choosing "Turbo Credits" on the
 * checkout opened it, and it asked "card or crypto?" — the same question the
 * checkout had just asked, one layer down and phrased in terms of our billing
 * product. Hence the rename; the job changed.
 */
export default function ArNSPaymentModal({
  initialUsdAmount,
  shortfallCredits,
  paymentMethod,
  token,
  tokenLabel,
  arnsName,
  networkSol,
  onClose,
  onComplete,
}: ArNSPaymentModalProps) {
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<TopUpHostStep>('details');
  const payingByCard = paymentMethod === 'fiat';

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
      <div className="w-[92vw] max-w-xl p-4 sm:p-5">
        {/*
          Gone once the payment lands. "Pay for name.ar.io — you'll confirm
          registration next" is a promise about a step the user has just
          finished paying for, and reads as stale instructions on the screen
          that reports success. That screen brings its own heading (a green
          check and "Payment Complete!"), so the modal steps out of its way
          rather than competing with a second title.
        */}
        {step !== 'success' && (
        <ModalHeader
          icon={payingByCard ? CreditCard : Wallet}
          title={
            arnsName
              ? `Pay for ${arnsName}.ar.io`
              : payingByCard
                ? 'Pay with card'
                : `Pay with ${tokenLabel ?? 'crypto'}`
          }
          description={
            shortfallCredits != null && shortfallCredits > 0 ? (
              <>
                {/* Trimmed: this was the tallest thing in the modal, and at
                    ~110 characters it wrapped to three lines and pushed the
                    terms link below the fold. */}
                Covers the name only
                {networkSol != null && networkSol > 0 ? (
                  <>
                    {' '}
                    — your wallet pays ~
                    {networkSol.toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}{' '}
                    SOL in network costs next
                  </>
                ) : null}
                .
              </>
            ) : undefined
          }
        />
        )}

        <StripeElementsProvider>
          <TopUpPanel
            embedded
            initialUsdAmount={initialUsdAmount}
            // Sizes the CRYPTO side. Without it a token top-up here falls back
            // to the panel's 0.01 default instead of the name's price.
            initialCreditAmount={shortfallCredits}
            initialPaymentMethod={paymentMethod}
            purpose={arnsName ? { kind: 'arns-name', name: arnsName } : undefined}
            initialToken={token}
            // The card flow opens on the card form; its Back has nothing behind
            // it inside the panel, so it closes the modal instead.
            onCancel={onClose}
            onStepChange={setStep}
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
