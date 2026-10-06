import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

import { SETTLE_DELAYS_MS, nextSettleStep } from '../writeSettle';

export interface SettleSpec<T> {
  /** The one query the write changed. Nothing else is re-read. */
  queryKey: QueryKey;
  /** One read of that query, without touching the cache. */
  read: () => Promise<T>;
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
 * Shows a write straight away, then confirms it from the chain on a short,
 * bounded schedule (`SETTLE_DELAYS_MS`). See `writeSettle.ts` for why.
 *
 * Each settle reads only its own query, at most once per delay, and stops at
 * the first read that agrees. A read that disagrees is not applied while
 * attempts remain; the last one is, because after that the chain is the
 * truth. A newer write to the same query replaces the older settle, and
 * everything stops when `scope` (the name being viewed) changes or the page
 * unmounts.
 */
export function useSettleAfterWrite(scope: string) {
  const queryClient = useQueryClient();
  const runs = useRef(new Map<string, Run>());

  useEffect(() => {
    const active = runs.current;
    return () => {
      for (const run of active.values()) {
        run.cancelled = true;
        clearTimeout(run.timer);
      }
      active.clear();
    };
  }, [scope]);

  return useCallback(
    <T,>({ queryKey, read, reflects, apply }: SettleSpec<T>) => {
      const id = JSON.stringify(queryKey);
      const previous = runs.current.get(id);
      if (previous) {
        previous.cancelled = true;
        clearTimeout(previous.timer);
      }
      const run: Run = { cancelled: false };
      runs.current.set(id, run);
      const finish = () => {
        if (runs.current.get(id) === run) runs.current.delete(id);
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
            queryClient.setQueryData<T>(queryKey, data);
            finish();
          } else if (step === 'retry') {
            // Something else may have refetched a lagging node meanwhile.
            if (apply) {
              queryClient.setQueryData<T>(queryKey, (cur) =>
                reflects(cur) ? cur : apply(cur),
              );
            }
            schedule(attempt + 1);
          } else {
            // Keep what is shown and read nothing more now; the next natural
            // refetch (remount, focus) picks it up.
            void queryClient.invalidateQueries({
              queryKey,
              exact: true,
              refetchType: 'none',
            });
            finish();
          }
        }, wait);
      };
      schedule(0);
    },
    [queryClient],
  );
}
