import { describe, expect, it } from 'vitest';
import { ARIO_PRESETS, arioPresetsFor } from './arioPresets';

describe('arioPresetsFor', () => {
  it('returns every preset while the rate loads', () => {
    expect(arioPresetsFor(undefined)).toEqual([...ARIO_PRESETS]);
  });

  it('returns every preset when all are under the cap', () => {
    expect(arioPresetsFor(66_666)).toEqual([1_000, 5_000, 10_000, 25_000]);
  });

  it('swaps presets at or above the cap for the cap itself', () => {
    expect(arioPresetsFor(20_000)).toEqual([1_000, 5_000, 10_000, 20_000]);
    expect(arioPresetsFor(10_000)).toEqual([1_000, 5_000, 10_000]);
    expect(arioPresetsFor(25_000)).toEqual([1_000, 5_000, 10_000, 25_000]);
  });

  it('offers only the cap when it is below the smallest preset', () => {
    expect(arioPresetsFor(400)).toEqual([400]);
  });

  it('never offers an amount above the cap', () => {
    for (const cap of [1, 999, 1_000, 4_321, 12_345, 99_999]) {
      expect(Math.max(...arioPresetsFor(cap))).toBeLessThanOrEqual(cap);
    }
  });
});
