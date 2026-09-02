import { describe, expect, it } from 'vitest';

/*
  ActionCostNote renders React, so the component itself is out of reach of this
  suite (node environment, no DOM harness). What IS testable is the fact the
  component encodes, and the fact is the whole bug: `transfer`,
  `add-controller` and `remove-controller` run through `getWritableANT` —
  `ANT.init({ rpc, signer })`, a direct Solana client — so they spend SOL and no
  credits at all.

  This test reads the hooks and fails if a Turbo client ever appears in them
  without the cost copy being revisited. It is a tripwire, not a unit test: the
  copy said "credits" for months because nobody checked which rail these run on,
  and a grep is the cheapest thing that would have caught it.
*/
import { readFileSync } from 'node:fs';

const HOOKS = [
  'src/features/arns/hooks/useTransferArNSName.ts',
  'src/features/arns/hooks/useControllers.ts',
];

describe('the directly-signed ArNS actions', () => {
  it.each(HOOKS)('%s signs with the wallet, not Turbo', (path) => {
    const src = readFileSync(path, 'utf8');
    expect(src).toMatch(/getWritableANT/);
    // A Turbo client here means credits are spent, and the copy that tells the
    // user "it doesn't use credits" has become a lie.
    expect(src).not.toMatch(/getOwnerClient|purchaseWithCredits|topUpWithTokens/);
  });

  it.each(HOOKS)('%s does not offer a credits Top-Up', (path) => {
    const src = readFileSync(path, 'utf8');
    /*
      A Solana "insufficient lamports" failure matches the insufficient-credits
      regex, so wiring that flag here pointed users at the credits page when
      what they needed was SOL.
    */
    expect(src).not.toMatch(/insufficientCredits/);
  });
});
