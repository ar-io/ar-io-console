import { describe, it, expect } from 'vitest';
import { resolveCreditTarget } from './creditTarget';

const SOL = 'So1anaOwnerAddress11111111111111111111111111';
const ETH = '0x1111111111111111111111111111111111111111';

describe('resolveCreditTarget', () => {
  it('credits the signed-in wallet in the ordinary case', () => {
    expect(
      resolveCreditTarget({ sessionAddress: ETH, sessionWalletType: 'ethereum' }),
    ).toEqual({ address: ETH, type: 'ethereum' });
  });

  it('prefers a recipient the user or a deep link named', () => {
    expect(
      resolveCreditTarget({
        paymentTargetAddress: SOL,
        paymentTargetType: 'solana',
        sessionAddress: ETH,
        sessionWalletType: 'ethereum',
      }),
    ).toEqual({ address: SOL, type: 'solana' });
  });

  /*
    The bug this module exists for. An Ethereum session buying an ArNS name
    spends the credits of the LINKED Solana wallet, so crediting the session
    address takes the money and leaves the purchase unfunded.
  */
  it('credits the name owner, not the Ethereum session paying for it', () => {
    const target = resolveCreditTarget({
      destination: { address: SOL, type: 'solana' },
      sessionAddress: ETH,
      sessionWalletType: 'ethereum',
    });
    expect(target).toEqual({ address: SOL, type: 'solana' });
    expect(target?.address).not.toBe(ETH);
  });

  it('lets the owner destination beat a stale payment target too', () => {
    expect(
      resolveCreditTarget({
        destination: { address: SOL, type: 'solana' },
        paymentTargetAddress: ETH,
        paymentTargetType: 'ethereum',
        sessionAddress: ETH,
        sessionWalletType: 'ethereum',
      })?.address,
    ).toBe(SOL);
  });

  it('is a no-op for a Solana session, where the two are the same wallet', () => {
    expect(
      resolveCreditTarget({
        destination: { address: SOL, type: 'solana' },
        sessionAddress: SOL,
        sessionWalletType: 'solana',
      }),
    ).toEqual({ address: SOL, type: 'solana' });
  });

  it('returns nothing when signed out with no recipient', () => {
    expect(resolveCreditTarget({})).toBeUndefined();
  });
});
