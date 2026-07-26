import { describe, it, expect } from 'vitest';
import { getExplorerAddressUrl } from './getExplorerAddressUrl';

describe('getExplorerAddressUrl', () => {
  it('maps each wallet ecosystem to its address explorer', () => {
    expect(getExplorerAddressUrl('0xabc', 'ethereum')).toBe('https://etherscan.io/address/0xabc');
    expect(getExplorerAddressUrl('So1ana', 'solana')).toBe('https://solscan.io/account/So1ana');
    expect(getExplorerAddressUrl('arAddr', 'arweave')).toBe(
      'https://viewblock.io/arweave/address/arAddr',
    );
  });

  it('is case-insensitive on the wallet type', () => {
    expect(getExplorerAddressUrl('0xabc', 'Ethereum')).toBe('https://etherscan.io/address/0xabc');
  });

  it('returns null for unknown wallet types or a missing address', () => {
    expect(getExplorerAddressUrl('0xabc', 'ledger')).toBeNull();
    expect(getExplorerAddressUrl('', 'ethereum')).toBeNull();
  });
});
