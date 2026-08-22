/**
 * The purchase lifecycle, as a pure reducer.
 *
 * Today's purchases are synchronous: one on-chain write, then success or error.
 * A fiat purchase is not — the card clears, the bundler settles asynchronously,
 * and it can fail *after* the money is taken, at which point a refund runs. Those
 * money states have to exist in the model before the UI can tell the truth about
 * them; a machine that only knows success and error will report a refund as a
 * failure.
 *
 * So the synchronous path is modelled as a degenerate case of the asynchronous
 * one: it enters at `submitting` and goes straight to `succeeded`, skipping the
 * states only fiat visits. One machine, one set of terminal states, one success
 * screen — rather than a parallel `useBuyArNSNameWithCard` that would drift.
 *
 * Pure by design: no React, no SDK, no fetch. That is what makes it testable
 * under this repo's node-only harness.
 */

export type PurchaseState =
  | { status: 'idle' }
  /** Sync path: on-chain write in flight. */
  | { status: 'submitting' }
  /** Fiat: asking the bundler to price + open a Stripe session. */
  | { status: 'quoting' }
  /** Fiat: quote in hand, waiting on the user's card details. */
  | { status: 'awaitingPayment'; nonce: string; expiresAt: number }
  /** Fiat: card cleared, bundler settling on-chain. The money is already spent. */
  | { status: 'settling'; nonce: string }
  | { status: 'succeeded'; messageId: string; nonce?: string }
  /**
   * Paid, but we stopped waiting before a terminal answer. NOT a failure —
   * the purchase may still complete. Distinct from `failed` on purpose.
   */
  | { status: 'indeterminate'; nonce: string }
  /** Settled as failed on-chain. Money is being returned. */
  | { status: 'failed'; nonce: string; refund: 'pending' | 'done' | 'unknown' }
  /** Failed before any money moved (validation, no signer, quote error). */
  | { status: 'error'; message: string };

export type PurchaseEvent =
  | { type: 'SUBMIT' }
  | { type: 'QUOTE' }
  | { type: 'QUOTED'; nonce: string; expiresAt: number }
  | { type: 'QUOTE_EXPIRED' }
  | { type: 'PAID'; nonce: string }
  | { type: 'SETTLED'; messageId: string }
  | { type: 'SETTLE_FAILED' }
  | { type: 'REFUND_UPDATE'; refund: 'pending' | 'done' | 'unknown' }
  | { type: 'GAVE_UP' }
  | { type: 'ERROR'; message: string }
  | { type: 'RESET' };

export const initialPurchaseState: PurchaseState = { status: 'idle' };

/** True once the user's money is committed and cannot simply be abandoned. */
export function isMoneyAtRisk(s: PurchaseState): boolean {
  return s.status === 'settling' || s.status === 'indeterminate' || s.status === 'failed';
}

/** Terminal for UI purposes — nothing further will happen without user action. */
export function isTerminal(s: PurchaseState): boolean {
  return (
    s.status === 'succeeded' ||
    s.status === 'failed' ||
    s.status === 'error' ||
    s.status === 'indeterminate'
  );
}

export function purchaseReducer(state: PurchaseState, event: PurchaseEvent): PurchaseState {
  // RESET is always honoured EXCEPT once money is at risk — dropping a settling
  // purchase from the UI would strand the user with no record of a real charge.
  if (event.type === 'RESET') {
    return isMoneyAtRisk(state) ? state : { status: 'idle' };
  }

  switch (state.status) {
    case 'idle':
      if (event.type === 'SUBMIT') return { status: 'submitting' };
      if (event.type === 'QUOTE') return { status: 'quoting' };
      if (event.type === 'ERROR') return { status: 'error', message: event.message };
      return state;

    case 'submitting':
      if (event.type === 'SETTLED') return { status: 'succeeded', messageId: event.messageId };
      if (event.type === 'ERROR') return { status: 'error', message: event.message };
      return state;

    case 'quoting':
      if (event.type === 'QUOTED')
        return { status: 'awaitingPayment', nonce: event.nonce, expiresAt: event.expiresAt };
      if (event.type === 'ERROR') return { status: 'error', message: event.message };
      return state;

    case 'awaitingPayment':
      // No money has moved yet, so an expired quote is recoverable, not fatal.
      if (event.type === 'QUOTE_EXPIRED') return { status: 'quoting' };
      if (event.type === 'PAID') return { status: 'settling', nonce: event.nonce };
      if (event.type === 'ERROR') return { status: 'error', message: event.message };
      return state;

    case 'settling':
      if (event.type === 'SETTLED')
        return { status: 'succeeded', messageId: event.messageId, nonce: state.nonce };
      if (event.type === 'SETTLE_FAILED')
        return { status: 'failed', nonce: state.nonce, refund: 'pending' };
      if (event.type === 'GAVE_UP') return { status: 'indeterminate', nonce: state.nonce };
      // An ERROR here is a POLLING error, not a purchase failure. The money is
      // already spent, so it must never demote to `error` — keep settling.
      return state;

    case 'indeterminate':
      // Still recoverable: a later poll can resolve it either way.
      if (event.type === 'SETTLED')
        return { status: 'succeeded', messageId: event.messageId, nonce: state.nonce };
      if (event.type === 'SETTLE_FAILED')
        return { status: 'failed', nonce: state.nonce, refund: 'pending' };
      return state;

    case 'failed':
      if (event.type === 'REFUND_UPDATE') return { ...state, refund: event.refund };
      return state;

    case 'succeeded':
    case 'error':
      return state;
  }
}
