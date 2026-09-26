import { describe, expect, it } from 'vitest';
import { shortAddress, walletSplitNote } from './walletRoles';

const SOL = 'So1anaOwner1111111111111111111111111111111111';
const ETH = '0x1111111111111111111111111111111111111111';

describe('walletSplitNote', () => {
  /*
    ARIO is paid by the owner's own transaction, so on an Ethereum or Arweave
    session the linked Solana wallet pays too. The note must not tell them the
    session wallet pays.
  */
  it('says the linked wallet pays when it is the one paying', () => {
    for (const sessionWalletType of ['ethereum', 'arweave'] as const) {
      const note = walletSplitNote({
        sessionWalletType,
        sessionAddress: ETH,
        ownerAddress: SOL,
        payingWalletType: 'solana',
      });
      expect(note).toBe(
        `Your linked Solana wallet, ${shortAddress(SOL)}, pays for and holds the name.`,
      );
    }
  });

  it('keeps the usual note when the session wallet pays', () => {
    const note = walletSplitNote({
      sessionWalletType: 'ethereum',
      sessionAddress: ETH,
      ownerAddress: SOL,
      payingWalletType: 'ethereum',
    });
    expect(note).toMatch(/You'll pay from your Ethereum wallet/);
  });

  it('names both wallets when the payer is not the owner', () => {
    const note = walletSplitNote({
      sessionWalletType: 'ethereum',
      sessionAddress: ETH,
      ownerAddress: SOL,
    })!;
    expect(note).toMatch(/Ethereum wallet/);
    expect(note).toMatch(/Solana wallet/);
    expect(note).toContain(shortAddress(SOL));
  });

  /*
    A Solana session has one wallet in both roles. Telling them about a split
    would invent a distinction they do not have.
  */
  it('says nothing when one wallet holds both roles', () => {
    expect(
      walletSplitNote({
        sessionWalletType: 'solana',
        sessionAddress: SOL,
        ownerAddress: SOL,
      }),
    ).toBeUndefined();
  });

  it('says nothing rather than something half-known', () => {
    for (const input of [
      { sessionWalletType: null, sessionAddress: ETH, ownerAddress: SOL },
      { sessionWalletType: 'ethereum' as const, sessionAddress: null, ownerAddress: SOL },
      { sessionWalletType: 'ethereum' as const, sessionAddress: ETH, ownerAddress: undefined },
    ]) {
      expect(walletSplitNote(input)).toBeUndefined();
    }
  });

  it('covers an Arweave session, which has the same split', () => {
    expect(
      walletSplitNote({
        sessionWalletType: 'arweave',
        sessionAddress: 'arweave-address-43-chars-long-aaaaaaaaaaaa',
        ownerAddress: SOL,
      }),
    ).toMatch(/Arweave wallet/);
  });

  it('never claims the owner wallet is the one being charged', () => {
    const note = walletSplitNote({
      sessionWalletType: 'ethereum',
      sessionAddress: ETH,
      ownerAddress: SOL,
    })!;
    // "pay from" must attach to the session wallet, not the Solana one.
    expect(note.indexOf('pay from')).toBeLessThan(note.indexOf('Solana'));
  });
});

describe('shortAddress', () => {
  it('keeps both ends so a wallet stays recognisable', () => {
    expect(shortAddress(SOL)).toBe(`${SOL.slice(0, 4)}…${SOL.slice(-4)}`);
  });
  it('leaves a short string alone rather than padding it with an ellipsis', () => {
    expect(shortAddress('abc')).toBe('abc');
  });
});
