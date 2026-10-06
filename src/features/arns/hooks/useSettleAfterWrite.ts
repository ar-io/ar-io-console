import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

import { SettleRuns, type SettleSpec } from '../settleQuery';

export type { SettleSpec } from '../settleQuery';

/**
 * Shows a write straight away, then confirms it from the chain on a short,
 * bounded schedule. See `writeSettle.ts` for why and `settleQuery.ts` for the
 * loop. Everything stops when `scope` (the name being viewed) changes or the
 * page unmounts.
 *
 * `isSettling` lets the page's broad refresh skip every query a settle owns:
 * an immediate read there is a duplicate, and can land on a lagging node and
 * flash the old state back.
 */
export function useSettleAfterWrite(scope: string) {
  const queryClient = useQueryClient();
  const runs = useRef(new SettleRuns());

  useEffect(() => {
    const active = runs.current;
    return () => active.cancelAll();
  }, [scope]);

  const settle = useCallback(
    <T,>(spec: SettleSpec<T>) => runs.current.start(queryClient, spec),
    [queryClient],
  );
  const isSettling = useCallback((queryKey: QueryKey) => runs.current.isSettling(queryKey), []);

  return useMemo(() => ({ settle, isSettling }), [settle, isSettling]);
}
