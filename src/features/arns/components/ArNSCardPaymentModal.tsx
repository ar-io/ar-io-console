import { useEffect, useRef, useState } from 'react';
import { CardElement } from '@stripe/react-stripe-js';
import type { StripeCardElementOptions } from '@stripe/stripe-js';
import {
  AlertTriangle, CheckCircle2, Clock, CreditCard, Loader2, XCircle,
} from 'lucide-react';

import BaseModal from '../../../components/modals/BaseModal';
import StripeElementsProvider from '../../../components/StripeElementsProvider';
import { useArNSFiatPurchase, type FiatQuoteInput } from '../hooks/useArNSFiatPurchase';
import { formatFiatAmount, hasMinimumChargeExcess } from '../purchase/fiatQuote';
import { isMoneyAtRisk } from '../purchase/purchaseMachine';
import ModalHeader from '../../../components/modals/ModalHeader';

/** Matches the app's other card input; Stripe's iframe can't read our CSS vars. */
const cardElementOptions: StripeCardElementOptions = {
  style: {
    base: {
      color: '#23232D',
      fontSize: '16px',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      '::placeholder': { color: '#65656C' },
    },
  },
  hidePostalCode: true,
};

interface Props {
  quoteInput: FiatQuoteInput;
  /** Shown while quoting so the user isn't staring at a blank price. */
  displayName: string;
  onClose: () => void;
  /** Fired once the name is registered; carries the on-chain tx id. */
  onSuccess: (messageId: string) => void;
  /** Card is unavailable service-side — the host hides the option. */
  onFiatDisabled?: () => void;
}

interface CheckoutProps extends Props {
  /** Raised while a charge is in flight, so the shell can block dismissal. */
  onAtRiskChange: (atRisk: boolean) => void;
}

function CardCheckout({
  quoteInput, displayName, onClose, onSuccess, onFiatDisabled, onAtRiskChange,
}: CheckoutProps) {
  const { state, quote, failure, requestQuote, confirmCard, reset, isBusy } =
    useArNSFiatPurchase();

  // Quote once on open, and re-quote on a real change of what's being bought.
  const key = JSON.stringify(quoteInput);
  useEffect(() => {
    void requestQuote(quoteInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const notified = useRef(false);
  useEffect(() => {
    if (failure?.kind === 'disabled' && !notified.current) {
      notified.current = true;
      onFiatDisabled?.();
    }
  }, [failure, onFiatDisabled]);

  useEffect(() => {
    if (state.status === 'succeeded') onSuccess(state.messageId);
  }, [state, onSuccess]);

  // Tearing the modal down mid-charge would let the payment land with no UI to
  // report it — the same failure PendingTxRecoveryBanner exists to clean up.
  const atRisk = isMoneyAtRisk(state);
  useEffect(() => {
    onAtRiskChange(atRisk);
  }, [atRisk, onAtRiskChange]);

  const amount = quote
    ? formatFiatAmount(quote.paymentAmount, quote.currencyType)
    : undefined;

  return (
    <div className="w-[92vw] max-w-md p-4 sm:p-5">
      <ModalHeader icon={CreditCard} title="Pay with card" />

      {state.status === 'quoting' && (
        <p className="flex items-center gap-2 text-sm text-foreground/70">
          <Loader2 className="h-4 w-4 animate-spin" />{' '}
          {/* Re-entered here after an expired quote, so don't claim it's the
              first look — the user already saw a price. */}
          {quote
            ? 'That price expired — getting a fresh one…'
            : `Getting a price for ${displayName}…`}
        </p>
      )}

      {/* Terminal states first — once money has moved, nothing else matters. */}
      {state.status === 'succeeded' && (
        <div className="flex items-start gap-2 rounded-2xl border border-success/20 bg-success/10 p-4 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
          <span>
            <span className="font-medium text-foreground">
              {displayName} is registered.
            </span>{' '}
            {/*
              No caveat left to state. The name is minted straight to the
              buyer's wallet, so there is nothing held on their behalf and
              nothing to claim later.
            */}
            It&apos;s in your wallet, and Turbo paid the Solana fees.
          </span>
        </div>
      )}

      {state.status === 'settling' && (
        <p className="flex items-center gap-2 text-sm text-foreground/70">
          <Loader2 className="h-4 w-4 animate-spin" /> Payment received —
          registering {displayName}. Don&apos;t close this window.
        </p>
      )}

      {/* A charge that couldn't be settled is refunded, not lost. Saying
          "failed" alone would read as "you paid and got nothing". */}
      {state.status === 'failed' && (
        <div className="flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
          <span>
            <span className="font-medium text-foreground">
              We couldn&apos;t register {displayName}.
            </span>{' '}
            Your payment is being refunded — it should appear on your statement
            within a few days. No name was registered.
          </span>
        </div>
      )}

      {/* Timed out watching. The purchase may still land, so this must not
          claim failure — telling someone it failed invites a double purchase. */}
      {state.status === 'indeterminate' && (
        <div className="flex items-start gap-2 rounded-2xl border border-border/20 bg-card p-4 text-sm">
          <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground/60" />
          <span>
            <span className="font-medium text-foreground">
              This is taking longer than usual.
            </span>{' '}
            Your payment went through and registration is still in progress.
            Check your names in a few minutes before trying again.
          </span>
        </div>
      )}

      {state.status === 'error' && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{state.message}</span>
        </div>
      )}

      {(state.status === 'awaitingPayment' || state.status === 'submitting') &&
        quote && (
          <>
            <div className="mb-4 rounded-2xl border border-border/20 bg-card p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-foreground/70">
                  {displayName}
                </span>
                <span className="font-heading text-2xl font-extrabold text-foreground">
                  {amount}
                </span>
              </div>
              {/* Stripe won't process below its minimum, so a cheap name is
                  charged more than it costs. Say so BEFORE charging. */}
              {hasMinimumChargeExcess(quote) && (
                <p className="mt-2 text-xs text-foreground/70">
                  Card payments have a minimum charge. The difference is added
                  to your credit balance to use on anything else.
                </p>
              )}
            </div>

            <label
              htmlFor="arns-card"
              className="mb-2 block text-sm font-medium text-foreground/80"
            >
              Card details
            </label>
            <div
              id="arns-card"
              className="mb-4 w-full rounded-2xl border border-border/20 bg-card px-4 py-3"
            >
              <CardElement options={cardElementOptions} />
            </div>

            <button
              type="button"
              onClick={() => void confirmCard()}
              disabled={isBusy}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {state.status === 'submitting' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Charging…
                </>
              ) : (
                <>Pay {amount}</>
              )}
            </button>
          </>
        )}

      {state.status === 'error' && failure?.kind !== 'disabled' && (
        <button
          type="button"
          onClick={() => {
            reset();
            void requestQuote(quoteInput);
          }}
          className="mt-3 w-full rounded-full border border-border/20 px-6 py-2.5 text-sm font-semibold text-foreground hover:border-primary/40"
        >
          Try again
        </button>
      )}

      {(state.status === 'succeeded' ||
        state.status === 'failed' ||
        state.status === 'indeterminate') && (
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-full bg-foreground px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Done
        </button>
      )}

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
  );
}

/**
 * One-step card → name checkout.
 *
 * The payment service quotes the purchase, charges the card, and performs the
 * Solana write itself — the buyer never holds credits. That is what makes
 * "Card" an honest peer of "SOL" in the picker rather than a detour through our
 * billing product.
 */
export default function ArNSCardPaymentModal(props: Props) {
  const [atRisk, setAtRisk] = useState(false);
  return (
    /* Escape and backdrop clicks stay live until a charge is actually in
       flight. The close button always remains — trapping someone in a checkout
       is worse than the accident it would prevent. */
    <BaseModal onClose={props.onClose} showCloseButton dismissible={!atRisk}>
      <StripeElementsProvider>
        <CardCheckout {...props} onAtRiskChange={setAtRisk} />
      </StripeElementsProvider>
    </BaseModal>
  );
}
