import type { NameCustody } from './nameCustody';

/**
 * The two ways a record write reaches the chain, behind one shape.
 *
 * A user-owned name is written by the owner's own signer; a Turbo-held one is
 * written by Turbo against an action-bound signature. The callers (the records
 * table, the details editor) should not care which — only that a record can be
 * set or removed — so the difference lives here and nowhere else.
 */
export interface RecordWriter {
  setRecord(p: {
    undername: string;
    transactionId: string;
    ttlSeconds: number;
  }): Promise<{ id: string }>;
  removeRecord(p: { undername: string }): Promise<{ id: string }>;
}

export type WriterKind = 'ant' | 'turbo' | 'blocked';

/**
 * Which writer performs a write — STRICTER than the render-time rule.
 *
 * `actionAvailability` treats `unknown` custody as user-owned, which is right
 * for deciding whether to SHOW a control: hiding the editor on a name someone
 * owns looks broken, and a wrong guess there costs only an error message.
 *
 * Dispatching a write is not the same question. Guessing `ant` for a name Turbo
 * actually holds asks the user's wallet to sign for an asset it does not own —
 * a confusing wallet-level failure rather than an actionable one. So a write
 * waits for custody to resolve instead of assuming.
 */
export function writerKindForWrite(custody: NameCustody): WriterKind {
  switch (custody) {
    case 'user-owned':
      return 'ant';
    case 'turbo-custodial':
      return 'turbo';
    case 'unknown':
      return 'blocked';
  }
}

/** Bounds the service enforces; mirrored so a 400 is unreachable, not handled. */
export const MIN_TTL_SECONDS = 60;
export const MAX_TTL_SECONDS = 86_400;

/** `@` (the apex) or a 1-61 char label. Matches the service's own regex. */
const UNDERNAME_REGEX = /^(@|[a-zA-Z0-9_-]{1,61})$/;
/** Arweave txIDs are 43 chars of base64url. */
const TX_ID_REGEX = /^[a-zA-Z0-9_-]{43}$/;

export interface RecordInput {
  undername: string;
  transactionId: string;
  ttlSeconds: number;
}

/**
 * Validate before sending, not after failing.
 *
 * Every rule here is one the service also enforces, and each violation is a
 * 400 the user cannot act on once it comes back — "Bad Request" says nothing
 * about which field. Checking client-side turns each into a specific, fixable
 * message on the field that caused it.
 *
 * Returns per-field messages so the editor can place them; empty means valid.
 */
export function validateRecordInput(
  input: Partial<RecordInput>,
): Partial<Record<keyof RecordInput, string>> {
  const errors: Partial<Record<keyof RecordInput, string>> = {};

  const undername = input.undername ?? '';
  if (!undername) {
    errors.undername = 'Enter a name.';
  } else if (!UNDERNAME_REGEX.test(undername)) {
    errors.undername =
      'Use letters, numbers, hyphens or underscores (max 61 characters).';
  }

  const txId = input.transactionId ?? '';
  if (!txId) {
    errors.transactionId = 'Enter a transaction ID.';
  } else if (!TX_ID_REGEX.test(txId)) {
    errors.transactionId = 'That is not a valid Arweave transaction ID.';
  }

  const ttl = input.ttlSeconds;
  if (ttl === undefined || !Number.isFinite(ttl)) {
    errors.ttlSeconds = 'Enter a TTL in seconds.';
  } else if (!Number.isInteger(ttl)) {
    errors.ttlSeconds = 'TTL must be a whole number of seconds.';
  } else if (ttl < MIN_TTL_SECONDS || ttl > MAX_TTL_SECONDS) {
    errors.ttlSeconds = `TTL must be between ${MIN_TTL_SECONDS} and ${MAX_TTL_SECONDS.toLocaleString()} seconds.`;
  }

  return errors;
}

interface Httpish {
  status?: number;
  response?: { status?: number };
  message?: string;
}

/**
 * Turn a custodial-write failure into something the user can act on.
 *
 * Two of these are actively misleading if passed through raw:
 *
 * - **404** is deliberately ambiguous server-side — "not found" and "not yours"
 *   are the same response so the service never reveals someone else's ANT. Told
 *   plainly it reads as "your name vanished", when the real cause is almost
 *   always a different wallet than the one that bought it.
 * - **401 on a replayed nonce** is not an auth problem the user can fix by
 *   reconnecting; the signature is single-use and the fix is simply to sign
 *   again. Never retry the same request — it can only fail the same way.
 */
export function mapRecordWriteError(err: unknown): string {
  const e = (err ?? {}) as Httpish;
  const status = e.status ?? e.response?.status;
  const message = typeof e.message === 'string' ? e.message : String(err ?? '');

  if (status === 404 || /not found in your turbo custody/i.test(message)) {
    return 'Turbo does not hold this name for this wallet. Connect the wallet you bought it with.';
  }
  if (status === 401 || /nonce already used|replay/i.test(message)) {
    return 'That approval expired. Try again to sign a fresh one.';
  }
  if (status === 503) {
    return 'Record updates are temporarily unavailable. Try again shortly.';
  }
  if (status === 400) {
    // The service validated something we should have caught first; show its
    // words rather than a generic failure, since they name the field.
    return message || 'That record was rejected. Check the values and retry.';
  }
  // Undername-limit exhaustion surfaces from the chain, through either writer.
  if (/undername limit|exceeds/i.test(message)) {
    return 'This name has no undername slots left. Add more, then retry.';
  }
  return message || 'Could not save that record.';
}
