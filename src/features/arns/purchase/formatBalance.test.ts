import { describe, expect, it } from 'vitest';

import { formatHeldBalance } from './formatBalance';

describe('formatHeldBalance', () => {
  it('abbreviates the balance that was being truncated mid-digits', () => {
    // Reported from the payment picker as "1,505,829.1436 …" — a number cut
    // mid-digits reads as broken rather than shortened.
    expect(formatHeldBalance(1_505_829.1436)).toBe('1.51M');
  });

  it('keeps decimals where they change the decision', () => {
    // 0.3961 vs 0.4 matters when the price is 0.39.
    expect(formatHeldBalance(0.3961)).toBe('0.3961');
  });

  it('drops noise decimals once the integer part carries the meaning', () => {
    expect(formatHeldBalance(2.4862)).toBe('2.49');
  });

  it('abbreviates thousands', () => {
    expect(formatHeldBalance(45_120)).toBe('45.12K');
  });

  it('leaves four figures alone — they already fit', () => {
    expect(formatHeldBalance(9_999)).toBe('9,999');
  });

  it('never renders a negative or non-finite holding', () => {
    // A failed lookup must not print "NaN" where a balance goes.
    expect(formatHeldBalance(Number.NaN)).toBe('0');
    expect(formatHeldBalance(-5)).toBe('0');
  });

  it('handles zero plainly', () => {
    expect(formatHeldBalance(0)).toBe('0');
  });
});

describe('formatHeldBalance — abbreviation boundaries', () => {
  /*
    The unit has to be chosen from the value as DISPLAYED. Choosing from the
    raw number puts these two on the branch below the one their rounded form
    belongs to.
  */
  it('rounds up into the next unit rather than overflowing the current one', () => {
    expect(formatHeldBalance(999_999.999)).toBe('1M');
    expect(formatHeldBalance(9_999.999)).toBe('10K');
  });

  it('never renders an abbreviation longer than the number it abbreviates', () => {
    for (const n of [999_999.999, 9_999.999, 1_000_000, 10_000]) {
      expect(formatHeldBalance(n)).not.toMatch(/^1,000K$/);
      expect(formatHeldBalance(n).length).toBeLessThanOrEqual(7);
    }
  });

  it('leaves values just below a boundary alone', () => {
    // 9,999 still reads exactly; only its rounded form crosses.
    expect(formatHeldBalance(9_999)).toBe('9,999');
    expect(formatHeldBalance(999_994)).toBe('999.99K');
  });
});
