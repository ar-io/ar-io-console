import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { SETTLE_DELAYS_MS, nextSettleStep } from './writeSettle';

export interface SettleSpec<T> {
  /** The one query the write changed. Nothing else is re-read. */
  queryKey: QueryKey;
  /** One read of that query, without touching the cache. */
  read: () => Promise<T | undefined>;
  /** True if a read shows the write. */
  reflects: (data: T | undefined) => boolean;
  /** The cached data with the write applied, shown until a read agrees. */
  apply?: (data: T | undefined) => T | undefined;
}

interface Run {
  cancelled: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * The settles running for one page, by query key. Shared so the page's broad
 * refresh can leave every settling query alone (see `isSettling`).
 */
export class SettleRuns {
  private runs = new Map<string, Run>();

  /** True while a settle owns this query key. */
  isSettling(queryKey: QueryKey): boolean {
    return this.runs.has(JSON.stringify(queryKey));
  }

  /** Stop every settle. Nothing more is read or written. */
  cancelAll(): void {
    for (const run of this.runs.values()) {
      run.cancelled = true;
      clearTimeout(run.timer);
    }
    this.runs.clear();
  }

  /**
   * Show the write at once, then confirm it with at most
   * `SETTLE_DELAYS_MS.length` reads of that one query, stopping at the first
   * that agrees. A read that disagrees is not applied while attempts remain;
   * the last one is. A newer settle of the same key replaces this one.
   */
  start<T>(queryClient: QueryClient, { queryKey, read, reflects, apply }: SettleSpec<T>): void {
    const id = JSON.stringify(queryKey);
    const previous = this.runs.get(id);
    if (previous) {
      previous.cancelled = true;
      clearTimeout(previous.timer);
    }
    const run: Run = { cancelled: false };
    this.runs.set(id, run);
    const finish = () => {
      if (this.runs.get(id) === run) this.runs.delete(id);
    };

    // A read already in flight may have started before the write landed.
    // Its revert is safe: setQueryData below becomes the revert state.
    void queryClient.cancelQueries({ queryKey, exact: true });
    if (apply) queryClient.setQueryData<T>(queryKey, (cur) => apply(cur));

    const schedule = (attempt: number) => {
      const wait =
        SETTLE_DELAYS_MS[attempt] - (attempt > 0 ? SETTLE_DELAYS_MS[attempt - 1] : 0);
      run.timer = setTimeout(async () => {
        if (run.cancelled) return;
        let data: T | undefined;
        let readFailed = false;
        try {
          data = await read();
        } catch {
          readFailed = true;
        }
        if (run.cancelled) return;

        const step = nextSettleStep({
          attempt,
          reflected: !readFailed && reflects(data),
          readFailed,
        });
        if (step === 'accept') {
          if (data !== undefined) queryClient.setQueryData<T>(queryKey, data);
          finish();
        } else if (step === 'retry') {
          // Something else may have refetched a lagging node meanwhile.
          if (apply) {
            queryClient.setQueryData<T>(queryKey, (cur) => (reflects(cur) ? cur : apply(cur)));
          }
          schedule(attempt + 1);
        } else {
          // Keep what is shown and read nothing more now; the next natural
          // refetch (remount, focus) picks it up.
          void queryClient.invalidateQueries({ queryKey, exact: true, refetchType: 'none' });
          finish();
        }
      }, wait);
    };
    schedule(0);
  }
}
