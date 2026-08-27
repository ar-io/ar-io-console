import { describe, expect, it } from 'vitest';

import { isInsufficientCredits } from './useManageArNSName';

describe('isInsufficientCredits', () => {
  it('matches explicit insufficient-funds phrasing', () => {
    for (const msg of [
      'Insufficient balance for this action',
      'not enough ARIO in this source',
      'balance too low to cover the price',
      'account is underfunded',
      'transfer amount exceeds balance',
    ]) {
      expect(isInsufficientCredits(new Error(msg))).toBe(true);
    }
  });

  it('matches a standalone 402 status token', () => {
    expect(isInsufficientCredits(new Error('Request failed: 402'))).toBe(true);
    expect(isInsufficientCredits(new Error('HTTP 402 Payment Required'))).toBe(
      true,
    );
  });

  it('does NOT treat an embedded 402 digit run as insufficient funds', () => {
    // tx-signature fragment / program error code / slot number containing 402
    expect(isInsufficientCredits(new Error('tx 5x402abc failed'))).toBe(false);
    expect(isInsufficientCredits(new Error('slot 1402011 not confirmed'))).toBe(
      false,
    );
    expect(isInsufficientCredits(new Error('custom program error 0x4020'))).toBe(
      false,
    );
  });

  it('lets unrelated failures propagate (returns false)', () => {
    expect(isInsufficientCredits(new Error('network timeout'))).toBe(false);
    expect(isInsufficientCredits('blockhash not found')).toBe(false);
  });
});
