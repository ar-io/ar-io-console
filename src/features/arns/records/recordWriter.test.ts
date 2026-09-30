import { describe, expect, it } from 'vitest';

import {
  MAX_TTL_SECONDS, MIN_TTL_SECONDS, mapRecordWriteError,
  validateRecordInput,
} from './recordWriter';

const VALID_TX = 'a'.repeat(43);
const valid = { undername: 'blog', transactionId: VALID_TX, ttlSeconds: 3600 };

describe('validateRecordInput', () => {
  it('accepts a well-formed record', () => {
    expect(validateRecordInput(valid)).toEqual({});
  });

  it('accepts the apex record', () => {
    expect(validateRecordInput({ ...valid, undername: '@' })).toEqual({});
  });

  it('rejects undernames the service would 400 on', () => {
    for (const u of ['', 'has space', 'a'.repeat(62), 'dot.dot']) {
      expect(validateRecordInput({ ...valid, undername: u }).undername).toBeTruthy();
    }
    // 61 is the documented maximum, so it must pass.
    expect(validateRecordInput({ ...valid, undername: 'a'.repeat(61) })).toEqual({});
  });

  it('rejects anything that is not an Arweave transaction ID', () => {
    for (const t of ['', 'too-short', 'a'.repeat(44), `${'a'.repeat(42)}!`]) {
      expect(validateRecordInput({ ...valid, transactionId: t }).transactionId)
        .toBeTruthy();
    }
  });

  it('enforces the service TTL bounds INCLUSIVELY', () => {
    // Off-by-one here produces a 400 the user cannot diagnose.
    expect(validateRecordInput({ ...valid, ttlSeconds: MIN_TTL_SECONDS })).toEqual({});
    expect(validateRecordInput({ ...valid, ttlSeconds: MAX_TTL_SECONDS })).toEqual({});
    expect(validateRecordInput({ ...valid, ttlSeconds: MIN_TTL_SECONDS - 1 }).ttlSeconds)
      .toBeTruthy();
    expect(validateRecordInput({ ...valid, ttlSeconds: MAX_TTL_SECONDS + 1 }).ttlSeconds)
      .toBeTruthy();
  });

  it('rejects non-integer and missing TTLs', () => {
    expect(validateRecordInput({ ...valid, ttlSeconds: 60.5 }).ttlSeconds).toBeTruthy();
    expect(validateRecordInput({ ...valid, ttlSeconds: NaN }).ttlSeconds).toBeTruthy();
    expect(validateRecordInput({ undername: 'blog', transactionId: VALID_TX }).ttlSeconds)
      .toBeTruthy();
  });

  it('reports every bad field at once, not just the first', () => {
    const errs = validateRecordInput({ undername: '', transactionId: 'x', ttlSeconds: 1 });
    expect(Object.keys(errs).sort()).toEqual(['transactionId', 'ttlSeconds', 'undername']);
  });
});

describe('mapRecordWriteError', () => {
  it('reads 404 as wrong-wallet, never as a missing name', () => {
    // The service conflates "not found" and "not yours" on purpose. Saying
    // "not found" would tell someone their paid-for name disappeared.
    const msg = mapRecordWriteError({ status: 404 });
    expect(msg).toMatch(/wallet/i);
    expect(msg).not.toMatch(/not found|does not exist|missing/i);
  });

  it('explains a replayed nonce as an expired approval, not an auth failure', () => {
    // Single-use by design; the fix is to sign again, not to reconnect.
    for (const e of [{ status: 401 }, new Error('Nonce already used — replay rejected')]) {
      expect(mapRecordWriteError(e)).toMatch(/again/i);
    }
  });

  it('degrades 503 to try-later rather than implying the name is broken', () => {
    expect(mapRecordWriteError({ status: 503 })).toMatch(/temporarily|shortly/i);
  });

  it('passes a 400 through, since it names the offending field', () => {
    expect(mapRecordWriteError({ status: 400, message: 'Invalid ttlSeconds' }))
      .toContain('Invalid ttlSeconds');
  });

  it('keeps the undername-limit remedy, which arrives from the chain', () => {
    expect(mapRecordWriteError(new Error('undername limit exceeded')))
      .toMatch(/no undername slots left/i);
  });

  it('never returns an empty string', () => {
    for (const e of [undefined, null, {}, 'boom']) {
      expect(mapRecordWriteError(e).length).toBeGreaterThan(0);
    }
  });
});

describe('mapRecordWriteError and the signing window', () => {
  const failed = (status: number, body: string) =>
    Object.assign(new Error(`Failed request (Status ${status}): ${body}`), { status });

  it('says nothing changed and the credits are back when the service released them', () => {
    expect(
      mapRecordWriteError(failed(409, 'signed transaction expired; credits have been returned')),
    ).toBe(
      'The approval expired before it was submitted, so nothing changed. Your credits are back. Try again.',
    );
  });

  it('says nothing changed and when the credits return when they are held', () => {
    for (const e of [
      failed(409, 'signed transaction expired'),
      failed(400, 'Action 3f2b8c1e-5d4a-4b7e-9c0f-1a2b3c4d5e6f expired at 2026-09-30T14:15:00Z'),
    ]) {
      expect(mapRecordWriteError(e)).toMatch(/nothing changed.*within about 20 minutes/);
    }
  });

  it('does not claim nothing changed when a 503 could not confirm it', () => {
    const m = mapRecordWriteError(failed(503, 'Blockhash not found'));
    expect(m).toMatch(/couldn't confirm/);
    expect(m).not.toMatch(/nothing changed/);
  });

  it('keeps an ordinary 503 as try-later, and a program expiry as the service said it', () => {
    expect(mapRecordWriteError(failed(503, 'Internal Server Error'))).toMatch(/temporarily|shortly/i);
    expect(mapRecordWriteError(failed(400, 'Lease has expired'))).toContain('Lease has expired');
  });
});
