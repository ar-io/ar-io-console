/**
 * Setting and removing a name's records, behind one shape.
 *
 * There used to be two implementations here — the owner's own signer for a
 * user-owned name, Turbo's for a name it held in custody. Custody is gone and
 * every name is the user's, so there is one writer: Turbo performs the write
 * and the owner approves it with a message signature. Callers (the records
 * table, the details editor) only need "a record can be set or removed".
 */
export interface RecordWriter {
  setRecord(p: {
    undername: string;
    transactionId: string;
    ttlSeconds: number;
  }): Promise<{ id: string }>;
  removeRecord(p: { undername: string }): Promise<{ id: string }>;
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
 * Turn a record-write failure into something the user can act on.
 *
 * Every string here says what happened and what to do next, and none of them
 * mention a nonce, a signature type or an HTTP status — those explain our
 * plumbing, not their problem.
 */
export function mapRecordWriteError(err: unknown): string {
  const e = (err ?? {}) as Httpish;
  const status = e.status ?? e.response?.status;
  const message = typeof e.message === 'string' ? e.message : String(err ?? '');

  if (status === 404) {
    // Deliberately ambiguous server-side — "no such name" and "not yours" are
    // the same response so nobody can probe for someone else's name. Told
    // plainly it reads as "your name vanished"; the real cause is almost always
    // the wrong wallet.
    return 'This name is owned by a different wallet. Connect the one that owns it.';
  }
  if (status === 401 || /nonce already used|replay/i.test(message)) {
    // Each approval is single-use, so this is never fixed by reconnecting and
    // never fixed by resending the same request — only by approving again.
    return 'That approval expired. Try again to approve a fresh one.';
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
