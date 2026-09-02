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
