import { describe, expect, it } from 'vitest';

import { isCustodialPlan, planCardPurchase, custodialPurchaseEnabled } from './cardPlan';

const base = { needsLinking: false, signerLive: true, solCoversGas: true };

describe('planCardPurchase', () => {
  it('self-custodies when the wallet is live and can cover rent', () => {
    expect(planCardPurchase(base)).toEqual({ kind: 'self-custody' });
  });

  it('asks to RECONNECT a cold wallet instead of taking custody', () => {
    // The regression this exists to prevent: `autoConnect=false` means a
    // returning user's linked wallet is cold, which previously read as "no
    // wallet" and cost them the ANT plus the spawn surcharge.
    expect(planCardPurchase({ ...base, signerLive: false }))
      .toEqual({ kind: 'reconnect' });
  });

  it('reconnects even when SOL is short — a cold wallet may be funded', () => {
    // Balances can't be trusted for a wallet we haven't connected to; assuming
    // it is broke and going custodial compounds the same mistake.
    expect(planCardPurchase({ ...base, signerLive: false, solCoversGas: false }))
      .toEqual({ kind: 'reconnect' });
  });

  it('buys custodially when there is no wallet, without asking about one', () => {
    // The gate that used to sit here asked someone paying by card to make a
    // Solana decision before they owned anything that made it matter.
    expect(planCardPurchase({ ...base, needsLinking: true }))
      .toEqual({ kind: 'custodial', reason: 'no-wallet' });
  });

  it('goes custodial for a live wallet that genuinely cannot pay rent', () => {
    expect(planCardPurchase({ ...base, solCoversGas: false }))
      .toEqual({ kind: 'custodial', reason: 'no-sol' });
  });

  it('treats an UNKNOWN balance as self-custody, never as custodial', () => {
    // Asymmetric: a failed self-custody attempt costs nothing, while a
    // custodial buy spends money and transfers ownership.
    expect(planCardPurchase({ ...base, solCoversGas: undefined }))
      .toEqual({ kind: 'self-custody' });
  });

  it('goes custodial with no wallet even when SOL is unknown', () => {
    // No wallet means no signer, so the balance cannot rescue the purchase.
    expect(
      planCardPurchase({ needsLinking: true, signerLive: false, solCoversGas: undefined }),
    ).toEqual({ kind: 'custodial', reason: 'no-wallet' });
  });

  it('still wakes a wallet that exists but is asleep', () => {
    // Distinct from having no wallet: this user already chose self-custody.
    expect(planCardPurchase({ ...base, signerLive: false }))
      .toEqual({ kind: 'reconnect' });
  });

  it('distinguishes the two custodial reasons, since they are told differently', () => {
    const noWallet = planCardPurchase({ ...base, needsLinking: true, declinedLink: true });
    const noSol = planCardPurchase({ ...base, solCoversGas: false });
    expect(noWallet).not.toEqual(noSol);
    expect([noWallet, noSol].every(isCustodialPlan)).toBe(true);
  });

  it('reports non-custodial plans as such', () => {
    expect(isCustodialPlan({ kind: 'self-custody' })).toBe(false);
    expect(isCustodialPlan({ kind: 'reconnect' })).toBe(false);
      });
});

describe('with custody switched off for launch', () => {
  const off = { ...base, custodialEnabled: false };

  it('asks a wallet-less buyer to connect one instead of selling custody', () => {
    expect(planCardPurchase({ ...off, needsLinking: true })).toEqual({
      kind: 'link',
    });
  });

  it('falls through to self-custody when SOL is short, so the balance gating speaks', () => {
    // Deliberately NOT a bespoke blocked kind: buildPaymentOptions already
    // blocks this and names the shortfall, and one rule beats two.
    expect(planCardPurchase({ ...off, solCoversGas: false })).toEqual({
      kind: 'self-custody',
    });
  });

  it('never returns a custodial plan by any route', () => {
    const inputs = [
      { ...off, needsLinking: true },
      { ...off, signerLive: false },
      { ...off, solCoversGas: false },
      { ...off, solCoversGas: undefined },
      off,
    ];
    for (const i of inputs) {
      expect(planCardPurchase(i).kind).not.toBe('custodial');
    }
  });

  it('still sells custody when the switch is on', () => {
    expect(planCardPurchase({ ...base, needsLinking: true }).kind).toBe(
      'custodial',
    );
  });
});

describe('custodialPurchaseEnabled', () => {
  it('is off in every environment, not just production', () => {
    // Retired pending sponsored gas, which removes the SOL requirement without
    // giving the asset away. Not an environment gate.
    for (const mode of ['production', 'development', 'custom']) {
      expect(custodialPurchaseEnabled(mode)).toBe(false);
    }
  });
});

describe('a known SOL shortfall outranks a cold signer', () => {
  it('does not offer reconnect when reconnecting cannot fund the purchase', () => {
    // Reconnecting is real advice, but not when the wallet is empty — the user
    // would follow it and hit the shortfall one click later.
    expect(
      planCardPurchase({
        needsLinking: false,
        signerLive: false,
        solCoversGas: false,
        custodialEnabled: false,
      }),
    ).toEqual({ kind: 'self-custody' });
  });

  it('still asks a cold wallet to reconnect when the balance is unknown', () => {
    expect(
      planCardPurchase({
        needsLinking: false,
        signerLive: false,
        solCoversGas: undefined,
        custodialEnabled: false,
      }),
    ).toEqual({ kind: 'reconnect' });
  });

  it('still asks a funded cold wallet to reconnect', () => {
    expect(
      planCardPurchase({
        needsLinking: false,
        signerLive: false,
        solCoversGas: true,
        custodialEnabled: false,
      }),
    ).toEqual({ kind: 'reconnect' });
  });
});
