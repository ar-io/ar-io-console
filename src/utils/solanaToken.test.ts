import { describe, expect, it } from 'vitest';

import { isSolanaChainToken, solanaClientToken } from './solanaToken';

describe('solanaClientToken', () => {
  it('honours a Solana-chain token', () => {
    // The bug this exists to stop: a SOL client spending an amount that was
    // converted with USDC's six decimals. 25 USDC became 25,000,000 lamports.
    expect(solanaClientToken('solana-usdc')).toBe('solana-usdc');
    expect(solanaClientToken('solana')).toBe('solana');
  });

  it('falls back to SOL when nothing is requested', () => {
    expect(solanaClientToken(undefined)).toBe('solana');
    expect(solanaClientToken(null)).toBe('solana');
    expect(solanaClientToken('')).toBe('solana');
  });

  it('falls back to SOL for a token this wallet cannot sign', () => {
    // A Solana key cannot sign an EVM transfer, so passing one through would
    // build a client that fails further from the cause than this does.
    for (const token of ['base-usdc', 'base-eth', 'ethereum', 'arweave', 'ario', 'pol']) {
      expect(solanaClientToken(token)).toBe('solana');
    }
  });
});

describe('isSolanaChainToken', () => {
  it('is true for exactly the two tokens a Solana wallet pays with', () => {
    expect(isSolanaChainToken('solana')).toBe(true);
    expect(isSolanaChainToken('solana-usdc')).toBe(true);
    expect(isSolanaChainToken('base-usdc')).toBe(false);
    expect(isSolanaChainToken(undefined)).toBe(false);
  });
});
