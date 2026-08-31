import { describe, expect, it } from 'vitest';

import {
  actionCostsCredits,
  isSponsoredAction,
  SPONSORED_ACTIONS,
  SPONSORED_ACTION_FACTS,
  UNSPONSORED_OPERATIONS,
} from './sponsorship';

describe('sponsored action catalogue', () => {
  it('tracks the SDK list, so it cannot drift from the bundler', () => {
    expect(SPONSORED_ACTIONS).toHaveLength(9);
    expect(isSponsoredAction('buy-name')).toBe(true);
  });

  it('excludes the four operations that still cost the user SOL', () => {
    // Verified against the live testnet registry: each answers
    // `Unknown ArNS action` and stays on the direct-signer path.
    for (const operation of UNSPONSORED_OPERATIONS) {
      expect(isSponsoredAction(operation)).toBe(false);
    }
    expect(UNSPONSORED_OPERATIONS).toContain('primary-name');
  });

  it('has facts for every action the SDK exposes', () => {
    for (const action of SPONSORED_ACTIONS) {
      expect(SPONSORED_ACTION_FACTS[action]).toBeDefined();
    }
  });

  it('charges credits for exactly the four purchase actions', () => {
    expect(SPONSORED_ACTIONS.filter(actionCostsCredits)).toEqual([
      'buy-name',
      'extend-lease',
      'upgrade-name',
      'increase-undername-limit',
    ]);
  });

  it('requires an owner proof for both record actions, grant or no grant', () => {
    const proofed = SPONSORED_ACTIONS.filter(
      (a) => SPONSORED_ACTION_FACTS[a].requiresOwnerProof,
    );
    expect(proofed).toEqual(['set-record', 'remove-record']);
  });

  it('marks record writes conditional, because the grant is revocable', () => {
    expect(SPONSORED_ACTION_FACTS['set-record'].expectedPrompt).toBe(
      'conditional',
    );
    // buy-name is the one action that always prompts — and that single
    // signature also installs Turbo as controller.
    expect(SPONSORED_ACTION_FACTS['buy-name'].expectedPrompt).toBe(
      'transaction',
    );
  });

  it('promises no prompt for the three registry payments', () => {
    for (const action of [
      'extend-lease',
      'upgrade-name',
      'increase-undername-limit',
    ] as const) {
      expect(SPONSORED_ACTION_FACTS[action].expectedPrompt).toBe('none');
    }
  });
});
