import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ARNS_TARGET_TX,
  buildBuyRecordArgs,
  routeBuyError,
  submittingMessage,
  toSettlement,
} from './buyDecisions';

describe('buildBuyRecordArgs', () => {
  it('points a new name at the real landing page, not the logo placeholder', () => {
    // Without this the SDK falls back to DEFAULT_ANT_TRANSACTION_ID — the AR.IO
    // logo image, picked only to satisfy `is_valid_arweave_id` — so a
    // freshly-bought name resolved to a picture.
    expect(
      buildBuyRecordArgs({ name: 'abc', type: 'permabuy', referrer: 'r' }).antState,
    ).toEqual({ transactionId: DEFAULT_ARNS_TARGET_TX });
  });

  it('includes years for a lease', () => {
    expect(
      buildBuyRecordArgs({ name: 'abc', type: 'lease', years: 3, fundFrom: 'turbo', referrer: 'R' }),
    ).toMatchObject({
      name: 'abc', type: 'lease', years: 3, fundFrom: 'turbo', referrer: 'R',
    });
  });

  it('OMITS the years key entirely for a permabuy', () => {
    // Not `years: undefined` — the key must be absent, or the SDK sees a
    // permabuy carrying a lease term.
    const args = buildBuyRecordArgs({
      name: 'abc', type: 'permabuy', years: 3, fundFrom: 'turbo', referrer: 'R',
    });
    expect('years' in args).toBe(false);
  });

  it('omits years for a lease with no term given', () => {
    const args = buildBuyRecordArgs({ name: 'abc', type: 'lease', fundFrom: 'turbo', referrer: 'R' });
    expect('years' in args).toBe(false);
  });

  it('never sends processId — that is what keeps the buy atomic', () => {
    // Supplying processId would mean a pre-spawned ANT, reopening the
    // orphaned-ANT window this path exists to avoid.
    const args = buildBuyRecordArgs({ name: 'a', type: 'lease', years: 1, referrer: 'R' });
    expect('processId' in args).toBe(false);
  });
});

describe('toSettlement', () => {
  it('maps a successful response', () => {
    expect(toSettlement({ id: 'tx-1', result: { processId: 'ant-1' } })).toEqual({
      nonce: '',
      messageId: 'tx-1',
      receipt: { processId: 'ant-1' },
    });
  });

  it('leaves nonce empty — this path has no server-side purchase record', () => {
    expect(toSettlement({ id: 'tx-1' }).nonce).toBe('');
  });

  it('tolerates a missing id and a missing processId', () => {
    expect(toSettlement({})).toEqual({ nonce: '', messageId: '', receipt: { processId: null } });
    expect(toSettlement(undefined)).toEqual({
      nonce: '', messageId: '', receipt: { processId: null },
    });
    expect(toSettlement({ id: 'x', result: null })).toEqual({
      nonce: '', messageId: 'x', receipt: { processId: null },
    });
  });
});

describe('routeBuyError', () => {
  it('routes to top-up only when paying with credits AND short on credits', () => {
    expect(routeBuyError({ fundFrom: 'turbo', isInsufficientCredits: true })).toEqual({
      kind: 'insufficient-credits',
    });
  });

  it('does NOT route an ARIO shortfall to the credits top-up', () => {
    // Buying Turbo Credits cannot fix an ARIO shortfall — sending the user to
    // Top-Up would have them spend money that does not unblock the purchase.
    for (const fundFrom of ['balance', 'stakes', 'any', undefined]) {
      expect(routeBuyError({ fundFrom, isInsufficientCredits: true })).toEqual({ kind: 'error' });
    }
  });

  it('treats any other credits-path failure as a normal error', () => {
    expect(routeBuyError({ fundFrom: 'turbo', isInsufficientCredits: false })).toEqual({
      kind: 'error',
    });
  });
});

describe('submittingMessage', () => {
  it('distinguishes permabuy from lease', () => {
    expect(submittingMessage('abc', 'permabuy')).toContain('permanently');
    expect(submittingMessage('abc', 'lease')).not.toContain('permanently');
    expect(submittingMessage('abc', 'lease')).toContain("'abc'");
  });
});
