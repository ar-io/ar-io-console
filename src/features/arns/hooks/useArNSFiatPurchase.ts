import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useElements, useStripe } from '@stripe/react-stripe-js';
import { CardElement } from '@stripe/react-stripe-js';
import type { ArNSFiatPurchaseQuote } from '@ardrive/turbo-sdk/web';

import { useTurboArNSClient } from './useTurboArNSClient';
import {
  classifyQuoteError, clientSecretOf, isQuoteExpired, type QuoteFailure,
} from '../purchase/fiatQuote';
import { pollPurchaseToTerminal } from '../purchase/pollPurchase';
import {
  purchaseReducer, type PurchaseState,
} from '../purchase/purchaseMachine';
import type { TurboArNSIntent } from '../services/TurboArNSClient';

/** How long to watch settlement before calling it indeterminate. */
const POLL_INTERVAL_MS = 2_500;
const POLL_TIMEOUT_MS = 180_000;

export interface FiatQuoteInput {
  name: string;
  address: string;
  intent?: TurboArNSIntent;
  type?: 'lease' | 'permabuy';
  years?: number;
  increaseQty?: number;
}

export interface UseArNSFiatPurchaseResult {
  state: PurchaseState;
  quote: ArNSFiatPurchaseQuote | undefined;
  /** Why quoting failed — `disabled` means degrade to the credit paths. */
  failure: QuoteFailure | undefined;
  requestQuote: (input: FiatQuoteInput) => Promise<void>;
  confirmCard: () => Promise<void>;
  reset: () => void;
  isBusy: boolean;
}

/**
 * Buy an ArNS name with a card, in one step.
 *
 * Quote → confirm the card → watch the bundler settle it on Solana. The user
 * never holds credits: the payment service debits its own and performs the
 * on-chain write, so this is genuinely card → name rather than
 * card → credits → name.
 *
 * Must be rendered under `StripeElementsProvider` — it uses the shared Elements
 * instance rather than creating a second Stripe context.
 *
 * Three states here exist because money can be at stake and the UI must not lie
 * about it: a settlement failure is refunded server-side (`failed`, not
 * "error"), and a poll that runs out of patience is `indeterminate` — the
 * purchase may still land, so reporting it as a failure would be wrong.
 */
export function useArNSFiatPurchase(): UseArNSFiatPurchaseResult {
  const client = useTurboArNSClient();
  const stripe = useStripe();
  const queryClient = useQueryClient();
  const elements = useElements();

  const [state, setState] = useState<PurchaseState>({ status: 'idle' });
  const [quote, setQuote] = useState<ArNSFiatPurchaseQuote | undefined>();
  const [failure, setFailure] = useState<QuoteFailure | undefined>();

  const secretRef = useRef<string | undefined>();
  // Kept so an expired quote can be re-priced without the caller re-supplying it.
  const lastInputRef = useRef<FiatQuoteInput | undefined>();
  // Cooperative abort so an unmount stops the poll loop instead of leaving it
  // running against a dead component.
  const abortRef = useRef({ aborted: false });
  useEffect(() => {
    const flag = abortRef.current;
    flag.aborted = false;
    return () => {
      flag.aborted = true;
    };
  }, []);

  const dispatch = useCallback((event: Parameters<typeof purchaseReducer>[1]) => {
    setState((prev) => purchaseReducer(prev, event));
  }, []);

  const reset = useCallback(() => {
    secretRef.current = undefined;
    setQuote(undefined);
    setFailure(undefined);
    // RESET is refused by the reducer while money is at risk, so this cannot
    // silently discard an in-flight purchase.
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  const requestQuote = useCallback(
    async (input: FiatQuoteInput) => {
      if (!client) return;
      if (!input.address) {
        // Quoting without a destination returns a 400 the user can do nothing
        // about. The name has to be owned by someone.
        dispatch({
          type: 'ERROR',
          message: 'Connect a wallet so the name has an owner.',
        });
        return;
      }
      setFailure(undefined);
      lastInputRef.current = input;
      dispatch({ type: 'QUOTE' });
      try {
        const res = await client.getFiatQuote(input);
        const q = res.purchaseQuote;
        const secret = clientSecretOf(res.paymentSession);
        if (!secret) {
          // Wrong integration mode, not a user-fixable error — surface it
          // rather than handing Stripe a null secret.
          throw new Error('This payment could not be prepared. Try another method.');
        }
        secretRef.current = secret;
        setQuote(q);
        dispatch({
          type: 'QUOTED',
          nonce: q.nonce,
          expiresAt: Date.parse(q.quoteExpirationDate),
        });
      } catch (err) {
        const f = classifyQuoteError(err);
        setFailure(f);
        dispatch({
          type: 'ERROR',
          message:
            f.kind === 'disabled'
              ? 'Card payments are unavailable right now.'
              : f.kind === 'invalid'
                ? f.message
                : 'Could not get a price for this name. Try again.',
        });
      }
    },
    [client, dispatch],
  );

  const confirmCard = useCallback(async () => {
    const secret = secretRef.current;
    const card = elements?.getElement(CardElement);
    if (!stripe || !card || !secret || !quote || !client) return;

    // Re-check expiry at submit, not just at render: a user can sit on the
    // form. Charging against a stale quote is what produces a payment the
    // service will not honour.
    if (isQuoteExpired(quote, Date.now())) {
      // QUOTE_EXPIRED moves the machine to `quoting`; nothing else re-fetches,
      // so without this the user watches a spinner that never resolves.
      dispatch({ type: 'QUOTE_EXPIRED' });
      if (lastInputRef.current) await requestQuote(lastInputRef.current);
      return;
    }

    dispatch({ type: 'SUBMIT' });
    let confirmed;
    try {
      confirmed = await stripe.confirmCardPayment(secret, {
        payment_method: { card },
      });
    } catch (err) {
      dispatch({
        type: 'ERROR',
        message: err instanceof Error ? err.message : 'Card payment failed.',
      });
      return;
    }

    if (confirmed.error) {
      // Declines land here and NO money moved — plain error, not a refund case.
      dispatch({
        type: 'ERROR',
        message: confirmed.error.message ?? 'Your card was declined.',
      });
      return;
    }

    // Past this point the charge exists. Every branch below must account for it.
    dispatch({ type: 'PAID', nonce: quote.nonce });

    const outcome = await pollPurchaseToTerminal({
      nonce: quote.nonce,
      readStatus: (n) => client.getIntentStatus(n),
      pollIntervalMs: POLL_INTERVAL_MS,
      pollTimeoutMs: POLL_TIMEOUT_MS,
      now: () => Date.now(),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      signal: abortRef.current,
    });

    if (outcome.kind === 'success') {
      dispatch({ type: 'SETTLED', messageId: outcome.messageId });
      // The purchase debited server-side; the balance display may have moved.
      window.dispatchEvent(new CustomEvent('refresh-balance'));
      // A custodial buy just created a name Turbo holds. Without this the
      // 5-minute cache means the detail page shows no custodial panel, no
      // transfer, and mis-gated records for minutes after paying.
      void queryClient.invalidateQueries({ queryKey: ['turbo-arns-names'] });
    } else if (outcome.kind === 'failed') {
      // Settlement failed after the card cleared — the service refunds it.
      dispatch({ type: 'SETTLE_FAILED' });
      dispatch({ type: 'REFUND_UPDATE', refund: 'pending' });
    } else {
      // Timed out. The purchase may STILL complete, so this is deliberately not
      // reported as a failure.
      dispatch({ type: 'GAVE_UP' });
    }
  }, [stripe, elements, quote, client, dispatch, requestQuote, queryClient]);

  return {
    state,
    quote,
    failure,
    requestQuote,
    confirmCard,
    reset,
    isBusy:
      state.status === 'quoting' ||
      state.status === 'submitting' ||
      state.status === 'settling',
  };
}
