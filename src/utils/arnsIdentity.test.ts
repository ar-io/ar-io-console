import { describe, expect, it } from 'vitest';

import { resolveArNSAddress } from './arnsIdentity';

const SOL = 'SoLanaAddress1111111111111111111111111111111';
const AR = 'arweave-address-0000000000000000000000000000';

describe('resolveArNSAddress', () => {
  it('uses the session address directly for a Solana session', () => {
    expect(
      resolveArNSAddress({ walletType: 'solana', address: SOL, linkedSolanaAddress: null }),
    ).toBe(SOL);
  });

  it('uses the linked wallet for a non-Solana session', () => {
    expect(
      resolveArNSAddress({ walletType: 'arweave', address: AR, linkedSolanaAddress: SOL }),
    ).toBe(SOL);
  });

  it('returns null once the PRIMARY wallet disconnects', () => {
    // The bug: `linkedSolanaAddress` persists to localStorage while the session
    // does not, so a signed-out user kept an ArNS identity and the purchase
    // button stayed live.
    expect(
      resolveArNSAddress({ walletType: null, address: null, linkedSolanaAddress: SOL }),
    ).toBeNull();
    expect(
      resolveArNSAddress({ walletType: 'arweave', address: null, linkedSolanaAddress: SOL }),
    ).toBeNull();
    expect(
      resolveArNSAddress({ walletType: null, address: AR, linkedSolanaAddress: SOL }),
    ).toBeNull();
  });

  it('returns null for a session with no linked wallet', () => {
    expect(
      resolveArNSAddress({ walletType: 'ethereum', address: '0xabc', linkedSolanaAddress: null }),
    ).toBeNull();
  });

  it('normalises undefined to null rather than leaking it', () => {
    expect(
      resolveArNSAddress({ walletType: 'arweave', address: AR, linkedSolanaAddress: undefined }),
    ).toBeNull();
  });
});
