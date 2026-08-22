/**
 * Poll a submitted ArNS purchase to a terminal state.
 *
 * Extracted verbatim in behaviour from `TurboArNSClient.pollArNSPurchaseToTerminal`,
 * which was correct but unreachable — its only caller was the dead
 * `executeArNSIntent`. Lifted here so it can be tested and reused before that
 * host is deleted.
 *
 * The transport is injected rather than imported so this module stays pure
 * under the repo's node-only vitest harness (no DOM, no `fetch` global assumed).
 *
 * Terminal signals, per the bundler's `GET /v1/arns/purchase/:nonce`:
 *   - `messageId` present  ⇒ settled on-chain, success
 *   - `failedDate` present ⇒ terminally failed (a refund job handles the money)
 *
 * A network error is deliberately NOT terminal. The server is durable and the
 * purchase is already paid for; a transient fetch failure must never be
 * reported to the user as a failed purchase.
 */

export type PurchaseStatusRecord = Record<string, unknown>;

/** Fetch one status snapshot. Throwing is treated as transient. */
export type PurchaseStatusReader = (nonce: string) => Promise<PurchaseStatusRecord>;

export type PollProgress =
  | { phase: 'polling'; nonce: string }
  | { phase: 'success'; nonce: string; messageId: string };

export type PollOutcome =
  | { kind: 'success'; nonce: string; messageId: string; record: PurchaseStatusRecord }
  /** Settled as failed on-chain. The money is refunded server-side. */
  | { kind: 'failed'; nonce: string; record: PurchaseStatusRecord }
  /**
   * Deadline hit with no terminal signal. NOT a failure — the purchase may
   * still complete. Callers must say so rather than reporting an error.
   */
  | { kind: 'timeout'; nonce: string };

export interface PollPurchaseOptions {
  nonce: string;
  readStatus: PurchaseStatusReader;
  pollIntervalMs: number;
  pollTimeoutMs: number;
  /** Injected so tests need no timers and no wall-clock. */
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  onProgress?: (p: PollProgress) => void;
  /** Abort cooperatively (component unmount, user navigation). */
  signal?: { aborted: boolean };
}

export async function pollPurchaseToTerminal({
  nonce,
  readStatus,
  pollIntervalMs,
  pollTimeoutMs,
  now,
  sleep,
  onProgress,
  signal,
}: PollPurchaseOptions): Promise<PollOutcome> {
  const deadline = now() + pollTimeoutMs;

  while (now() < deadline) {
    if (signal?.aborted) return { kind: 'timeout', nonce };

    onProgress?.({ phase: 'polling', nonce });

    let record: PurchaseStatusRecord | undefined;
    try {
      record = await readStatus(nonce);
    } catch {
      record = undefined; // transient — keep polling
    }

    const messageId = typeof record?.messageId === 'string' ? record.messageId : undefined;
    if (messageId) {
      onProgress?.({ phase: 'success', nonce, messageId });
      return { kind: 'success', nonce, messageId, record: record ?? {} };
    }
    if (record?.failedDate) {
      return { kind: 'failed', nonce, record };
    }

    await sleep(pollIntervalMs);
  }

  return { kind: 'timeout', nonce };
}
