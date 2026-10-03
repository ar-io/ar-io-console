import { describe, expect, it } from 'vitest';
import { shortAddress, tokenShortfallNote, walletSplitNote, walletSplitPhrase } from './walletRoles';

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

describe('tokenShortfallNote', () => {
  it('names the token, the paying wallet and both amounts', () => {
    const note = tokenShortfallNote({
      tokenLabel: 'USDC (Base)',
      walletType: 'ethereum',
      walletAddress: ETH,
      held: 0,
      needed: 2.9512,
    });
    expect(note).toBe(
      `Not enough USDC (Base) in your Ethereum wallet (${shortAddress(ETH)}). You have 0; this name needs 2.96.`,
    );
  });

  it('rounds the requirement up, never down', () => {
    const note = tokenShortfallNote({
      tokenLabel: 'SOL',
      walletType: 'solana',
      walletAddress: undefined,
      held: 0.01,
      needed: 0.010601,
    });
    expect(note).toContain('this name needs 0.0107');
  });

  it('never blames SOL for another token', () => {
    const note = tokenShortfallNote({
      tokenLabel: 'USDC (Base)',
      walletType: 'ethereum',
      walletAddress: ETH,
      held: 0,
      needed: 3,
    });
    expect(note).not.toMatch(/SOL/);
  });

  it('reads plainly without a wallet address', () => {
    expect(
      tokenShortfallNote({
        tokenLabel: 'SOL',
        walletType: 'solana',
        walletAddress: undefined,
        held: 0.12,
        needed: 0.24,
      }),
    ).toBe('Not enough SOL in your Solana wallet. You have 0.12; this name needs 0.24.');
  });

  it('does not report an unread balance as zero', () => {
    const note = tokenShortfallNote({
      tokenLabel: 'SOL',
      walletType: 'solana',
      walletAddress: undefined,
      held: undefined,
      needed: 0.24,
    });
    expect(note).not.toMatch(/You have/);
    expect(note).toMatch(/Couldn't read the SOL balance/);
  });

  it('ignores float noise when rounding up', () => {
    const note = tokenShortfallNote({
      tokenLabel: 'USDC (Base)',
      walletType: 'ethereum',
      walletAddress: undefined,
      held: 0,
      needed: 2.95,
    });
    expect(note).toContain('this name needs 2.95.');
  });

  it('shows large requirements in whole units, rounded up', () => {
    const note = tokenShortfallNote({
      tokenLabel: 'ARIO',
      walletType: 'solana',
      walletAddress: undefined,
      held: 0,
      needed: 12_345.01,
    });
    expect(note).toContain('this name needs 12,346.');
  });
});


describe('walletSplitPhrase', () => {
  it('says the linked wallet pays when it is the one paying', () => {
    expect(
      walletSplitPhrase({
        sessionWalletType: 'arweave',
        sessionAddress: ETH,
        ownerAddress: SOL,
        payingWalletType: 'solana',
      }),
    ).toBe('paid from your linked Solana wallet');
  });

  it('names the holding wallet when the session wallet pays', () => {
    expect(
      walletSplitPhrase({
        sessionWalletType: 'ethereum',
        sessionAddress: ETH,
        ownerAddress: SOL,
        payingWalletType: 'ethereum',
      }),
    ).toBe(`name held by your linked Solana wallet ${shortAddress(SOL)}`);
  });

  it('says nothing for one wallet, or when anything is unknown', () => {
    expect(
      walletSplitPhrase({ sessionWalletType: 'solana', sessionAddress: SOL, ownerAddress: SOL }),
    ).toBeUndefined();
    expect(
      walletSplitPhrase({ sessionWalletType: 'ethereum', sessionAddress: ETH, ownerAddress: undefined }),
    ).toBeUndefined();
  });

  it('has no sentence punctuation, so it joins a status line cleanly', () => {
    const p = walletSplitPhrase({
      sessionWalletType: 'ethereum',
      sessionAddress: ETH,
      ownerAddress: SOL,
    })!;
    expect(p).not.toMatch(/[.,]$/);
    expect(p[0]).toBe(p[0].toLowerCase());
  });
});
