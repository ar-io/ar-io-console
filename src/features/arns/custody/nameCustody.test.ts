import { describe, expect, it } from 'vitest';

import {
  actionAvailability, custodyFromTurboName, isActionAvailable,
  type ArNSAction, type NameCustody,
} from './nameCustody';

const ANT_OPS: ArNSAction[] = [
  'set-record', 'remove-record', 'transfer', 'controllers', 'details',
  'release', 'primary-name',
];
const REGISTRY_OPS: ArNSAction[] = ['extend', 'upgrade', 'increase-undernames'];

describe('actionAvailability', () => {
  it('never blocks a registry payment on custody', () => {
    // Extending a lease pays the ARIO registry; it is not an ANT mutation, so
    // anyone can do it for any name regardless of who holds the ANT.
    for (const custody of ['user-owned', 'turbo-custodial', 'unknown'] as NameCustody[]) {
      for (const op of REGISTRY_OPS) {
        expect(actionAvailability(op, custody)).toEqual({ kind: 'signer' });
      }
    }
  });

  it('routes the three custodial ANT ops through Turbo', () => {
    for (const op of ['set-record', 'remove-record', 'transfer'] as ArNSAction[]) {
      expect(actionAvailability(op, 'turbo-custodial')).toEqual({ kind: 'turbo' });
    }
  });

  it('marks the rest impossible while Turbo holds the ANT, with a way out', () => {
    // These need the ANT owner's signature and Turbo exposes no route for
    // them — genuinely impossible, not merely unimplemented. The reason has to
    // name the remedy or the user is just stuck.
    for (const op of ['controllers', 'details', 'release', 'primary-name'] as ArNSAction[]) {
      const a = actionAvailability(op, 'turbo-custodial');
      expect(a.kind).toBe('unavailable');
      expect(a).toHaveProperty('reason', expect.stringMatching(/transfer/i));
    }
  });

  it('lets a user-owned name do everything with its own signer', () => {
    for (const op of [...ANT_OPS, ...REGISTRY_OPS]) {
      expect(actionAvailability(op, 'user-owned')).toEqual({ kind: 'signer' });
    }
  });

  it('treats unknown custody as user-owned, never as blocked', () => {
    // Asymmetric: wrongly offering a control shows an error the user can act
    // on; wrongly hiding one on a name they own looks like a broken app.
    for (const op of [...ANT_OPS, ...REGISTRY_OPS]) {
      expect(isActionAvailable(op, 'unknown')).toBe(true);
    }
  });
});

describe('custodyFromTurboName', () => {
  it('reads the flag when there is a row', () => {
    expect(custodyFromTurboName({ custodial: true })).toBe('turbo-custodial');
    expect(custodyFromTurboName({ custodial: false })).toBe('user-owned');
  });

  it('returns unknown for a missing row, not user-owned', () => {
    // The endpoint lists names PURCHASED through Turbo. A name bought anywhere
    // else is simply absent, which says nothing about its custody.
    expect(custodyFromTurboName(undefined)).toBe('unknown');
  });

  it('treats a row with no flag as not-custodial rather than throwing', () => {
    expect(custodyFromTurboName({})).toBe('user-owned');
  });
});
