import { describe, expect, it } from 'vitest';

import {
  HELD_FALLBACK_MS,
  HELD_GRACE_MS,
  RELEASED_MESSAGE,
  classifyActionFailure,
  clearHeldAttempt,
  explainInsufficient,
  heldMessage,
  heldUntilFrom,
  heldUntilPhrase,
  isWalletRejection,
  mapActionExpiryMessage,
  readHeldAttempt,
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

const created = { nonceCreated: true };
const notCreated = { nonceCreated: false };

describe('classifyActionFailure', () => {
  const NONCE = '3f2b8c1e-5d4a-4b7e-9c0f-1a2b3c4d5e6f';
  const withNonce = { nonceCreated: true, nonce: NONCE };

  it('409 "signed transaction expired" with "credits have been returned": released', () => {
    expect(
      classifyActionFailure(
        failed(409, 'signed transaction expired before it could be submitted; credits have been returned'),
        withNonce,
      ),
    ).toBe('expired-released');
  });

  it('409 "signed transaction expired" without the refund wording: held', () => {
    expect(
      classifyActionFailure(failed(409, 'signed transaction expired before it could be submitted'), withNonce),
    ).toBe('expired-held');
  });

  it('409 without "expired" is not treated as an expiry', () => {
    expect(classifyActionFailure(failed(409, 'conflict'), withNonce)).toBe('other');
  });

  it('400 "Action <nonce> expired and was refunded": released', () => {
    expect(
      classifyActionFailure(failed(400, `Action ${NONCE} expired and was refunded; create a new one`), withNonce),
    ).toBe('expired-released');
  });

  it('400 "Action <nonce> expired at ...": held until the refund', () => {
    expect(
      classifyActionFailure(failed(400, `Action ${NONCE} expired at 2026-09-30T14:15:00.000Z`), withNonce),
    ).toBe('expired-held');
  });

  it('400 naming a DIFFERENT action is not this attempt expiring', () => {
    expect(
      classifyActionFailure(failed(400, 'Action 00000000-0000-0000-0000-000000000000 expired at 2026-09-30'), withNonce),
    ).toBe('other');
  });

  it('the ArNS program\'s own "expired" 400s are ordinary errors', () => {
    for (const body of ['Lease has expired', 'Record is expired', 'Reservation has expired']) {
      expect(classifyActionFailure(failed(400, body), withNonce)).toBe('other');
    }
  });

  it('400 for anything else is not an expiry', () => {
    expect(classifyActionFailure(failed(400, 'invalid name'), withNonce)).toBe('other');
  });

  it('503 "Blockhash not found": unconfirmed, never "nothing was charged"', () => {
    expect(classifyActionFailure(failed(503, 'Blockhash not found'), withNonce)).toBe('unconfirmed');
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
    expect(
      classifyActionFailure(
        new Error('Failed request (Status 409): signed transaction expired; credits have been returned'),
        created,
      ),
    ).toBe('expired-released');
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

  it('recognises the typed expiry error a later SDK will throw', () => {
    const released = Object.assign(failed(409, 'expired'), {
      name: 'ArNSActionExpiredError',
      nonce: NONCE,
      creditsReleased: true,
    });
    const held = Object.assign(failed(409, 'expired'), {
      name: 'ArNSActionExpiredError',
      nonce: NONCE,
      creditsReleased: false,
    });
    expect(classifyActionFailure(released, created)).toBe('expired-released');
    expect(classifyActionFailure(held, created)).toBe('expired-held');
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

  it('uses the action\'s expiresAt when it is ahead of now', () => {
    const iso = new Date(NOW + 12 * 60_000).toISOString();
    expect(heldUntilFrom(iso, NOW)).toEqual({ heldUntil: NOW + 12 * 60_000, untilKnown: true });
    expect(heldUntilFrom(Math.floor((NOW + 60_000) / 1000), NOW)).toEqual({
      heldUntil: Math.floor((NOW + 60_000) / 1000) * 1000,
      untilKnown: true,
    });
  });

  it('falls back to twenty minutes when unknown or already past', () => {
    for (const v of [undefined, 'not a date', NOW - 1000]) {
      expect(heldUntilFrom(v, NOW)).toEqual({ heldUntil: NOW + HELD_FALLBACK_MS, untilKnown: false });
    }
  });

  it('says the time when known, and "up to 20 minutes" when not', () => {
    expect(heldMessage({ heldUntil: NOW + 12 * 60_000, untilKnown: true }, fmt)).toBe(
      'Nothing was charged. The credits for that attempt are held until about 14:12, then return to your balance.',
    );
    expect(heldMessage({ heldUntil: NOW, untilKnown: false }, fmt)).toBe(
      'Nothing was charged. The credits for that attempt are held for up to 20 minutes, then return to your balance.',
    );
    expect(heldMessage(undefined, fmt)).toMatch(/up to 20 minutes/);
    expect(heldUntilPhrase({ heldUntil: NOW + 5 * 60_000, untilKnown: true }, fmt)).toBe('about 14:05');
    expect(heldUntilPhrase({ heldUntil: NOW, untilKnown: false }, fmt)).toBe('in up to 20 minutes');
  });

  it('an unconfirmed attempt never says nothing was charged', () => {
    expect(heldMessage({ heldUntil: NOW + 12 * 60_000, untilKnown: true, unconfirmed: true }, fmt)).toBe(
      "We couldn't confirm the purchase. Check My domains in a minute. If it didn't go through, the credits for this attempt return to your balance by about 14:12.",
    );
    expect(heldMessage({ heldUntil: NOW, untilKnown: false, unconfirmed: true }, fmt)).toMatch(
      /within about 20 minutes\.$/,
    );
    expect(heldMessage({ heldUntil: NOW, untilKnown: true, unconfirmed: true }, fmt)).not.toMatch(
      /Nothing was charged/,
    );
  });

  it('has no em dashes in any message', () => {
    for (const m of [RELEASED_MESSAGE, heldMessage(undefined), heldMessage({ heldUntil: NOW, untilKnown: true })]) {
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
  };

  it('explains a 402 by the held attempt while it is held', () => {
    expect(explainInsufficient({ held, payer: 'payer-a', now: NOW })).toBe('held');
  });

  it('keeps explaining it for the grace period after expiry', () => {
    expect(explainInsufficient({ held, payer: 'payer-a', now: held.heldUntil + HELD_GRACE_MS - 1 })).toBe('held');
    expect(explainInsufficient({ held, payer: 'payer-a', now: held.heldUntil + HELD_GRACE_MS })).toBe(
      'insufficient',
    );
  });

  it('a different payer\'s hold does not explain this payer\'s 402', () => {
    expect(explainInsufficient({ held, payer: 'payer-b', now: NOW })).toBe('insufficient');
  });

  it('with no held attempt, a 402 is plain insufficient credits', () => {
    expect(explainInsufficient({ held: undefined, payer: 'payer-a', now: NOW })).toBe('insufficient');
  });
});

describe('mapActionExpiryMessage (record and owner writes)', () => {
  it('says nothing changed and the credits are back when released', () => {
    expect(mapActionExpiryMessage(failed(409, 'signed transaction expired; credits have been returned'))).toBe(
      'The approval expired before it was submitted, so nothing changed. Your credits are back. Try again.',
    );
  });

  it('says nothing changed and when the credits return on a held expiry', () => {
    for (const e of [
      failed(409, 'signed transaction expired'),
      failed(400, 'Action 3f2b8c1e-5d4a-4b7e-9c0f-1a2b3c4d5e6f expired at 2026-09-30T14:15:00Z'),
    ]) {
      expect(mapActionExpiryMessage(e)).toMatch(/nothing changed.*within about 20 minutes/);
    }
  });

  it('does not claim nothing changed when it could not be confirmed', () => {
    const m = mapActionExpiryMessage(failed(503, 'Blockhash not found'))!;
    expect(m).toMatch(/couldn't confirm/);
    expect(m).not.toMatch(/nothing changed/);
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
  const held: HeldAttempt = { nonce: 'n', payer: 'p', name: 'x', heldUntil: NOW + 60_000, untilKnown: true };

  it('round-trips while held and drops the record once it lapses', () => {
    const s = mem();
    writeHeldAttempt(s, held);
    expect(readHeldAttempt(s, NOW)).toEqual(held);
    expect(readHeldAttempt(s, held.heldUntil + HELD_GRACE_MS)).toBeUndefined();
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
});
