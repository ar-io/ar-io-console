import { describe, expect, it, vi } from 'vitest';

import {
  pollPurchaseToTerminal,
  type PollProgress,
  type PurchaseStatusRecord,
} from './pollPurchase';

/** Deterministic clock: advances only when the poller sleeps. */
function harness(responses: Array<PurchaseStatusRecord | Error>) {
  let t = 0;
  let i = 0;
  const progress: PollProgress[] = [];
  return {
    progress,
    calls: () => i,
    opts: {
      nonce: 'n1',
      readStatus: async () => {
        const r = responses[Math.min(i, responses.length - 1)];
        i += 1;
        if (r instanceof Error) throw r;
        return r;
      },
      pollIntervalMs: 1000,
      pollTimeoutMs: 5000,
      now: () => t,
      sleep: async (ms: number) => {
        t += ms;
      },
      onProgress: (p: PollProgress) => progress.push(p),
    },
  };
}

describe('pollPurchaseToTerminal', () => {
  it('resolves success as soon as messageId appears', async () => {
    const h = harness([{ messageId: 'msg-1' }]);
    const out = await pollPurchaseToTerminal(h.opts);
    expect(out).toEqual({
      kind: 'success',
      nonce: 'n1',
      messageId: 'msg-1',
      record: { messageId: 'msg-1' },
    });
    expect(h.calls()).toBe(1);
  });

  it('keeps polling until the message id lands', async () => {
    const h = harness([{}, {}, { messageId: 'msg-2' }]);
    const out = await pollPurchaseToTerminal(h.opts);
    expect(out.kind).toBe('success');
    expect(h.calls()).toBe(3);
  });

  it('treats failedDate as terminal failure', async () => {
    const h = harness([{ failedDate: '2026-08-22T00:00:00Z' }]);
    const out = await pollPurchaseToTerminal(h.opts);
    expect(out.kind).toBe('failed');
  });

  it('does NOT treat a network error as failure — the money is already spent', async () => {
    // The whole point: a transient fetch error must never be reported to the
    // user as a failed purchase. Errors, then a success.
    const h = harness([new Error('offline'), new Error('offline'), { messageId: 'msg-3' }]);
    const out = await pollPurchaseToTerminal(h.opts);
    expect(out.kind).toBe('success');
  });

  it('returns timeout (not failure) when the deadline passes', async () => {
    const h = harness([{}]);
    const out = await pollPurchaseToTerminal(h.opts);
    // timeout is NOT `failed` — the purchase may still settle.
    expect(out).toEqual({ kind: 'timeout', nonce: 'n1' });
  });

  it('ignores a non-string messageId rather than reporting a bogus success', async () => {
    const h = harness([{ messageId: 123 }, { messageId: 'msg-4' }]);
    const out = await pollPurchaseToTerminal(h.opts);
    expect(out.kind).toBe('success');
    if (out.kind === 'success') expect(out.messageId).toBe('msg-4');
  });

  it('emits polling progress and a final success event', async () => {
    const h = harness([{}, { messageId: 'msg-5' }]);
    await pollPurchaseToTerminal(h.opts);
    expect(h.progress.filter((p) => p.phase === 'polling').length).toBe(2);
    expect(h.progress.at(-1)).toEqual({ phase: 'success', nonce: 'n1', messageId: 'msg-5' });
  });

  it('stops when aborted, without reporting failure', async () => {
    const signal = { aborted: true };
    const h = harness([{ messageId: 'never-read' }]);
    const out = await pollPurchaseToTerminal({ ...h.opts, signal });
    expect(out.kind).toBe('timeout');
    expect(h.calls()).toBe(0);
  });

  it('never polls at all when the timeout is already elapsed', async () => {
    const h = harness([{ messageId: 'x' }]);
    const out = await pollPurchaseToTerminal({ ...h.opts, pollTimeoutMs: 0 });
    expect(out.kind).toBe('timeout');
    expect(h.calls()).toBe(0);
  });

  it('does not sleep after a terminal result', async () => {
    const sleep = vi.fn(async () => {});
    const h = harness([{ messageId: 'msg-6' }]);
    await pollPurchaseToTerminal({ ...h.opts, sleep });
    expect(sleep).not.toHaveBeenCalled();
  });
});
