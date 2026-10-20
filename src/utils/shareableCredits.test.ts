import { describe, it, expect } from 'vitest';
import { toShareableBalance, toApprovedWinc, wincToCredits, toShareRows, isSameWallet, formatCreditsFloor, parseCreditsToWinc, shareFailureMessage } from './shareableCredits';

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

describe('toShareRows', () => {
  const now = Date.parse('2026-10-20T00:00:00Z');

  it('groups given approvals by recipient, because revoke works per address', () => {
    const rows = toShareRows(
      [
        { approvedAddress: 'A', payingAddress: 'me', approvedWincAmount: String(2n * CREDIT), usedWincAmount: String(CREDIT / 2n), creationDate: '2026-10-01T00:00:00Z' },
        { approvedAddress: 'A', payingAddress: 'me', approvedWincAmount: String(CREDIT), usedWincAmount: '0', creationDate: '2026-10-05T00:00:00Z', expirationDate: '2026-10-27T00:00:00Z' },
        { approvedAddress: 'B', payingAddress: 'me', approvedWincAmount: String(CREDIT), usedWincAmount: '0', creationDate: '2026-10-03T00:00:00Z' },
      ],
      'given',
      now,
    );
    expect(rows.map((r) => r.address)).toEqual(['A', 'B']);
    expect(rows[0]).toEqual({
      address: 'A',
      approvedWinc: 3n * CREDIT,
      usedWinc: CREDIT / 2n,
      remainingWinc: 3n * CREDIT - CREDIT / 2n,
      soonestExpiry: '2026-10-27T00:00:00Z',
      count: 2,
    });
    expect(rows[1].soonestExpiry).toBeUndefined();
  });

  it('keys received approvals by the granting wallet', () => {
    const rows = toShareRows(
      [{ approvedAddress: 'me', payingAddress: 'G', approvedWincAmount: '5', usedWincAmount: '2' }],
      'received',
      now,
    );
    expect(rows).toEqual([{ address: 'G', approvedWinc: 5n, usedWinc: 2n, remainingWinc: 3n, count: 1 }]);
  });

  it('drops expired approvals and malformed rows', () => {
    const rows = toShareRows(
      [
        { approvedAddress: 'A', approvedWincAmount: '5', expirationDate: '2026-10-19T00:00:00Z' },
        { approvedWincAmount: '5' },
        { approvedAddress: 'B', approvedWincAmount: 'x', usedWincAmount: '9' },
      ],
      'given',
      now,
    );
    expect(rows).toEqual([{ address: 'B', approvedWinc: 0n, usedWinc: 9n, remainingWinc: 0n, count: 1 }]);
    expect(toShareRows(undefined, 'given', now)).toEqual([]);
  });
});

describe('isSameWallet', () => {
  it('matches 0x addresses case-insensitively and others exactly', () => {
    expect(isSameWallet('0xABCdef0000000000000000000000000000000001', '0xabcdef0000000000000000000000000000000001')).toBe(true);
    expect(isSameWallet(' HtR3kP9w ', 'HtR3kP9w')).toBe(true);
    expect(isSameWallet('htr3kp9w', 'HtR3kP9w')).toBe(false);
    expect(isSameWallet('A', null)).toBe(false);
  });
});

describe('formatCreditsFloor', () => {
  it('rounds down to four places without floating-point drift', () => {
    expect(formatCreditsFloor(37_462_200_000_000n)).toBe('37.4622');
    expect(formatCreditsFloor(33_912_299_999_999n)).toBe('33.9122');
    expect(formatCreditsFloor(50_000_000n)).toBe('0.0000');
    expect(formatCreditsFloor(0n)).toBe('0.0000');
  });

  it('what Max fills in reads back as no more than the balance', () => {
    for (const winc of [33_912_200_000_000n, 37_462_200_000_000n, 123_456_789n, 9_007_199_254_740_993_000n]) {
      expect(parseCreditsToWinc(formatCreditsFloor(winc))!).toBeLessThanOrEqual(winc);
    }
  });
});

describe('parseCreditsToWinc', () => {
  it('parses exactly, without floating point', () => {
    expect(parseCreditsToWinc('5')).toBe(5n * CREDIT);
    expect(parseCreditsToWinc('0.25')).toBe(CREDIT / 4n);
    expect(parseCreditsToWinc('.5')).toBe(CREDIT / 2n);
    expect(parseCreditsToWinc('3.')).toBe(3n * CREDIT);
    expect(parseCreditsToWinc(' 12345.6789 ')).toBe(12_345_678_900_000_000n);
    // Number('9007.1993') * 1e12 lands a winc away from what was typed.
    expect(parseCreditsToWinc('9007.1993')).toBe(9_007_199_300_000_000n);
  });

  it('rounds digits past the twelfth place half up', () => {
    expect(parseCreditsToWinc('0.0000000000014')).toBe(1n);
    expect(parseCreditsToWinc('0.0000000000015')).toBe(2n);
  });

  it('rejects anything that is not a plain decimal', () => {
    for (const bad of ['', '.', '-1', '1e3', 'abc', '1.2.3', '0x10']) {
      expect(parseCreditsToWinc(bad)).toBeUndefined();
    }
  });

  it('toApprovedWinc uses the exact parse for text and still clamps', () => {
    expect(toApprovedWinc('9007.1993', 10_000n * CREDIT)).toBe(9_007_199_300_000_000n);
    expect(toApprovedWinc('40', 33n * CREDIT)).toBe(33n * CREDIT);
    expect(toApprovedWinc('', CREDIT)).toBe(0n);
  });
});

describe('shareFailureMessage', () => {
  it('turns the SDK wrapper into a refusal the user can act on', () => {
    const err = new Error('Failed to upload file after 1 attempts Failed request (Status 400): Insufficient balance');
    expect(shareFailureMessage(err, 'share')).toMatch(/^Couldn't share credits: the payment service says this wallet doesn't have enough credits/);
  });

  it('says nothing happened when the signature was cancelled', () => {
    expect(shareFailureMessage(new Error('User rejected the request'), 'revoke')).toBe(
      'Nothing was revoked: the signature request was cancelled.',
    );
  });

  it('strips the wrapper and keeps the service reason', () => {
    const err = new Error('Failed to upload file after 3 attempts Failed request (Status 503): Service Unavailable');
    expect(shareFailureMessage(err, 'share')).toBe("Couldn't share credits: Service Unavailable");
    expect(shareFailureMessage(undefined, 'revoke')).toBe("Couldn't revoke that share. Try again.");
  });
});
