import { describe, expect, it } from 'vitest';

import {
  needsClientSpawn,
  settlementMechanismFor,
} from './settlementMechanism';
import type { SettlementRoute } from './settlementRoute';

const ario = (fundFrom: 'balance' | 'stakes' | 'any'): SettlementRoute => ({
  kind: 'ario',
  fundFrom,
});

describe('settlementMechanismFor', () => {
  it('settles ARIO through the ARIO SDK, carrying the funding source', () => {
    for (const f of ['balance', 'stakes', 'any'] as const) {
      expect(settlementMechanismFor(ario(f))).toEqual({
        kind: 'ario-direct',
        fundFrom: f,
      });
    }
  });

  it('settles a credits purchase through TURBO, never the ARIO SDK', () => {
    // The defect this file exists to prevent: `@ar.io/sdk` accepts
    // `fundFrom: 'turbo'` and ignores it, spending the wallet's ARIO instead.
    // Credits are debited only by turbo-sdk's purchase family.
    expect(settlementMechanismFor({ kind: 'credits' })).toEqual({
      kind: 'turbo-credits',
    });
  });

  it('settles a token top-up through Turbo too — the token became credits', () => {
    // Paying with SOL previously bought credits AND then charged ARIO, because
    // the purchase still went through the ARIO SDK.
    expect(settlementMechanismFor({ kind: 'topup', token: 'solana' })).toEqual({
      kind: 'turbo-credits',
    });
  });

  it('separates the two card paths, which settle differently', () => {
    const card: SettlementRoute = { kind: 'card' };
    // Self-custody card buys credits, so it lands on the credits mechanism.
    expect(settlementMechanismFor(card, false)).toEqual({ kind: 'turbo-credits' });
    // Custodial card is settled by Turbo against the fiat charge.
    expect(settlementMechanismFor(card, true)).toEqual({ kind: 'turbo-fiat' });
  });

  it('never emits a fundFrom outside what the ARIO SDK acts on', () => {
    // 'turbo' is accepted by the SDK's types and ignored by its code, so it
    // must never leave this module.
    const routes: SettlementRoute[] = [
      ario('balance'), ario('stakes'), ario('any'),
      { kind: 'credits' }, { kind: 'topup', token: 'solana' }, { kind: 'card' },
    ];
    for (const r of routes) {
      const m = settlementMechanismFor(r);
      if (m.kind === 'ario-direct') {
        expect(['balance', 'stakes', 'any']).toContain(m.fundFrom);
      } else {
        expect(m).not.toHaveProperty('fundFrom');
      }
    }
  });
});

describe('needsClientSpawn', () => {
  it('requires a spawned ANT for a credits PURCHASE', () => {
    // turbo-sdk provisions a TURBO-OWNED ANT when no processId is supplied.
    // Correct for a custodial card, wrong for credits — where the buyer is
    // meant to own the name outright.
    expect(needsClientSpawn({ kind: 'turbo-credits' }, 'Buy-Name')).toBe(true);
    expect(needsClientSpawn({ kind: 'turbo-credits' }, 'Buy-Record')).toBe(true);
  });

  it('does not spawn for actions on a name that already exists', () => {
    for (const intent of ['Extend-Lease', 'Upgrade-Name', 'Increase-Undername-Limit']) {
      expect(needsClientSpawn({ kind: 'turbo-credits' }, intent)).toBe(false);
    }
  });

  it('never spawns for ARIO or fiat', () => {
    // ARIO's buyRecord mints atomically; the custodial card is Turbo's to spawn.
    expect(needsClientSpawn({ kind: 'ario-direct', fundFrom: 'balance' }, 'Buy-Name')).toBe(false);
    expect(needsClientSpawn({ kind: 'turbo-fiat' }, 'Buy-Name')).toBe(false);
  });
});
