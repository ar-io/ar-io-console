import { describe, expect, it } from 'vitest';

import { mergeCustodialNames, type TurboNameRow } from './mergeCustodialNames';

const owned = [{ name: 'mine', processId: 'p1' }];
const row = (o: Partial<TurboNameRow>): TurboNameRow => ({
  name: 'bought', antId: 'ant-1', custodial: true, ...o,
});

describe('mergeCustodialNames', () => {
  it('adds a Turbo-held name the ACL cannot see', () => {
    // The whole point: a card-bought name is owned by Turbo on-chain, so it is
    // absent from "your names" and the buyer cannot find what they paid for.
    const out = mergeCustodialNames(owned, [row({})]);
    expect(out.map((n) => n.name)).toEqual(['mine', 'bought']);
    expect(out[1]).toMatchObject({ custodial: true, processId: 'ant-1' });
  });

  it('ignores non-custodial rows', () => {
    // Those are self-custodied (already in the ACL — merging duplicates them)
    // or transferred out, where the ACL is authoritative.
    expect(mergeCustodialNames(owned, [row({ custodial: false })])).toEqual(owned);
  });

  it('never duplicates a name the ACL already lists, regardless of case', () => {
    const out = mergeCustodialNames(owned, [row({ name: 'MINE' })]);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(owned[0]);
  });

  it('lets the on-chain entry win a collision', () => {
    const out = mergeCustodialNames(owned, [row({ name: 'mine', antId: 'other' })]);
    expect(out[0]).toMatchObject({ processId: 'p1' });
  });

  it('de-duplicates repeated rows for one name', () => {
    // The endpoint is receipt history — one name can have several receipts.
    const out = mergeCustodialNames(owned, [row({}), row({ antId: 'ant-2' })]);
    expect(out.filter((n) => n.name === 'bought')).toHaveLength(1);
  });

  it('keeps an empty antId rather than dropping the name', () => {
    // Turbo returns '' when no receipt carried one. The name is still real and
    // still theirs — hiding it would be the bug this function exists to fix.
    const out = mergeCustodialNames(owned, [row({ antId: '' })]);
    expect(out.map((n) => n.name)).toContain('bought');
  });

  it('returns the original array when there is nothing to add', () => {
    expect(mergeCustodialNames(owned, [])).toBe(owned);
    expect(mergeCustodialNames(owned, undefined)).toBe(owned);
  });
});
