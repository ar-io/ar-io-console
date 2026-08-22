import { describe, expect, it } from 'vitest';

import {
  initialPurchaseState as init,
  isMoneyAtRisk,
  isTerminal,
  purchaseReducer as r,
  type PurchaseEvent,
  type PurchaseState,
} from './purchaseMachine';

const run = (s: PurchaseState, ...es: PurchaseEvent[]) => es.reduce(r, s);

describe('synchronous path (credits / ARIO) — today\'s behaviour', () => {
  it('idle → submitting → succeeded', () => {
    const s = run(init, { type: 'SUBMIT' }, { type: 'SETTLED', messageId: 'tx' });
    expect(s).toEqual({ status: 'succeeded', messageId: 'tx' });
  });

  it('idle → submitting → error', () => {
    const s = run(init, { type: 'SUBMIT' }, { type: 'ERROR', message: 'nope' });
    expect(s).toEqual({ status: 'error', message: 'nope' });
  });

  it('never visits the fiat-only states', () => {
    const s = run(init, { type: 'SUBMIT' }, { type: 'SETTLED', messageId: 'tx' });
    expect(['quoting', 'awaitingPayment', 'settling']).not.toContain(s.status);
  });
});

describe('fiat path', () => {
  const paid = run(init,
    { type: 'QUOTE' },
    { type: 'QUOTED', nonce: 'n1', expiresAt: 1000 },
    { type: 'PAID', nonce: 'n1' });

  it('walks quote → awaiting payment → settling', () => {
    expect(paid).toEqual({ status: 'settling', nonce: 'n1' });
  });

  it('an expired quote returns to quoting — no money moved, so it is recoverable', () => {
    const s = run(init,
      { type: 'QUOTE' },
      { type: 'QUOTED', nonce: 'n1', expiresAt: 1 },
      { type: 'QUOTE_EXPIRED' });
    expect(s.status).toBe('quoting');
  });

  it('settles to success carrying the nonce', () => {
    expect(r(paid, { type: 'SETTLED', messageId: 'msg' })).toEqual({
      status: 'succeeded', messageId: 'msg', nonce: 'n1',
    });
  });

  it('a settlement failure enters failed with a pending refund', () => {
    expect(r(paid, { type: 'SETTLE_FAILED' })).toEqual({
      status: 'failed', nonce: 'n1', refund: 'pending',
    });
  });

  it('tracks the refund to completion', () => {
    const s = run(paid, { type: 'SETTLE_FAILED' }, { type: 'REFUND_UPDATE', refund: 'done' });
    expect(s).toEqual({ status: 'failed', nonce: 'n1', refund: 'done' });
  });
});

describe('money safety', () => {
  const settling = run(init,
    { type: 'QUOTE' },
    { type: 'QUOTED', nonce: 'n1', expiresAt: 1000 },
    { type: 'PAID', nonce: 'n1' });

  it('a polling ERROR while settling does NOT demote to error — the money is spent', () => {
    // The single most important transition here. A transient poll failure must
    // never be shown as a failed purchase.
    expect(r(settling, { type: 'ERROR', message: 'offline' })).toEqual(settling);
  });

  it('giving up yields indeterminate, which is NOT failed', () => {
    const s = r(settling, { type: 'GAVE_UP' });
    expect(s).toEqual({ status: 'indeterminate', nonce: 'n1' });
    expect(s.status).not.toBe('failed');
  });

  it('an indeterminate purchase can still resolve either way later', () => {
    const ind = r(settling, { type: 'GAVE_UP' });
    expect(r(ind, { type: 'SETTLED', messageId: 'late' }).status).toBe('succeeded');
    expect(r(ind, { type: 'SETTLE_FAILED' }).status).toBe('failed');
  });

  it('RESET cannot discard a purchase whose money is at risk', () => {
    for (const s of [settling, r(settling, { type: 'GAVE_UP' }), r(settling, { type: 'SETTLE_FAILED' })]) {
      expect(r(s, { type: 'RESET' })).toEqual(s);
      expect(isMoneyAtRisk(s)).toBe(true);
    }
  });

  it('RESET works everywhere money is not at risk', () => {
    for (const s of [init, { status: 'submitting' } as PurchaseState, { status: 'quoting' } as PurchaseState]) {
      expect(r(s, { type: 'RESET' })).toEqual({ status: 'idle' });
    }
  });
});

describe('illegal transitions are ignored, not crashes', () => {
  it('PAID in idle does nothing', () => {
    expect(r(init, { type: 'PAID', nonce: 'x' })).toEqual(init);
  });
  it('SETTLED in quoting does nothing', () => {
    expect(r({ status: 'quoting' }, { type: 'SETTLED', messageId: 'x' }).status).toBe('quoting');
  });
  it('terminal success absorbs further events', () => {
    const done: PurchaseState = { status: 'succeeded', messageId: 'x' };
    expect(r(done, { type: 'SETTLE_FAILED' })).toEqual(done);
  });
});

describe('isTerminal', () => {
  it('includes indeterminate — nothing more happens without user action', () => {
    expect(isTerminal({ status: 'indeterminate', nonce: 'n' })).toBe(true);
    expect(isTerminal({ status: 'settling', nonce: 'n' })).toBe(false);
    expect(isTerminal({ status: 'submitting' })).toBe(false);
  });
});
