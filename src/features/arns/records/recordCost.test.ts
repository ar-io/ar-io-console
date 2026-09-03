import { describe, expect, it } from 'vitest';

import { recordCostNote, recordSaveCost } from './recordCost';

const base = {
  actionPrice: 0.1714,
  metadataPrice: 0.1714,
  changesRecord: true,
  changesMetadata: false,
  creditBalance: 10,
  billed: true,
};

describe('recordSaveCost', () => {
  it('bills one action for a target-only change', () => {
    const c = recordSaveCost(base);
    expect(c.credits).toBeCloseTo(0.1714);
    expect(c.twoActions).toBe(false);
  });

  it('bills BOTH when a save touches the record and its metadata', () => {
    // The editor is one form but the wire is two actions, so this save costs
    // twice and prompts twice — invisible unless we say so.
    const c = recordSaveCost({ ...base, changesMetadata: true });
    expect(c.credits).toBeCloseTo(0.3428);
    expect(c.twoActions).toBe(true);
  });

  it('charges nothing for a controller, who pays the network instead', () => {
    const c = recordSaveCost({ ...base, billed: false, changesMetadata: true });
    expect(c.credits).toBeUndefined();
    expect(c.insufficient).toBe(false);
  });

  it('flags a known shortfall', () => {
    expect(recordSaveCost({ ...base, creditBalance: 0.01 }).insufficient).toBe(
      true,
    );
  });

  it('never blocks on an UNKNOWN balance', () => {
    // Telling a funded user they cannot afford something is the same failure as
    // the SOL gate that once told people with money to go buy more.
    expect(
      recordSaveCost({ ...base, creditBalance: undefined }).insufficient,
    ).toBe(false);
  });

  it('never blocks on an unknown price, and reports no total', () => {
    const c = recordSaveCost({ ...base, actionPrice: undefined });
    expect(c.credits).toBeUndefined();
    expect(c.insufficient).toBe(false);
  });

  it('reports no total when only HALF a two-part save is priced', () => {
    // A partial sum is worse than none: it renders as authoritative.
    const c = recordSaveCost({
      ...base,
      changesMetadata: true,
      metadataPrice: undefined,
    });
    expect(c.credits).toBeUndefined();
  });

  it('handles a genuinely free network', () => {
    const c = recordSaveCost({ ...base, actionPrice: 0 });
    expect(c.credits).toBe(0);
    expect(c.insufficient).toBe(false);
  });
});

describe('recordCostNote', () => {
  it('warns about the double approval when both halves change', () => {
    const note = recordCostNote({
      credits: 0.3428,
      twoActions: true,
      insufficient: false,
    })!;
    expect(note).toMatch(/approve twice/i);
    expect(note).toContain('0.3428');
  });

  it('states a single cost plainly', () => {
    const note = recordCostNote({
      credits: 0.1714,
      twoActions: false,
      insufficient: false,
    })!;
    expect(note).toContain('0.1714');
    expect(note).not.toMatch(/twice/i);
  });

  it('says free only when it really is', () => {
    expect(
      recordCostNote({ credits: 0, twoActions: false, insufficient: false }),
    ).toMatch(/free on this network/i);
  });

  it('says nothing rather than guessing when the price is unknown', () => {
    expect(
      recordCostNote({
        credits: undefined,
        twoActions: false,
        insufficient: false,
      }),
    ).toBeUndefined();
  });
});
