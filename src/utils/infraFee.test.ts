import { describe, expect, it } from 'vitest';

import { formatFeePercent, infraFeePercent } from './infraFee';

/** The fee as the live payment service returns it on a fiat quote. */
const TURBO_INFRA_FEE = {
  name: 'Turbo Infrastructure Fee',
  operator: 'multiply',
  operatorMagnitude: 0.65,
};

describe('infraFeePercent', () => {
  it('reads the inclusive fee as a share of the payment', () => {
    // ×0.65 means 35% of what the buyer pays is fee — a margin-shaped number,
    // which is why the card says "of the ar.io rate" and never "+35% vs raw".
    expect(infraFeePercent([TURBO_INFRA_FEE])).toBeCloseTo(35, 10);
  });

  it('is zero when the quote deducted nothing', () => {
    expect(infraFeePercent([])).toBe(0);
  });

  it('is unknown, not zero, when the quote carried no fees', () => {
    expect(infraFeePercent(undefined)).toBeUndefined();
  });

  it('ignores additive adjustments', () => {
    expect(
      infraFeePercent([TURBO_INFRA_FEE, { operator: 'add', operatorMagnitude: -100 }]),
    ).toBeCloseTo(35, 10);
  });
});

describe('formatFeePercent', () => {
  it('shows a whole number without a decimal', () => {
    // (1 - 0.65) * 100 is 35.00000000000001 in floating point.
    expect(formatFeePercent((1 - 0.65) * 100)).toBe('35%');
  });

  it('keeps one decimal when the fee is fractional', () => {
    expect(formatFeePercent(23.4)).toBe('23.4%');
  });

  it('shows a dash when the fee is unknown', () => {
    expect(formatFeePercent(undefined)).toBe('—');
    expect(formatFeePercent(Number.NaN)).toBe('—');
  });
});
