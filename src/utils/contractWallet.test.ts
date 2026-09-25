import { describe, expect, it } from 'vitest';

import { isContractWalletCode } from './contractWallet';

describe('isContractWalletCode', () => {
  it('treats an address with no code as a plain wallet', () => {
    expect(isContractWalletCode('0x')).toBe(false);
    expect(isContractWalletCode('0x0')).toBe(false);
    expect(isContractWalletCode('')).toBe(false);
    expect(isContractWalletCode(undefined)).toBe(false);
    expect(isContractWalletCode(null)).toBe(false);
  });

  it('flags deployed contract code', () => {
    // A minimal proxy, as smart-wallet factories deploy.
    expect(
      isContractWalletCode(
        '0x363d3d373d3d3d363d73bebebebebebebebebebebebebebebebebebebebe5af43d82803e903d91602b57fd5bf3',
      ),
    ).toBe(true);
  });

  it('does not flag an EOA with an EIP-7702 delegation', () => {
    // It still sends direct transactions, so its memo is read.
    expect(
      isContractWalletCode('0xef010063c0c19a282a1b52b07dd5a65b58948a07dae32b'),
    ).toBe(false);
    expect(
      isContractWalletCode('0xEF010063C0C19A282A1B52B07DD5A65B58948A07DAE32B'),
    ).toBe(false);
  });

  it('flags code that only starts like a delegation', () => {
    // Longer than a designator, so it is real contract code.
    expect(
      isContractWalletCode('0xef010063c0c19a282a1b52b07dd5a65b58948a07dae32b00'),
    ).toBe(true);
  });
});
