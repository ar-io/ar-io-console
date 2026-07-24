import { describe, it, expect } from 'vitest';
import { isFileFree } from './freeTier';

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
