import { describe, it, expect } from 'vitest';
import { isFileFree, computeFreeFlags, freeTierSummary, formatFreeLimit } from './freeTier';

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

  it('a later smaller file can still fit after a larger one is skipped', () => {
    // 300 free (->100 left), 500 doesn't fit (100 intact), 50 fits (<=100)
    expect(computeFreeFlags([300, 500, 50], 1000, 400)).toEqual([true, false, true]);
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

describe('freeTierSummary', () => {
  it('returns null when there is no free tier (or x402-only mode passes 0)', () => {
    expect(freeTierSummary(0)).toBeNull();
    expect(freeTierSummary(0, 500)).toBeNull();
    expect(freeTierSummary(-1, null)).toBeNull();
  });

  it('says the tier is used up when nothing remains', () => {
    expect(freeTierSummary(100 * 1024, 0)).toBe('Free tier used up');
  });

  it('shows the remaining allowance when finite', () => {
    expect(freeTierSummary(100 * 1024, 50 * 1024)).toBe('50 KiB of free uploads left');
  });

  it('falls back to the per-item cap for unlimited/unknown', () => {
    expect(freeTierSummary(100 * 1024, null)).toBe('Files under 100 KiB upload free');
    expect(freeTierSummary(100 * 1024, undefined)).toBe('Files under 100 KiB upload free');
    expect(freeTierSummary(100 * 1024)).toBe('Files under 100 KiB upload free');
  });
});

describe('formatFreeLimit', () => {
  it('formats bytes / KiB / MiB and the no-tier case', () => {
    expect(formatFreeLimit(0)).toBe('No free tier');
    expect(formatFreeLimit(512)).toBe('512 bytes');
    expect(formatFreeLimit(100 * 1024)).toBe('100 KiB');
    expect(formatFreeLimit(10 * 1024 * 1024)).toBe('10 MiB');
  });
});
