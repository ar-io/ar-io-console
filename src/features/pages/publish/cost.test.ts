import { describe, it, expect } from 'vitest';
import { estimatePageCredits, MAX_PAGE_BYTES } from './cost';
import { wincPerCredit } from '@/constants';

const GiB = 1024 ** 3;

describe('estimatePageCredits', () => {
  it('returns NaN when the storage rate is unknown', () => {
    expect(estimatePageCredits(1000, undefined, undefined)).toBeNaN();
    expect(estimatePageCredits(1000, '0', undefined)).toBeNaN();
    expect(estimatePageCredits(1000, 'not-a-number', undefined)).toBeNaN();
  });

  it('computes storage cost plus the per-item fee in credits', () => {
    const wincPerGiB = '1000000000000';
    const perItem = '5000000';
    const size = GiB / 2;
    const expectedWinc = Number(wincPerGiB) * (size / GiB) + Number(perItem);
    expect(estimatePageCredits(size, wincPerGiB, perItem)).toBeCloseTo(expectedWinc / wincPerCredit, 6);
  });

  it('includes the per-item fee even for a tiny page', () => {
    const withFee = estimatePageCredits(100, '1000000000000', '5000000');
    const withoutFee = estimatePageCredits(100, '1000000000000', '0');
    expect(withFee).toBeGreaterThan(withoutFee);
  });

  it('treats a missing per-item fee as zero', () => {
    expect(estimatePageCredits(GiB, '1000000000000', undefined)).toBeCloseTo(
      1000000000000 / wincPerCredit,
      6,
    );
  });

  it('exposes the 2 MB page ceiling', () => {
    expect(MAX_PAGE_BYTES).toBe(2 * 1024 * 1024);
  });
});
