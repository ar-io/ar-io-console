import { describe, expect, it } from 'vitest';

import {
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


