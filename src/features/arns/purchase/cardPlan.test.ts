import { describe, expect, it } from 'vitest';

import { isCustodialPlan, planCardPurchase } from './cardPlan';

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

  it('offers linking before custody when there is no wallet at all', () => {
    expect(planCardPurchase({ ...base, needsLinking: true }))
      .toEqual({ kind: 'link' });
  });

  it('falls back to custody only once linking is declined', () => {
    expect(
      planCardPurchase({ ...base, needsLinking: true, declinedLink: true }),
    ).toEqual({ kind: 'custodial', reason: 'no-wallet' });
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

  it('prefers linking over custody even when SOL is unknown', () => {
    expect(
      planCardPurchase({ needsLinking: true, signerLive: false, solCoversGas: undefined }),
    ).toEqual({ kind: 'link' });
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
    expect(isCustodialPlan({ kind: 'link' })).toBe(false);
  });
});
