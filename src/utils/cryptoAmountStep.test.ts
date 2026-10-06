import { describe, expect, it } from 'vitest';
import { cryptoAmountStep } from './cryptoAmountStep';

const base = {
  targeted: true,
  onAmountStep: true,
  advanced: false,
  tokenAmount: 0.21,
  pricingFailed: false,
  walletCanSend: true,
  overCap: false,
};

describe('cryptoAmountStep', () => {
  it('advances a priced, payable targeted top-up', () => {
    expect(cryptoAmountStep(base)).toBe('advance');
  });

  it('leaves the /topup page alone', () => {
    expect(cryptoAmountStep({ ...base, targeted: false })).toBe('amount');
  });

  it('only acts on the first step, and only once', () => {
    expect(cryptoAmountStep({ ...base, onAmountStep: false })).toBe('amount');
    expect(cryptoAmountStep({ ...base, advanced: true })).toBe('amount');
  });

  it('waits while the target is priced', () => {
    expect(cryptoAmountStep({ ...base, tokenAmount: undefined })).toBe('wait');
    expect(cryptoAmountStep({ ...base, tokenAmount: 0 })).toBe('wait');
  });

  it('reports a pricing failure instead of waiting forever', () => {
    expect(
      cryptoAmountStep({ ...base, tokenAmount: undefined, pricingFailed: true }),
    ).toBe('error');
  });

  it('keeps the amount step where it shows a reason', () => {
    expect(cryptoAmountStep({ ...base, walletCanSend: false })).toBe('amount');
    expect(cryptoAmountStep({ ...base, overCap: true })).toBe('amount');
  });

  it('prefers the reason over a pending price', () => {
    expect(
      cryptoAmountStep({ ...base, tokenAmount: undefined, walletCanSend: false }),
    ).toBe('amount');
  });
});
