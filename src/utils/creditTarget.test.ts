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
    A host that names a destination gets it. ArNS deliberately does NOT: its
    payer is the session identity, so it leaves this unset and takes the
    default below.
  */
  it('honours a destination the host names explicitly', () => {
    const target = resolveCreditTarget({
      destination: { address: SOL, type: 'solana' },
      sessionAddress: ETH,
      sessionWalletType: 'ethereum',
    });
    expect(target).toEqual({ address: SOL, type: 'solana' });
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
