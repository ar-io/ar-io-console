import { describe, expect, it } from 'vitest';

import { planNamePurchase } from './cardPlan';

describe('planNamePurchase', () => {
  it('is ready when a live signer is present', () => {
    expect(planNamePurchase({ needsLinking: false, signerLive: true })).toEqual({
      kind: 'ready',
    });
  });

  it('asks a returning user to reconnect rather than to connect afresh', () => {
    // The Solana provider does not auto-connect, so a linked-but-cold wallet is
    // the common case on every page load — not a missing wallet.
    expect(planNamePurchase({ needsLinking: false, signerLive: false })).toEqual(
      { kind: 'reconnect' },
    );
  });

  it('asks for a wallet only when there genuinely is none', () => {
    expect(planNamePurchase({ needsLinking: true, signerLive: false })).toEqual({
      kind: 'connect',
    });
  });

  it('treats a missing wallet as missing even if something reports a signer', () => {
    // needsLinking is the authority on whether a SOLANA wallet exists; a live
    // signer on some other chain cannot own the name.
    expect(planNamePurchase({ needsLinking: true, signerLive: true })).toEqual({
      kind: 'connect',
    });
  });

  it('never asks about SOL, because the purchase no longer needs any', () => {
    // Guards the regression this whole change exists to prevent: a buyer with
    // an empty wallet is now perfectly able to buy a name.
    const plans = [true, false].flatMap((signerLive) =>
      [true, false].map((needsLinking) =>
        planNamePurchase({ needsLinking, signerLive }),
      ),
    );
    expect(plans.every((p) => p.kind !== ('custodial' as never))).toBe(true);
  });
});
