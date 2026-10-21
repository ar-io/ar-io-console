import { describe, it, expect } from 'vitest';
import { paymentHistoryStatus } from './paymentHistoryStatus';

const base = { hasData: false, isFetching: false, isFetchingNextPage: false, isError: false };

describe('paymentHistoryStatus', () => {
  it('is idle until the user asks (nothing fetches on its own)', () => {
    expect(paymentHistoryStatus(base)).toBe('idle');
  });

  it('loads, then fails only when there is nothing to show', () => {
    expect(paymentHistoryStatus({ ...base, isFetching: true })).toBe('loading');
    expect(paymentHistoryStatus({ ...base, isError: true })).toBe('error');
  });

  it('keeps cached rows on screen through a refresh or a failed one', () => {
    expect(paymentHistoryStatus({ ...base, hasData: true })).toBe('loaded');
    expect(paymentHistoryStatus({ ...base, hasData: true, isFetching: true })).toBe('refreshing');
    expect(paymentHistoryStatus({ ...base, hasData: true, isError: true })).toBe('loaded');
  });

  it('tells "Load more" apart from a refresh', () => {
    expect(paymentHistoryStatus({ ...base, hasData: true, isFetching: true, isFetchingNextPage: true })).toBe('loadingMore');
  });
});
