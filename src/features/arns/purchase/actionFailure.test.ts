import { describe, expect, it } from 'vitest';

import {
  HELD_FALLBACK_MS,
  REFUND_LAG_MS,
  RELEASED_MESSAGE,
  classifyActionFailure,
  clearHeldAttempt,
  explainInsufficient,
  heldByPhrase,
  heldMessage,
  heldStorage,
  heldUntilFrom,
  heldWincFrom,
  isWalletRejection,
  mapActionExpiryMessage,
  readHeldAttempt,
  settledByStatus,
  shouldRecordHold,
  writeHeldAttempt,
  type HeldAttempt,
} from './actionFailure';

/** Shaped like turbo-sdk 2.1.0-alpha.2's FailedRequestError. */
function failed(status: number, body: string) {
  const e = new Error(`Failed request (Status ${status}): ${body}`) as Error & { status: number };
  e.name = 'FailedRequestError';
  e.status = status;
  return e;
}

const NONCE = '3f2b8c1e-5d4a-4b7e-9c0f-1a2b3c4d5e6f';
const withNonce = { nonceCreated: true, nonce: NONCE };
const created = { nonceCreated: true };
const notCreated = { nonceCreated: false };

/*
  The payment service's bodies, verbatim (ar-io-bundler develop), so a wording
  change there breaks a test here instead of silently misclassifying.
*/
const EXPIRED_PREFIX =
  'The signed transaction expired before it could be submitted: Solana only accepts a transaction for about 30 seconds after it is built. ';
const BODY_409_RETURNED = `${EXPIRED_PREFIX}Your credits have been returned. Start the action again and approve it promptly.`;
const BODY_409_HELD = `${EXPIRED_PREFIX}Start the action again and approve it promptly.`;
const BODY_400_REFUNDED = `Action ${NONCE} expired and was refunded; create a new one.`;
const BODY_400_EXPIRED_AT = `Action ${NONCE} expired at 2026-09-30T14:15:00.000Z — its blockhash is no longer valid. … refunded automatically.`;
const BODY_503_BLOCKHASH =
  'failed to send transaction: Transaction simulation failed: Blockhash not found';
const BODY_503_RESERVED =
  "Could not read the ANT's on-chain state … your credits are still reserved";

describe('classifyActionFailure (server bodies)', () => {
  it('409 with "Your credits have been returned": released', () => {
    expect(classifyActionFailure(failed(409, BODY_409_RETURNED), withNonce)).toBe('expired-released');
  });

  it('409 without it: expired, credits held', () => {
    expect(classifyActionFailure(failed(409, BODY_409_HELD), withNonce)).toBe('expired-held');
  });

  it('400 "Action <nonce> expired and was refunded": released', () => {
    expect(classifyActionFailure(failed(400, BODY_400_REFUNDED), withNonce)).toBe('expired-released');
  });

  it('400 "Action <nonce> expired at ... refunded automatically": held until the reconciler runs', () => {
    expect(classifyActionFailure(failed(400, BODY_400_EXPIRED_AT), withNonce)).toBe('expired-held');
  });

  it('503 with the raw "Blockhash not found": unconfirmed, it may still land', () => {
    expect(classifyActionFailure(failed(503, BODY_503_BLOCKHASH), withNonce)).toBe('unconfirmed');
  });

  it('503 "credits are still reserved" is an ordinary failure (its hold is recorded by the caller)', () => {
    expect(classifyActionFailure(failed(503, BODY_503_RESERVED), withNonce)).toBe('other');
  });
});

describe('classifyActionFailure (everything else)', () => {
  it('409 without "expired" is not an expiry', () => {
    expect(classifyActionFailure(failed(409, 'conflict'), withNonce)).toBe('other');
  });

  it('400 naming a DIFFERENT action is not this attempt expiring', () => {
    expect(
      classifyActionFailure(
        failed(400, 'Action 00000000-0000-0000-0000-000000000000 expired and was refunded; create a new one.'),
        withNonce,
      ),
    ).toBe('other');
  });

  it('the ArNS program\'s own "expired" 400s are ordinary errors', () => {
    for (const body of ['Lease has expired', 'Record is expired', 'Reservation has expired']) {
      expect(classifyActionFailure(failed(400, body), withNonce)).toBe('other');
    }
  });

  it('503 for anything else is an ordinary failure', () => {
    expect(classifyActionFailure(failed(503, 'Internal Server Error: boom'), withNonce)).toBe('other');
  });

  it('402 is insufficient credits, by status or by the SDK\'s typed error', () => {
    expect(classifyActionFailure(failed(402, 'Insufficient balance'), notCreated)).toBe('insufficient');
    const typed = new Error('Insufficient Turbo credits') as Error & { status: number };
    typed.name = 'InsufficientCreditsError';
    typed.status = 402;
    expect(classifyActionFailure(typed, notCreated)).toBe('insufficient');
  });

  it('reads the status from the message when the property is missing', () => {
    expect(classifyActionFailure(new Error(`Failed request (Status 409): ${BODY_409_RETURNED}`), created)).toBe(
      'expired-released',
    );
  });

  it('a wallet rejection after the action exists leaves its credits held', () => {
    const e = new Error('User rejected the request.');
    e.name = 'WalletSignTransactionError';
    expect(classifyActionFailure(e, created)).toBe('expired-held');
  });

  it('a wallet rejection before anything was created reserves nothing', () => {
    const e = new Error('User rejected the request.');
    e.name = 'WalletSignMessageError';
    expect(classifyActionFailure(e, notCreated)).toBe('rejected');
    expect(classifyActionFailure({ code: 4001, message: 'x' }, notCreated)).toBe('rejected');
  });

  it('recognises the typed expiry error by shape, whatever its constructor is called', () => {
    // Minified: the class name is gone, the shape is not.
    const released = Object.assign(failed(409, BODY_409_RETURNED), {
      name: 'e',
      nonce: NONCE,
      creditsReleased: true,
    });
    const held = Object.assign(failed(409, BODY_409_RETURNED), {
      name: 'e',
      nonce: NONCE,
      creditsReleased: false,
    });
    expect(classifyActionFailure(released, created)).toBe('expired-released');
    // The typed flag wins over the body.
    expect(classifyActionFailure(held, created)).toBe('expired-held');
  });

  it('ignores a creditsReleased field on something that is not an HTTP error', () => {
    expect(classifyActionFailure({ creditsReleased: true, message: 'x' }, created)).toBe('other');
  });

  it('leaves unrelated failures alone', () => {
    expect(classifyActionFailure(new Error('Payment service is unavailable.'), created)).toBe('other');
    expect(classifyActionFailure(new Error('Name expired'), created)).toBe('other');
    expect(classifyActionFailure('boom', notCreated)).toBe('other');
  });
});

describe('isWalletRejection', () => {
  it('matches common adapter wordings and not ordinary errors', () => {
    expect(isWalletRejection(new Error('User rejected the request.'))).toBe(true);
    expect(isWalletRejection(new Error('Transaction cancelled by user'))).toBe(false);
    expect(isWalletRejection(new Error('user cancelled'))).toBe(true);
    expect(isWalletRejection(new Error('Blockhash not found'))).toBe(false);
  });
});

describe('held-until', () => {
  const NOW = Date.UTC(2026, 8, 30, 14, 0);
  const fmt = (ms: number) => new Date(ms).toISOString().slice(11, 16);

  it('is the action\'s expiresAt plus the reconciler\'s five minutes', () => {
    const iso = new Date(NOW + 12 * 60_000).toISOString();
    expect(heldUntilFrom(iso, NOW)).toEqual({ heldUntil: NOW + 12 * 60_000 + REFUND_LAG_MS, untilKnown: true });
    const secs = Math.floor((NOW + 60_000) / 1000);
    expect(heldUntilFrom(secs, NOW)).toEqual({ heldUntil: secs * 1000 + REFUND_LAG_MS, untilKnown: true });
  });

  it('an expiresAt already past is still known: due within one cadence of now', () => {
    expect(heldUntilFrom(new Date(NOW - 60_000).toISOString(), NOW)).toEqual({
      heldUntil: NOW + REFUND_LAG_MS,
      untilKnown: true,
    });
  });

  it('falls back to twenty minutes when there is nothing to read', () => {
    for (const v of [undefined, 'not a date', null]) {
      expect(heldUntilFrom(v, NOW)).toEqual({ heldUntil: NOW + HELD_FALLBACK_MS, untilKnown: false });
    }
  });

  it('reads the held amount from wincQty', () => {
    expect(heldWincFrom('1234000000000')).toBe(1_234_000_000_000);
    expect(heldWincFrom(undefined)).toBeUndefined();
    expect(heldWincFrom('abc')).toBeUndefined();
  });

  it('phrases the time as "by about HH:MM", or "within about 20 minutes"', () => {
    expect(heldByPhrase({ heldUntil: NOW + 5 * 60_000, untilKnown: true }, fmt)).toBe('by about 14:05');
    expect(heldByPhrase({ heldUntil: NOW, untilKnown: false }, fmt)).toBe('within about 20 minutes');
  });

  it('tells a credits buyer nothing was charged', () => {
    expect(heldMessage({ heldUntil: NOW + 17 * 60_000, untilKnown: true }, { formatTime: fmt })).toBe(
      'Nothing was charged. The credits for that attempt are held and return to your balance by about 14:17.',
    );
    expect(heldMessage({ heldUntil: NOW, untilKnown: false }, { formatTime: fmt })).toBe(
      'Nothing was charged. The credits for that attempt are held and return to your balance within about 20 minutes.',
    );
  });

  it('never tells a card or token buyer, who did pay, that nothing was charged', () => {
    const m = heldMessage({ heldUntil: NOW + 17 * 60_000, untilKnown: true }, { paid: true, formatTime: fmt });
    expect(m).toBe('The credits for this registration are held and return to your balance by about 14:17.');
    expect(m).not.toMatch(/nothing was charged/i);
  });

  it('an unconfirmed attempt never says nothing was charged', () => {
    const held = { heldUntil: NOW + 17 * 60_000, untilKnown: true, unconfirmed: true };
    expect(heldMessage(held, { formatTime: fmt })).toBe(
      "We couldn't confirm the purchase. Check My domains in a minute. If it didn't go through, the credits for this attempt return to your balance by about 14:17.",
    );
    expect(heldMessage(held, { paid: true, formatTime: fmt })).not.toMatch(/nothing was charged/i);
  });

  it('has no em dashes in any message', () => {
    const held = { heldUntil: NOW, untilKnown: true };
    for (const m of [
      RELEASED_MESSAGE,
      heldMessage(undefined),
      heldMessage(held),
      heldMessage(held, { paid: true }),
      heldMessage({ ...held, unconfirmed: true }),
    ]) {
      expect(m).not.toContain('—');
    }
  });
});

describe('explainInsufficient (the 402-while-held decision)', () => {
  const NOW = Date.UTC(2026, 8, 30, 14, 0);
  const held: HeldAttempt = {
    nonce: 'n1',
    payer: 'payer-a',
    name: 'example',
    heldUntil: NOW + 10 * 60_000,
    untilKnown: true,
    heldWinc: 3e12, // 3 credits
  };

  it('explains a 402 by the hold when the held credits would cover this price', () => {
    expect(
      explainInsufficient({ held, payer: 'payer-a', now: NOW, creditBalance: 1, priceCredits: 3.5 }),
    ).toBe('held');
  });

  it('is a real shortfall when even the held credits would not cover it', () => {
    expect(
      explainInsufficient({ held, payer: 'payer-a', now: NOW, creditBalance: 0.2, priceCredits: 5 }),
    ).toBe('insufficient');
  });

  it('gives the hold the benefit of the doubt when the amounts are unknown', () => {
    expect(
      explainInsufficient({
        held: { ...held, heldWinc: undefined },
        payer: 'payer-a',
        now: NOW,
        creditBalance: 0,
        priceCredits: 99,
      }),
    ).toBe('held');
    expect(explainInsufficient({ held, payer: 'payer-a', now: NOW })).toBe('held');
  });

  it('stops once the credits are due back', () => {
    expect(
      explainInsufficient({ held, payer: 'payer-a', now: held.heldUntil - 1, creditBalance: 1, priceCredits: 3 }),
    ).toBe('held');
    expect(
      explainInsufficient({ held, payer: 'payer-a', now: held.heldUntil, creditBalance: 1, priceCredits: 3 }),
    ).toBe('insufficient');
  });

  it('a different payer\'s hold does not explain this payer\'s 402', () => {
    expect(
      explainInsufficient({ held, payer: 'payer-b', now: NOW, creditBalance: 1, priceCredits: 3 }),
    ).toBe('insufficient');
  });

  it('with no held attempt, a 402 is plain insufficient credits', () => {
    expect(explainInsufficient({ held: undefined, payer: 'payer-a', now: NOW })).toBe('insufficient');
  });
});

describe('mapActionExpiryMessage (record and owner writes)', () => {
  it('says nothing changed and the credits are back when released', () => {
    expect(mapActionExpiryMessage(failed(409, BODY_409_RETURNED))).toBe(
      'The approval expired before it was submitted, so nothing changed. Your credits are back. Try again.',
    );
  });

  it('says nothing changed and when the credits return on a held expiry', () => {
    for (const e of [failed(409, BODY_409_HELD), failed(400, BODY_400_EXPIRED_AT)]) {
      expect(mapActionExpiryMessage(e)).toMatch(/nothing changed.*within about 20 minutes/);
    }
  });

  it('does not claim nothing changed when it could not be confirmed', () => {
    const m = mapActionExpiryMessage(failed(503, BODY_503_BLOCKHASH))!;
    expect(m).toMatch(/couldn't confirm/);
    expect(m).not.toMatch(/nothing changed/);
  });

  it('says nothing about credits for a self-signed write, which carries no HTTP status', () => {
    // web3 / kit errors from a wallet-paid transaction: no status, no credits.
    expect(mapActionExpiryMessage(new Error('Transaction simulation failed: Blockhash not found'))).toBeUndefined();
    expect(mapActionExpiryMessage(new Error(BODY_409_RETURNED))).toBeUndefined();
  });

  it('leaves other failures, rejections and program expiries included, to the existing mapping', () => {
    expect(mapActionExpiryMessage(failed(503, 'Internal Server Error'))).toBeUndefined();
    expect(mapActionExpiryMessage(new Error('User rejected the request.'))).toBeUndefined();
    expect(mapActionExpiryMessage(failed(402, 'Insufficient'))).toBeUndefined();
    expect(mapActionExpiryMessage(failed(400, 'Lease has expired'))).toBeUndefined();
  });
});

describe('held-attempt storage', () => {
  const NOW = Date.UTC(2026, 8, 30, 14, 0);
  const mem = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
      size: () => m.size,
    };
  };
  const held: HeldAttempt = {
    nonce: 'n',
    payer: 'p',
    name: 'x',
    heldUntil: NOW + 60_000,
    untilKnown: true,
    heldWinc: 1e12,
  };

  it('round-trips while held and drops the record once the credits are due back', () => {
    const s = mem();
    writeHeldAttempt(s, held);
    expect(readHeldAttempt(s, NOW)).toEqual(held);
    expect(readHeldAttempt(s, held.heldUntil)).toBeUndefined();
    expect(s.size()).toBe(0);
  });

  it('drops a malformed record', () => {
    const s = mem();
    s.setItem('arns-held-attempt', '{"nonce":1}');
    expect(readHeldAttempt(s, NOW)).toBeUndefined();
    expect(s.size()).toBe(0);
  });

  it('clears on demand, and tolerates no storage', () => {
    const s = mem();
    writeHeldAttempt(s, held);
    clearHeldAttempt(s);
    expect(readHeldAttempt(s, NOW)).toBeUndefined();
    expect(readHeldAttempt(undefined, NOW)).toBeUndefined();
  });

  it('never throws, even when every storage call does', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(() => writeHeldAttempt(throwing, held)).not.toThrow();
    expect(readHeldAttempt(throwing, NOW)).toBeUndefined();
    expect(() => clearHeldAttempt(throwing)).not.toThrow();
  });

  it('falls back to memory when window.localStorage itself throws (blocked site data)', () => {
    const g = globalThis as { window?: unknown };
    const had = 'window' in g;
    const previous = g.window;
    g.window = Object.defineProperty({}, 'localStorage', {
      get() {
        throw new Error('SecurityError: The operation is insecure.');
      },
    });
    try {
      expect(() => heldStorage()).not.toThrow();
      writeHeldAttempt(heldStorage(), held);
      expect(readHeldAttempt(heldStorage(), NOW)).toEqual(held);
      clearHeldAttempt(heldStorage());
      expect(readHeldAttempt(heldStorage(), NOW)).toBeUndefined();
    } finally {
      if (had) g.window = previous;
      else delete g.window;
    }
  });
});

describe('the action status settles a hold', () => {
  it('"expired" means the reconciler already refunded it: released, no hold', () => {
    expect(settledByStatus('expired')).toBe('released');
    expect(shouldRecordHold('expired')).toBe(false);
  });

  it('"completed" means it went through after all: no hold', () => {
    expect(settledByStatus('completed')).toBe('completed');
    expect(shouldRecordHold('completed')).toBe(false);
  });

  it('still in flight, or unread, leaves the hold to be recorded', () => {
    for (const s of ['prepared', 'awaiting-signature', 'reserved', undefined, null, 42]) {
      expect(settledByStatus(s)).toBeUndefined();
      expect(shouldRecordHold(s)).toBe(true);
    }
  });
});
