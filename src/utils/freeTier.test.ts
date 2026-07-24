import { describe, it, expect } from 'vitest';
import { isFileFree, computeFreeFlags } from './freeTier';

describe('isFileFree (allowance-aware)', () => {
  it('is false when there is no free tier (limit 0)', () => {
    expect(isFileFree(100, 0)).toBe(false);
    expect(isFileFree(100, 0, 999999)).toBe(false);
  });

  it('is false when the file exceeds the per-item size cap', () => {
    expect(isFileFree(1500, 1000)).toBe(false);
    expect(isFileFree(1000, 1000)).toBe(false); // strict: size < limit
    expect(isFileFree(1500, 1000, null)).toBe(false);
  });

  it('falls back to size-only when allowance is unknown (undefined)', () => {
    expect(isFileFree(100, 1000)).toBe(true);
    expect(isFileFree(100, 1000, undefined)).toBe(true);
  });

  it('treats null allowance as unlimited', () => {
    expect(isFileFree(100, 1000, null)).toBe(true);
  });

  it('is false when the allowance is exhausted (0)', () => {
    expect(isFileFree(100, 1000, 0)).toBe(false);
  });

  it('checks the file fits within a finite remaining allowance', () => {
    expect(isFileFree(100, 1000, 500)).toBe(true); // fits
    expect(isFileFree(500, 1000, 500)).toBe(true); // exactly fits (<=)
    expect(isFileFree(600, 1000, 500)).toBe(false); // doesn't fit
  });
});

describe('computeFreeFlags (cumulative drawdown across a batch)', () => {
  it('consumes a finite allowance greedily in order', () => {
    // remaining 700: 300 ok (->400), 300 ok (->100), 300 doesn't fit
    expect(computeFreeFlags([300, 300, 300], 1000, 700)).toEqual([true, true, false]);
  });

  it('undercount guard: two 75s against 100 remaining — only the first is free', () => {
    expect(computeFreeFlags([75, 75], 1000, 100)).toEqual([true, false]);
  });

  it('never draws down for unlimited or unknown allowance', () => {
    expect(computeFreeFlags([300, 300, 300], 1000, null)).toEqual([true, true, true]);
    expect(computeFreeFlags([300, 300, 300], 1000, undefined)).toEqual([true, true, true]);
  });

  it('marks everything billable once the allowance is exhausted', () => {
    expect(computeFreeFlags([300, 300], 1000, 0)).toEqual([false, false]);
  });

  it('a file failing the size cap stays billable without consuming allowance', () => {
    // 2000 exceeds the 1000 cap -> billable, no drawdown; the 300s remain free
    expect(computeFreeFlags([300, 2000, 300], 1000, 5000)).toEqual([true, false, true]);
  });

  it('handles an empty batch', () => {
    expect(computeFreeFlags([], 1000, 500)).toEqual([]);
  });
});
