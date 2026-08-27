import { describe, it, expect } from 'vitest';
import { getExplorerTxUrl } from './getExplorerTxUrl';

describe('getExplorerTxUrl', () => {
  it('maps each supported token to its explorer', () => {
    expect(getExplorerTxUrl('abc', 'solana')).toBe('https://solscan.io/tx/abc');
    expect(getExplorerTxUrl('abc', 'ario')).toBe('https://solscan.io/tx/abc'); // ARIO settles on Solana
    expect(getExplorerTxUrl('0x1', 'ethereum')).toBe('https://etherscan.io/tx/0x1');
    expect(getExplorerTxUrl('0x1', 'usdc')).toBe('https://etherscan.io/tx/0x1');
    expect(getExplorerTxUrl('0x1', 'base-eth')).toBe('https://basescan.org/tx/0x1');
    expect(getExplorerTxUrl('0x1', 'base-usdc')).toBe('https://basescan.org/tx/0x1');
    expect(getExplorerTxUrl('0x1', 'base-ario')).toBe('https://basescan.org/tx/0x1');
    expect(getExplorerTxUrl('0x1', 'pol')).toBe('https://polygonscan.com/tx/0x1');
    expect(getExplorerTxUrl('0x1', 'polygon-usdc')).toBe('https://polygonscan.com/tx/0x1');
    expect(getExplorerTxUrl('arTx', 'arweave')).toBe('https://viewblock.io/arweave/tx/arTx');
    expect(getExplorerTxUrl('kTx', 'kyve')).toBe('https://www.mintscan.io/kyve/tx/kTx');
  });

  it('is case-insensitive on the token', () => {
    expect(getExplorerTxUrl('abc', 'SOLANA')).toBe('https://solscan.io/tx/abc');
  });

  it('returns null for unknown tokens or a missing tx id', () => {
    expect(getExplorerTxUrl('abc', 'dogecoin')).toBeNull();
    expect(getExplorerTxUrl('', 'solana')).toBeNull();
  });
});
