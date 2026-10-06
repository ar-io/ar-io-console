import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

import { SettleRuns } from './settleQuery';
import { SETTLE_DELAYS_MS } from './writeSettle';

const KEY = ['ant-undernames', 'cfg', 'mint'];
const LAST = SETTLE_DELAYS_MS[SETTLE_DELAYS_MS.length - 1];

describe('SettleRuns', () => {
  let qc: QueryClient;
  let runs: SettleRuns;

  beforeEach(() => {
    vi.useFakeTimers();
    qc = new QueryClient();
    runs = new SettleRuns();
  });
  afterEach(() => {
    runs.cancelAll();
    qc.clear();
    vi.useRealTimers();
  });

  it('shows the write at once and reads nothing before the first delay', async () => {
    qc.setQueryData(KEY, ['old']);
    const read = vi.fn(async () => ['old', 'new']);
    runs.start<string[]>(qc, {
      queryKey: KEY,
      read,
      reflects: (d) => !!d?.includes('new'),
      apply: (d) => [...(d ?? []), 'new'],
    });
    expect(qc.getQueryData(KEY)).toEqual(['old', 'new']);
    expect(runs.isSettling(KEY)).toBe(true);
    await vi.advanceTimersByTimeAsync(SETTLE_DELAYS_MS[0] - 1);
    expect(read).not.toHaveBeenCalled();
  });

  it('stops at the first read that agrees', async () => {
    const read = vi.fn(async () => ['new']);
    runs.start<string[]>(qc, { queryKey: KEY, read, reflects: (d) => !!d?.includes('new') });
    await vi.advanceTimersByTimeAsync(LAST + 60_000);
    expect(read).toHaveBeenCalledTimes(1);
    expect(runs.isSettling(KEY)).toBe(false);
  });

  it('reads at most once per delay, keeps the local change, then accepts the chain', async () => {
    qc.setQueryData(KEY, []);
    const read = vi.fn(async () => ['stale']);
    runs.start<string[]>(qc, {
      queryKey: KEY,
      read,
      reflects: (d) => !!d?.includes('new'),
      apply: (d) => [...(d ?? []), 'new'],
    });
    await vi.advanceTimersByTimeAsync(SETTLE_DELAYS_MS[1]);
    expect(read).toHaveBeenCalledTimes(2);
    expect(qc.getQueryData(KEY)).toEqual(['new']);
    await vi.advanceTimersByTimeAsync(LAST + 60_000);
    expect(read).toHaveBeenCalledTimes(SETTLE_DELAYS_MS.length);
    expect(qc.getQueryData(KEY)).toEqual(['stale']);
    expect(runs.isSettling(KEY)).toBe(false);
  });

  it('a second write to the same query replaces the first', async () => {
    const first = vi.fn(async () => []);
    const second = vi.fn(async () => ['b']);
    runs.start<string[]>(qc, { queryKey: KEY, read: first, reflects: () => false });
    await vi.advanceTimersByTimeAsync(1_000);
    runs.start<string[]>(qc, { queryKey: KEY, read: second, reflects: (d) => !!d?.includes('b') });
    await vi.advanceTimersByTimeAsync(LAST + 60_000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('cancelAll (scope change or unmount) stops every read', async () => {
    const read = vi.fn(async () => []);
    runs.start<string[]>(qc, { queryKey: KEY, read, reflects: () => false });
    runs.start<string[]>(qc, { queryKey: ['other'], read, reflects: () => false });
    runs.cancelAll();
    await vi.advanceTimersByTimeAsync(LAST + 60_000);
    expect(read).not.toHaveBeenCalled();
    expect(runs.isSettling(KEY)).toBe(false);
  });

  it('a failed last read keeps what is shown and stops', async () => {
    qc.setQueryData(KEY, []);
    const read = vi.fn(async () => {
      throw new Error('rpc down');
    });
    runs.start<string[]>(qc, {
      queryKey: KEY,
      read,
      reflects: (d) => !!d?.includes('new'),
      apply: (d) => [...(d ?? []), 'new'],
    });
    await vi.advanceTimersByTimeAsync(LAST + 60_000);
    expect(read).toHaveBeenCalledTimes(SETTLE_DELAYS_MS.length);
    expect(qc.getQueryData(KEY)).toEqual(['new']);
    expect(runs.isSettling(KEY)).toBe(false);
  });
});
