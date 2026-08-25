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

describe('smallest-unit amounts must stay integers', () => {
  const LAMPORTS_PER_SOL = 1_000_000_000n;
  const WEI_PER_ETH = 1_000_000_000_000_000_000n;

  it('returns a whole number of lamports, never a fraction', () => {
    // `topUpWithTokens` takes the SMALLEST unit and rejects a decimal:
    // "0.019876422 cannot be converted to a BigInt because it is not an
    // integer". Passing whole SOL is what produced that.
    const units = tokenUnitsForWinc({
      winc: 576541443107n,
      wincPerToken: 28662173913043n,
      tokenSmallestUnit: LAMPORTS_PER_SOL,
      roundUp: true,
    });
    expect(typeof units).toBe('bigint');
    expect(units % 1n).toBe(0n);
    // ~0.0201 SOL expressed in lamports — an integer in the tens of millions.
    expect(units).toBeGreaterThan(20_000_000n);
    expect(units).toBeLessThan(21_000_000n);
  });

  it('stays exact at 18 decimals, where a float round-trip would not', () => {
    // Scaling a display figure back up goes through a float: harmless at SOL's
    // 1e9, lossy at ETH's 1e18. Integer arithmetic end to end avoids it.
    const units = tokenUnitsForWinc({
      winc: 1n,
      wincPerToken: 3n,
      tokenSmallestUnit: WEI_PER_ETH,
      roundUp: true,
    });
    expect(units).toBe(WEI_PER_ETH / 3n + 1n);
    expect(units.toString()).not.toContain('e');
  });
});
