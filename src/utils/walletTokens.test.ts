import { describe, expect, it } from 'vitest';

import { availableTokensForWallet, defaultTokenForWallet } from './walletTokens';

const all = () => true;
const none = () => false;

describe('defaultTokenForWallet', () => {
  it('opens a Solana wallet on SOL, not AR', () => {
    // The bug: the panel hard-coded 'arweave', so a Solana user saw their
    // (empty) AR balance and read it as having no funds.
    expect(defaultTokenForWallet('solana', all)).toBe('solana');
  });

  it('opens an Arweave wallet on AR', () => {
    expect(defaultTokenForWallet('arweave', all)).toBe('arweave');
  });

  it('opens an Ethereum wallet on the cheapest option first', () => {
    expect(defaultTokenForWallet('ethereum', all)).toBe('base-usdc');
  });

  it('respects token gating — skips anything not selectable', () => {
    const noBaseUsdc = (t: string) => t !== 'base-usdc';
    expect(defaultTokenForWallet('ethereum', noBaseUsdc as never)).toBe('base-eth');
  });

  it('returns undefined when nothing is payable, so the caller leaves selection alone', () => {
    expect(defaultTokenForWallet(null, all)).toBeUndefined();
    expect(defaultTokenForWallet('ethereum', none)).toBeUndefined();
  });
});

describe('availableTokensForWallet', () => {
  it('never offers a token the wallet cannot sign for', () => {
    expect(availableTokensForWallet('solana', all)).toEqual(['solana']);
    expect(availableTokensForWallet('arweave', all)).toEqual(['arweave']);
    expect(availableTokensForWallet('arweave', all)).not.toContain('solana');
  });

  it('is empty with no wallet', () => {
    expect(availableTokensForWallet(null, all)).toEqual([]);
  });
});
