export type PaymentHistoryStatus = 'idle' | 'loading' | 'loadingMore' | 'refreshing' | 'loaded' | 'error';

/**
 * The payment history section's state, from its query's flags.
 *
 * The history is cached for the session and fetched only on a click, so
 * "has data" decides most of it: with rows cached, a failed refresh or "Load
 * more" keeps them on screen (`loaded`, with the error shown beside them),
 * and only a first load that fails is an `error` with nothing to show.
 */
export function paymentHistoryStatus(q: {
  hasData: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
}): PaymentHistoryStatus {
  if (q.hasData) {
    if (q.isFetchingNextPage) return 'loadingMore';
    if (q.isFetching) return 'refreshing';
    return 'loaded';
  }
  if (q.isFetching) return 'loading';
  if (q.isError) return 'error';
  return 'idle';
}
