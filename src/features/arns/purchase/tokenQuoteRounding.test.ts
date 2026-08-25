import { describe, expect, it } from 'vitest';

import { tokenUnitsForWinc } from './tokenQuoteRounding';

const LAMPORTS = 1_000_000_000n;

describe('tokenUnitsForWinc', () => {
  it('rounds UP when the division is inexact', () => {
    // The whole point: truncating here buys a fraction too few credits and the
    // registration fails after the user has paid.
    const args = { winc: 10n, wincPerToken: 3n, tokenSmallestUnit: 1n };
    expect(tokenUnitsForWinc({ ...args, roundUp: false })).toBe(3n);
    expect(tokenUnitsForWinc({ ...args, roundUp: true })).toBe(4n);
  });

  it('does not inflate an exact conversion', () => {
    const args = { winc: 9n, wincPerToken: 3n, tokenSmallestUnit: 1n };
    expect(tokenUnitsForWinc({ ...args, roundUp: true })).toBe(3n);
    expect(tokenUnitsForWinc({ ...args, roundUp: false })).toBe(3n);
  });

  it('rounds up by ONE smallest unit, not a meaningful amount', () => {
    // A lamport of over-funding is invisible; a lamport short is a failed
    // purchase. The asymmetry is why this rounds at all.
    const up = tokenUnitsForWinc({
      winc: 582906408433n, wincPerToken: 28662173913043n,
      tokenSmallestUnit: LAMPORTS, roundUp: true,
    });
    const down = tokenUnitsForWinc({
      winc: 582906408433n, wincPerToken: 28662173913043n,
      tokenSmallestUnit: LAMPORTS, roundUp: false,
    });
    expect(up - down).toBe(1n);
    expect(Number(up) / Number(LAMPORTS)).toBeCloseTo(0.02034, 5);
  });

  it('never divides by a zero or negative rate', () => {
    for (const wincPerToken of [0n, -5n]) {
      expect(
        tokenUnitsForWinc({ winc: 10n, wincPerToken, tokenSmallestUnit: 1n, roundUp: true }),
      ).toBe(0n);
    }
  });

  it('returns zero for a zero target', () => {
    expect(
      tokenUnitsForWinc({ winc: 0n, wincPerToken: 3n, tokenSmallestUnit: 1n, roundUp: true }),
    ).toBe(0n);
  });
});
