import { describe, expect, it } from 'vitest';

import {
  classifyQuoteError, clientSecretOf, fiatAmountToMajorUnits, formatFiatAmount,
  hasMinimumChargeExcess, isQuoteExpired, minimumChargeExcessWinc, msUntilExpiry,
} from './fiatQuote';

const q = (o: Record<string, unknown>) => o as never;

describe('classifyQuoteError', () => {
  it('treats 503 as fiat-disabled, not a failure', () => {
    // Normal in the testnet sandbox. Reporting it as an error sends people
    // chasing a bug that is really a config flag.
    expect(classifyQuoteError({ status: 503 }).kind).toBe('disabled');
    expect(classifyQuoteError({ response: { status: 503 } }).kind).toBe('disabled');
    expect(classifyQuoteError(new Error('Fiat (Stripe) ArNS payments are disabled')).kind)
      .toBe('disabled');
  });

  it('treats a provisioning-disabled 400 as disabled, not as user error', () => {
    // Custodial buys send no processId; the service 400s unless
    // ARNS_PROVISIONING_ENABLED=true. Showing that verbatim names a parameter
    // the user cannot supply — it must remove the card option instead.
    expect(
      classifyQuoteError({
        status: 400,
        message: 'Missing required parameter: processId (ArNS provisioning is disabled)',
      }).kind,
    ).toBe('disabled');
  });

  it('routes 400 to the field, not to a toast', () => {
    const f = classifyQuoteError({ status: 400, message: 'name too short' });
    expect(f.kind).toBe('invalid');
    expect(f).toHaveProperty('message', 'name too short');
  });

  it('keeps anything else distinguishable as unavailable', () => {
    expect(classifyQuoteError({ status: 500 }).kind).toBe('unavailable');
    expect(classifyQuoteError(undefined).kind).toBe('unavailable');
    expect(classifyQuoteError('boom').kind).toBe('unavailable');
  });
});

describe('quote expiry', () => {
  const at = (iso: string) => q({ quoteExpirationDate: iso });

  it('measures the remaining window', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    expect(msUntilExpiry(at('2026-01-01T00:05:00Z'), now)).toBe(300_000);
    expect(isQuoteExpired(at('2026-01-01T00:05:00Z'), now)).toBe(false);
  });

  it('counts the exact expiry instant as expired', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    expect(isQuoteExpired(at('2026-01-01T00:00:00Z'), now)).toBe(true);
  });

  it('never expires a quote on an unparseable date', () => {
    // Date.parse('') is NaN; NaN - now is NaN, and NaN <= 0 is false — but
    // relying on that is luck. An unknown deadline must mean "no deadline",
    // not "throw away a quote the user already paid attention to".
    const now = Date.parse('2026-01-01T00:00:00Z');
    expect(isQuoteExpired(at('not-a-date'), now)).toBe(false);
    expect(msUntilExpiry(at(''), now)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('minimum-charge excess', () => {
  it('detects the excess credits from a raised charge', () => {
    expect(minimumChargeExcessWinc(q({ excessWincAmount: '123456' }))).toBe(123456n);
    expect(hasMinimumChargeExcess(q({ excessWincAmount: '123456' }))).toBe(true);
  });

  it('reports no excess when the charge matched the price', () => {
    for (const v of [undefined, '', '0']) {
      expect(hasMinimumChargeExcess(q({ excessWincAmount: v }))).toBe(false);
    }
  });

  it('survives a malformed amount instead of throwing mid-checkout', () => {
    // BigInt('abc') throws; an unreadable field must not take down the page
    // the user is about to be charged on.
    expect(minimumChargeExcessWinc(q({ excessWincAmount: 'abc' }))).toBe(0n);
    expect(minimumChargeExcessWinc(q({ excessWincAmount: '-5' }))).toBe(0n);
  });

  it('handles amounts beyond Number precision', () => {
    // winc values are big; parseInt would silently round these.
    expect(minimumChargeExcessWinc(q({ excessWincAmount: '9007199254740993' })))
      .toBe(9007199254740993n);
  });
});

describe('fiatAmountToMajorUnits', () => {
  it('converts cents to dollars', () => {
    // The price route's fiatEstimate and the quote's paymentAmount are BOTH in
    // the smallest unit. Assigning either straight to a "usd" field renders a
    // $5.00 name as $500 — the bug this exists to prevent.
    expect(fiatAmountToMajorUnits(500, 'usd')).toBe(5);
    expect(fiatAmountToMajorUnits(1234, 'USD')).toBe(12.34);
  });

  it('leaves zero-decimal currencies alone', () => {
    expect(fiatAmountToMajorUnits(500, 'jpy')).toBe(500);
  });
});

describe('formatFiatAmount', () => {
  it('renders minor units as currency', () => {
    expect(formatFiatAmount(500, 'usd')).toContain('5.00');
    expect(formatFiatAmount(1234, 'USD')).toContain('12.34');
  });

  it('does not divide zero-decimal currencies by 100', () => {
    // ¥500 is 500, not ¥5 — off by 100x in the direction that under-reports
    // what we are about to charge.
    expect(formatFiatAmount(500, 'jpy')).toMatch(/500/);
    expect(formatFiatAmount(500, 'jpy')).not.toMatch(/[^0-9]5[^0-9]/);
  });

  it('still shows a number for an unknown currency code', () => {
    const out = formatFiatAmount(500, 'zzz');
    expect(out).toContain('5.00');
    expect(out).toContain('ZZZ');
  });
});

describe('clientSecretOf', () => {
  it('extracts a usable secret and normalises null to undefined', () => {
    expect(clientSecretOf({ client_secret: 'pi_1_secret' })).toBe('pi_1_secret');
    expect(clientSecretOf({ client_secret: null })).toBeUndefined();
    expect(clientSecretOf({})).toBeUndefined();
  });
});
