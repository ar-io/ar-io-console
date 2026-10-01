import { describe, expect, it } from 'vitest';

import { heldLabel } from './heldLabel';

const balances = {
  liquidArio: 119_430,
  stakedArio: 5_000,
  totalArio: 124_430,
  sol: 0.2512,
  credits: 3.11,
};
const base = { signedIn: true, loading: false, balances };

describe('heldLabel', () => {
  it('names both tokens the ARIO route spends, from the chosen source', () => {
    expect(heldLabel({ ...base, route: { kind: 'ario', fundFrom: 'balance' } })).toBe(
      '119.43K ARIO · 0.2512 SOL',
    );
    expect(heldLabel({ ...base, route: { kind: 'ario', fundFrom: 'any' } })).toBe(
      '124.43K ARIO · 0.2512 SOL',
    );
    expect(heldLabel({ ...base, route: { kind: 'ario', fundFrom: 'stakes' } })).toBe(
      '5,000 ARIO · 0.2512 SOL',
    );
  });

  it('says an unread SOL balance is unknown, never zero', () => {
    expect(
      heldLabel({
        ...base,
        balances: { ...balances, sol: undefined },
        route: { kind: 'ario', fundFrom: 'balance' },
      }),
    ).toBe('119.43K ARIO · SOL unavailable');
  });

  it('states credits, and the token a top-up spends', () => {
    expect(heldLabel({ ...base, route: { kind: 'credits' } })).toBe('3.11 credits');
    expect(
      heldLabel({
        ...base,
        route: { kind: 'topup', token: 'base-usdc' },
        token: { held: 12.5, label: 'USDC' },
      }),
    ).toBe('12.5 USDC');
    expect(
      heldLabel({
        ...base,
        route: { kind: 'topup', token: 'base-usdc' },
        token: { held: undefined, label: 'USDC' },
      }),
    ).toBe('USDC unavailable');
  });

  it('shows nothing for a card, a visitor, or a top-up with no token', () => {
    expect(heldLabel({ ...base, route: { kind: 'card' } })).toBeUndefined();
    expect(
      heldLabel({ ...base, signedIn: false, route: { kind: 'credits' } }),
    ).toBeUndefined();
    expect(heldLabel({ ...base, route: { kind: 'topup', token: 'x' } })).toBeUndefined();
  });

  it('holds its place while balances load', () => {
    expect(heldLabel({ ...base, loading: true, route: { kind: 'credits' } })).toBe('…');
  });
});
