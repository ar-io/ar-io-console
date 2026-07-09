import { describe, it, expect } from 'vitest';
import { parseTopUpDeepLink, formatDeepLinkSource } from './topupDeepLink';

// A real Arweave address: 43 chars of base64url ([A-Za-z0-9_-]).
const VALID_ARWEAVE = 'zGU6UNbW9NBhmYcm5-9Xh0dHu_zP4Qc6Q4qSb0dYkY8';
const VALID_ARWEAVE_2 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ'; // 43 chars
const ETH_ADDRESS = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
const SOL_ADDRESS = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

const params = (obj: Record<string, string>) => new URLSearchParams(obj);

describe('parseTopUpDeepLink', () => {
  it('seeds the destination when a valid Arweave address is present', () => {
    const result = parseTopUpDeepLink(
      params({ destinationAddress: VALID_ARWEAVE, source: 'ardrive-desktop' }),
    );
    expect(result.destinationAddress).toBe(VALID_ARWEAVE);
    expect(result.source).toBe('ardrive-desktop');
  });

  it('trims surrounding whitespace from a valid address', () => {
    const result = parseTopUpDeepLink(params({ destinationAddress: ` ${VALID_ARWEAVE_2} ` }));
    expect(result.destinationAddress).toBe(VALID_ARWEAVE_2);
  });

  // --- Regression guard: no param means behave exactly as today ---
  it('returns a null destination when no destinationAddress param is present', () => {
    const result = parseTopUpDeepLink(params({ amount: '50', token: 'ar', source: 'x' }));
    expect(result).toEqual({
      destinationAddress: null,
      amount: null,
      token: null,
      source: null,
    });
  });

  it('returns a null destination for an empty search string', () => {
    expect(parseTopUpDeepLink(new URLSearchParams()).destinationAddress).toBeNull();
  });

  // --- Invalid / malformed addresses are ignored, never throw ---
  it.each([
    ['too short', 'abc'],
    ['too long (44)', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQR'],
    ['illegal char (+)', 'zGU6UNbW9NBhmYcm5+9Xh0dHu_zP4Qc6Q4qSb0dYkY8'],
    ['ethereum address', ETH_ADDRESS],
    ['whitespace only', '   '],
  ])('ignores an invalid destinationAddress (%s)', (_label, addr) => {
    const result = parseTopUpDeepLink(params({ destinationAddress: addr }));
    expect(result.destinationAddress).toBeNull();
  });

  it('rejects a Solana address (destination must be Arweave)', () => {
    // A 44-char base58 address is not a 43-char base64url Arweave address.
    expect(parseTopUpDeepLink(params({ destinationAddress: SOL_ADDRESS })).destinationAddress).toBeNull();
  });

  it('does not throw on unusual input', () => {
    expect(() => parseTopUpDeepLink(params({ destinationAddress: '<script>' }))).not.toThrow();
  });

  // --- Secondary params are only honored alongside a valid destination ---
  it('parses amount and token when a valid destination is present', () => {
    const result = parseTopUpDeepLink(
      params({ destinationAddress: VALID_ARWEAVE, amount: '25.5', token: 'sol' }),
    );
    expect(result.amount).toBe(25.5);
    expect(result.token).toBe('solana');
  });

  it('ignores secondary params when the destination is invalid', () => {
    const result = parseTopUpDeepLink(params({ destinationAddress: 'nope', amount: '25', token: 'eth' }));
    expect(result.amount).toBeNull();
    expect(result.token).toBeNull();
  });

  it.each([
    ['ar', 'arweave'],
    ['eth', 'ethereum'],
    ['sol', 'solana'],
    ['AR', 'arweave'],
    ['ETH', 'ethereum'],
  ])('maps token alias %s -> %s', (alias, expected) => {
    const result = parseTopUpDeepLink(params({ destinationAddress: VALID_ARWEAVE, token: alias }));
    expect(result.token).toBe(expected);
  });

  it('returns a null token for an unrecognized token alias', () => {
    expect(parseTopUpDeepLink(params({ destinationAddress: VALID_ARWEAVE, token: 'doge' })).token).toBeNull();
  });

  it.each([
    ['zero', '0'],
    ['negative', '-10'],
    ['not a number', 'abc'],
    ['empty', ''],
  ])('returns a null amount for invalid amount (%s)', (_label, amount) => {
    expect(parseTopUpDeepLink(params({ destinationAddress: VALID_ARWEAVE, amount })).amount).toBeNull();
  });
});

describe('formatDeepLinkSource', () => {
  it('returns a friendly label for ardrive-desktop', () => {
    expect(formatDeepLinkSource('ardrive-desktop')).toBe('ArDrive Desktop');
  });

  it('passes through other non-empty sources', () => {
    expect(formatDeepLinkSource('some-app')).toBe('some-app');
  });

  it('returns null when there is no source', () => {
    expect(formatDeepLinkSource(null)).toBeNull();
  });
});
