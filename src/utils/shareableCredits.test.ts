import { describe, it, expect } from 'vitest';
import { toShareableBalance, toApprovedWinc, wincToCredits } from './shareableCredits';

const CREDIT = 1_000_000_000_000n;

describe('toShareableBalance', () => {
  it('excludes credits shared with the wallet from what it can share', () => {
    // The reported case: ~33.9 owned + 3.55 received shows as 37.46 spendable.
    const owned = 33_912_200_000_000n;
    const received = 3_550_000_000_000n;
    const b = toShareableBalance({
      winc: String(owned),
      controlledWinc: String(owned),
      effectiveBalance: String(owned + received),
    });
    expect(b.shareableWinc).toBe(owned);
    expect(b.receivedWinc).toBe(received);
    expect(b.sharedOutWinc).toBe(0n);
  });

  it('reports credits already shared out from controlledWinc', () => {
    const b = toShareableBalance({
      winc: String(8n * CREDIT),
      controlledWinc: String(10n * CREDIT),
      effectiveBalance: String(8n * CREDIT),
    });
    expect(b.shareableWinc).toBe(8n * CREDIT);
    expect(b.sharedOutWinc).toBe(2n * CREDIT);
    expect(b.receivedWinc).toBe(0n);
  });

  it('reads missing fields as zero (the 404 shape is { winc: 0 })', () => {
    expect(toShareableBalance({ winc: 0 })).toEqual({
      shareableWinc: 0n,
      receivedWinc: 0n,
      sharedOutWinc: 0n,
    });
    expect(toShareableBalance(null).shareableWinc).toBe(0n);
  });

  it('ignores malformed values rather than throwing', () => {
    const b = toShareableBalance({ winc: 'abc', effectiveBalance: '-5', controlledWinc: undefined });
    expect(b).toEqual({ shareableWinc: 0n, receivedWinc: 0n, sharedOutWinc: 0n });
  });

  it('keeps precision beyond Number.MAX_SAFE_INTEGER', () => {
    const big = '123456789012345678901';
    expect(toShareableBalance({ winc: big }).shareableWinc).toBe(BigInt(big));
  });
});

describe('toApprovedWinc', () => {
  it('converts credits to winc', () => {
    expect(toApprovedWinc(1.5, 10n * CREDIT)).toBe(1_500_000_000_000n);
  });

  it('never exceeds the shareable balance, so "share everything" succeeds', () => {
    const shareable = 33_912_345_678_901n;
    expect(toApprovedWinc(wincToCredits(shareable), shareable)).toBeLessThanOrEqual(shareable);
    expect(toApprovedWinc(1000, shareable)).toBe(shareable);
  });

  it('returns zero for non-positive or non-finite amounts', () => {
    expect(toApprovedWinc(0, CREDIT)).toBe(0n);
    expect(toApprovedWinc(-1, CREDIT)).toBe(0n);
    expect(toApprovedWinc(NaN, CREDIT)).toBe(0n);
  });
});
