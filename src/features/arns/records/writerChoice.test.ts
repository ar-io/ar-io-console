import { describe, expect, it } from 'vitest';

import { writerCostNote, writerForRole } from './writerChoice';

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
    expect(writerCostNote('sponsored')).toMatch(/needs no SOL/i);
    expect(writerCostNote('self-signed')).toMatch(/pays the Solana fee/i);
    expect(writerCostNote('self-signed')).not.toMatch(/free/i);
  });

  it('says nothing when no write is possible', () => {
    expect(writerCostNote('blocked')).toBeUndefined();
  });
});
