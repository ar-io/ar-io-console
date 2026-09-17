import { describe, expect, it, vi } from 'vitest';

import { awaitCreditSettlement } from './awaitCreditSettlement';

/** A clock that advances by the sleep, so timeouts are deterministic. */
function fakeClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    sleep: async (ms: number) => {
      t += ms;
    },
  };
}

const base = (over: Partial<Parameters<typeof awaitCreditSettlement>[0]> = {}) => ({
  creditedBefore: 100,
  readBalance: async () => 100,
  isAborted: () => false,
  ...fakeClock(),
  ...over,
});

describe('awaitCreditSettlement', () => {
  it('returns as soon as the balance rises', async () => {
    const readBalance = vi
      .fn()
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(150);
    expect(await awaitCreditSettlement(base({ readBalance }))).toEqual({
      kind: 'settled',
    });
    expect(readBalance).toHaveBeenCalledTimes(3);
  });

  it('times out rather than waiting forever', async () => {
    // The payment stands; the credits land later. The caller must say so
    // instead of uploading against a balance that never moved.
    expect(
      await awaitCreditSettlement(base({ timeoutMs: 30_000 })),
    ).toEqual({ kind: 'timeout' });
  });

  it('stops on abort without reporting success', async () => {
    let calls = 0;
    const outcome = await awaitCreditSettlement(
      base({
        isAborted: () => ++calls > 2,
        readBalance: async () => 100,
      }),
    );
    expect(outcome).toEqual({ kind: 'aborted' });
  });

  it('gives up on a hung read at the deadline', async () => {
    // getBalance is a bare fetch with no timeout. A read that never answers
    // must not hold the wait open past its deadline. If it did, this test
    // would hang rather than fail.
    const clock = fakeClock();
    const outcome = await awaitCreditSettlement(
      base({
        ...clock,
        readBalance: () => new Promise(() => {}),
        timeoutMs: 10_000,
      }),
    );
    expect(outcome).toEqual({ kind: 'timeout' });
    expect(clock.now()).toBe(10_000);
  });

  it('stops on abort while a read is hung', async () => {
    const clock = fakeClock();
    let aborted = false;
    const outcome = await awaitCreditSettlement(
      base({
        ...clock,
        isAborted: () => aborted,
        readBalance: () => {
          aborted = true; // the user cancels mid-read
          return new Promise(() => {});
        },
      }),
    );
    expect(outcome).toEqual({ kind: 'aborted' });
    // Exited on the cancel, not by running out the five-minute deadline.
    expect(clock.now()).toBeLessThan(10_000);
  });

  it('does NOT treat an unreadable balance as a shortfall', async () => {
    // A flaky gateway or a rate limit is not evidence the credits are missing.
    // Reading undefined forever must time out, never claim settled — but one
    // failed read between good ones must not derail it either.
    const readBalance = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(150);
    expect(await awaitCreditSettlement(base({ readBalance }))).toEqual({
      kind: 'settled',
    });
  });

  it('skips the wait entirely when there was no baseline to compare', async () => {
    // Nothing to compare against, so waiting proves nothing — blocking for
    // five minutes on a comparison that cannot be made helps no one.
    const readBalance = vi.fn();
    expect(
      await awaitCreditSettlement(base({ creditedBefore: undefined, readBalance })),
    ).toEqual({ kind: 'settled' });
    expect(readBalance).not.toHaveBeenCalled();
  });

  it('requires a strict increase, not merely a reading', async () => {
    // Equal is not settled: the top-up has not landed yet.
    const readBalance = vi.fn().mockResolvedValue(100);
    expect(
      await awaitCreditSettlement(base({ readBalance, timeoutMs: 10_000 })),
    ).toEqual({ kind: 'timeout' });
  });
});
