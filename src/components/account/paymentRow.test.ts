import { describe, expect, it } from 'vitest';

import {
  isCryptoPayment,
  isFiatPayment,
  paymentKind,
  paymentReference,
  shortReference,
} from './paymentRow';

const crypto = {
  type: 'crypto',
  date: '2026-09-07T13:14:24Z',
  wincCredited: '3656779707380',
  tokenType: 'solana',
  tokenQuantity: '158593591',
  usdEquivalent: '16.76',
  senderAddress: 'Yywrf6Ry',
  transactionId: '2EDVz4iovUyBKghNwULckDK3wW9qXmdZsATqFkj5R6Aj',
  blockHeight: '1',
} as never;

const fiat = {
  type: 'fiat',
  date: '2026-09-07T12:00:00Z',
  wincCredited: '1000000000000',
  paymentAmount: '1000',
  currencyType: 'usd',
  paymentProvider: 'stripe',
  receiptId: 'rcpt_abcdef123456',
  giftMessage: null,
} as never;

describe('paymentKind', () => {
  it('recognises the two kinds the SDK declares', () => {
    expect(paymentKind(crypto)).toBe('crypto');
    expect(paymentKind(fiat)).toBe('fiat');
  });

  /*
    The crash. The SDK types history as a CLOSED union, and the row renderer
    trusted it — anything not 'crypto' fell into the fiat branch and read
    `receiptId`. A kind this build has never heard of therefore sliced
    undefined, and a throw during render unmounts the route, so one row took
    down the whole Account page.
  */
  it('does not mistake an unknown kind for fiat', () => {
    expect(paymentKind({ type: 'refund' } as never)).toBe('unknown');
    expect(paymentKind({ type: undefined } as never)).toBe('unknown');
    expect(paymentKind({} as never)).toBe('unknown');
  });
});

describe('paymentReference', () => {
  it('reads the reference each kind actually carries', () => {
    expect(paymentReference(crypto)).toEqual({
      kind: 'tx',
      value: '2EDVz4iovUyBKghNwULckDK3wW9qXmdZsATqFkj5R6Aj',
    });
    expect(paymentReference(fiat)).toEqual({
      kind: 'receipt',
      value: 'rcpt_abcdef123456',
    });
  });

  it('returns null rather than throwing on a row with no reference', () => {
    expect(paymentReference({ type: 'refund' } as never)).toBeNull();
    expect(paymentReference({} as never)).toBeNull();
  });

  /*
    Read from the DATA, not from `type`. A crypto row whose transactionId the
    service omitted used to slice undefined just as surely as an unknown kind.
  */
  it('survives a known kind missing its own reference', () => {
    expect(paymentReference({ type: 'crypto' } as never)).toBeNull();
    expect(paymentReference({ type: 'fiat' } as never)).toBeNull();
  });

  it('ignores an empty string, which is not a usable reference', () => {
    expect(paymentReference({ type: 'crypto', transactionId: '' } as never)).toBeNull();
    // ...but falls through to a receipt if the row carries one.
    expect(
      paymentReference({ transactionId: '', receiptId: 'r1' } as never),
    ).toEqual({ kind: 'receipt', value: 'r1' });
  });
});

describe('shortReference', () => {
  it('abbreviates a long id from both ends', () => {
    expect(shortReference('2EDVz4iovUyBKghNwULckDK3wW9qXmdZ')).toBe('2EDVz4…XmdZ');
  });
  it('leaves a short id whole rather than padding it with an ellipsis', () => {
    expect(shortReference('rcpt_1')).toBe('rcpt_1');
  });
});

describe('the guards that gate field access', () => {
  it('claims a row only when it really is that kind', () => {
    expect(isCryptoPayment(crypto)).toBe(true);
    expect(isFiatPayment(crypto)).toBe(false);
    expect(isFiatPayment(fiat)).toBe(true);
    expect(isCryptoPayment(fiat)).toBe(false);
  });

  /*
    The important case: an unknown row is neither, so the renderer reads no
    fields off it at all. Previously "not crypto" meant "fiat", which is how a
    row with no receiptId reached `.slice`.
  */
  it('refuses an unknown row both ways', () => {
    const unknown = { type: 'refund', wincCredited: '1' } as never;
    expect(isCryptoPayment(unknown)).toBe(false);
    expect(isFiatPayment(unknown)).toBe(false);
  });
});
