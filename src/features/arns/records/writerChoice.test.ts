import { describe, expect, it } from 'vitest';

import {
  chooseWriter,
  writerCostNote,
  writerForRole,
  MIN_SOL_FOR_RECORD_WRITE as MIN_SOL,
} from './writerChoice';

describe('writerForRole', () => {
  it('sponsors the owner — Turbo pays their Solana fee', () => {
    expect(writerForRole('owner')).toBe('sponsored');
  });

  it('makes a controller sign for themselves', () => {
    // Turbo verifies the owner proof against the CURRENT on-chain owner, so a
    // controller's signature is rejected. They keep the capability and pay for
    // it — collapsing this into the sponsored path silently removed it.
    expect(writerForRole('controller')).toBe('self-signed');
  });

  it('blocks rather than guessing while the role is unknown', () => {
    // Guessing sponsored for a controller spends a wallet prompt on a request
    // that will 401; guessing self-signed for an owner charges a fee they do
    // not owe. Both wrong guesses cost the user something real.
    expect(writerForRole('unknown')).toBe('blocked');
  });

  it('blocks a wallet with no relationship to the name', () => {
    expect(writerForRole('none')).toBe('blocked');
  });
});

describe('writerCostNote', () => {
  it('promises no SOL only where that is true', () => {
    expect(writerCostNote('sponsored', 0.17)).toMatch(/needs no SOL/i);
    expect(writerCostNote('self-signed')).toMatch(/pays the Solana fee/i);
    expect(writerCostNote('self-signed')).not.toMatch(/free/i);
  });

  it('quotes the fetched price rather than a hardcoded one', () => {
    // Prices differ by network — a record write is 0.1699 credits on testnet
    // and 0.1714 on production — so anything baked in would be wrong for real
    // users while looking right in development.
    expect(writerCostNote('sponsored', 0.1714)).toContain('0.1714');
    expect(writerCostNote('sponsored', 0.1699)).toContain('0.1699');
  });

  it('never says "free" while the price is still unknown', () => {
    /*
      The whole point of this line is that nobody meets a charge they were not
      told about. An unloaded price must therefore degrade to "costs a small
      amount", never to silence and never to "free" — these actions carry a
      margin now, and the SDK's own docs still wrongly call them free.
    */
    const note = writerCostNote('sponsored', undefined)!;
    expect(note).not.toMatch(/free/i);
    expect(note).toMatch(/small amount of credits/i);
  });

  it('says free only when the price is genuinely zero', () => {
    // Several actions really are 0 on testnet, so this must stay expressible.
    expect(writerCostNote('sponsored', 0)).toMatch(/free on this network/i);
  });

  it('says nothing when no write is possible', () => {
    expect(writerCostNote('blocked')).toBeUndefined();
    expect(writerCostNote('blocked', 0.17)).toBeUndefined();
  });
});

describe('what an unresolved role means, per surface', () => {
  /*
    `writerForRole` returns 'blocked' for unknown, and the records editor
    honours that — a person is watching and the summary resolves in a moment.

    The deploy/capture/publish path deliberately does NOT block on it: that
    code runs with nobody able to "try again in a moment", and failing a deploy
    is worse than an owner occasionally paying a fee they could have avoided.
    It falls back to signing, which is what it did before sponsorship existed.
    This test records that the divergence is a decision, not an oversight.
  */
  it('reports unknown as blocked, leaving the policy to the caller', () => {
    expect(writerForRole('unknown')).toBe('blocked');
    expect(writerForRole('none')).toBe('blocked');
  });

  it('only ever names ONE role as sponsored', () => {
    // Turbo verifies the owner proof against the current on-chain owner, so
    // widening this beyond 'owner' produces 401s the user cannot act on.
    const roles = ['owner', 'controller', 'none', 'unknown'] as const;
    expect(roles.filter((r) => writerForRole(r) === 'sponsored')).toEqual([
      'owner',
    ]);
  });
});

describe('chooseWriter — the funds-aware fallback', () => {
  const RICH = { credits: 10, priceCredits: 0.17, sol: 1 };

  it('keeps an owner who can pay on the credits route', () => {
    expect(chooseWriter('owner', RICH)).toEqual({
      kind: 'sponsored',
      reason: 'owner',
    });
  });

  /*
    The dead end this exists for: the action costs a fraction of a cent and the
    minimum top-up is $5, so "go buy credits" is not a real answer.
  */
  it('lets an owner short on credits sign and pay the SOL themselves', () => {
    expect(
      chooseWriter('owner', { credits: 0.01, priceCredits: 0.17, sol: 0.5 }),
    ).toEqual({ kind: 'self-signed', reason: 'insufficient-credits' });
  });

  it('flags the owner who can cover neither, without changing route', () => {
    // Nothing better to route to — but worth saying before they compose a
    // record and meet the failure on save.
    expect(
      chooseWriter('owner', { credits: 0, priceCredits: 0.17, sol: 0 }),
    ).toEqual({ kind: 'sponsored', reason: 'insufficient-both' });
  });

  it('warns up front instead of failing on save', () => {
    const note = writerCostNote('sponsored', 0.17, 'insufficient-both')!;
    expect(note).toMatch(/more than you have/i);
    expect(note).toMatch(/add credits/i);
    // The other way out, since a $5 top-up for this is absurd.
    expect(note).toMatch(/sol/i);
  });

  it('warns even before the price has loaded', () => {
    const note = writerCostNote('sponsored', undefined, 'insufficient-both')!;
    expect(note).toMatch(/not enough credits/i);
    expect(note).not.toMatch(/undefined/);
  });

  it('leaves the ordinary owner note alone', () => {
    expect(writerCostNote('sponsored', 0.17, 'owner')).toMatch(/needs no SOL/i);
    expect(writerCostNote('sponsored', 0.17, 'owner')).not.toMatch(
      /more than you have/i,
    );
  });

  it('treats dust as not enough SOL', () => {
    expect(
      chooseWriter('owner', {
        credits: 0,
        priceCredits: 0.17,
        sol: MIN_SOL / 2,
      }).kind,
    ).toBe('sponsored');
    expect(
      chooseWriter('owner', { credits: 0, priceCredits: 0.17, sol: MIN_SOL })
        .kind,
    ).toBe('self-signed');
  });

  /*
    Balances and prices load asynchronously. Treating "not yet" as "can't
    afford it" would swap the route, and the cost sentence with it, under a
    user who is already reading it.
  */
  it('never reroutes on a figure that has not loaded', () => {
    for (const funds of [
      { credits: undefined, priceCredits: 0.17, sol: 1 },
      { credits: 0, priceCredits: undefined, sol: 1 },
      { credits: 0, priceCredits: 0.17, sol: undefined },
      undefined,
    ]) {
      expect(chooseWriter('owner', funds).kind).toBe('sponsored');
    }
  });

  it('does not reroute when credits exactly cover the price', () => {
    expect(
      chooseWriter('owner', { credits: 0.17, priceCredits: 0.17, sol: 1 }).kind,
    ).toBe('sponsored');
  });

  it('leaves a controller self-signing however rich they are', () => {
    // Turbo will not take their signature, so credits cannot help them.
    expect(chooseWriter('controller', RICH)).toEqual({
      kind: 'self-signed',
      reason: 'controller',
    });
  });

  it('still blocks an unresolved role regardless of funds', () => {
    expect(chooseWriter('unknown', RICH).kind).toBe('blocked');
    expect(chooseWriter('none', RICH).kind).toBe('blocked');
  });

  it('keeps writerForRole on the role-only behaviour its callers expect', () => {
    expect(writerForRole('owner')).toBe('sponsored');
    expect(writerForRole('controller')).toBe('self-signed');
  });
});

describe('writerCostNote — the two people who self-sign', () => {
  /*
    An owner reroutes here by running out of credits. Telling them they do not
    own the name is wrong, and alarming in a way that reads as a bug.
  */
  it('does not tell a rerouted OWNER they do not own the name', () => {
    const note = writerCostNote('self-signed', undefined, 'insufficient-credits')!;
    expect(note).not.toMatch(/don.t own/i);
    expect(note).toMatch(/not enough credits/i);
    expect(note).toMatch(/solana fee/i);
  });

  it('still explains the controller case in its own terms', () => {
    const note = writerCostNote('self-signed', undefined, 'controller')!;
    expect(note).toMatch(/don.t own/i);
  });

  it('never quotes credits to anyone who is paying the network', () => {
    for (const reason of ['controller', 'insufficient-credits'] as const) {
      expect(writerCostNote('self-signed', 0.1685, reason)).not.toContain(
        '0.1685',
      );
    }
  });
});
