import { describe, expect, it } from 'vitest';

import {
  isSolanaChainToken,
  solanaClientToken,
  solanaUsdcMintForGenesis,
} from './solanaToken';

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

describe('solanaUsdcMintForGenesis', () => {
  // Genesis hashes as reported by getGenesisHash on each public cluster.
  const MAINNET = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
  const DEVNET = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';

  it('picks the mint for the cluster the RPC is actually on', () => {
    expect(solanaUsdcMintForGenesis(MAINNET)).toBe(
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    );
    // The case that motivated this: a custom config on a devnet RPC must read
    // the devnet mint, whatever configMode says.
    expect(solanaUsdcMintForGenesis(DEVNET)).toBe(
      '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    );
  });

  it('returns nothing for a cluster with no known mint, rather than guessing', () => {
    expect(solanaUsdcMintForGenesis('someLocalnetGenesisHash')).toBeUndefined();
    expect(solanaUsdcMintForGenesis(undefined)).toBeUndefined();
    expect(solanaUsdcMintForGenesis('')).toBeUndefined();
  });
});
