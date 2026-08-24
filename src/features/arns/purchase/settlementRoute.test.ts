import { describe, expect, it } from 'vitest';

import { isTokenSelectable } from '../../../constants';
import { buildPaymentOptions } from './paymentOptions';
import {
  actionLabel, isTwoStep, resolveSettlementRoute, showsFundingSource,
} from './settlementRoute';

const opts = (walletType: 'solana' | 'ethereum' | 'arweave') =>
  buildPaymentOptions({ walletType, credits: 10, isTokenSelectable });
const byId = (w: Parameters<typeof opts>[0], id: string) =>
  opts(w).find((o) => o.id === id)!;

describe('resolveSettlementRoute', () => {
  it('settles ARIO directly, carrying the chosen funding source', () => {
    // ARIO is the only token the contract prices in — it needs no conversion.
    const r = resolveSettlementRoute(
      { kind: 'token', id: 'token:ario', label: 'ARIO', token: 'ario', sufficient: true },
      'stakes',
    );
    expect(r).toEqual({ kind: 'ario', fundFrom: 'stakes' });
  });

  it('routes every non-ARIO token through a credits top-up', () => {
    // SOL cannot pay the contract, so it buys credits first. Pretending
    // otherwise is what would strand a user mid-purchase.
    expect(resolveSettlementRoute(byId('solana', 'token:solana'), 'balance'))
      .toEqual({ kind: 'topup', token: 'solana' });
    expect(resolveSettlementRoute(byId('ethereum', 'token:base-usdc'), 'balance'))
      .toEqual({ kind: 'topup', token: 'base-usdc' });
  });

  it('maps Balance to credits and Card to the fiat quote', () => {
    expect(resolveSettlementRoute(byId('solana', 'balance'), 'balance')).toEqual({ kind: 'credits' });
    expect(resolveSettlementRoute(byId('solana', 'card'), 'balance')).toEqual({ kind: 'card' });
  });

  it('ignores the funding source for every route but ARIO', () => {
    // Leaking 'stakes' into a card payment would be meaningless at best.
    for (const id of ['card', 'balance', 'token:solana']) {
      const r = resolveSettlementRoute(byId('solana', id), 'stakes');
      expect(r).not.toHaveProperty('fundFrom');
    }
  });
});

describe('route affordances', () => {
  it('flags exactly the two-step routes', () => {
    expect(isTwoStep({ kind: 'topup', token: 'solana' })).toBe(true);
    expect(isTwoStep({ kind: 'credits' })).toBe(false);
    expect(isTwoStep({ kind: 'card' })).toBe(false);
    expect(isTwoStep({ kind: 'ario', fundFrom: 'balance' })).toBe(false);
  });

  it('shows the funding-source picker only when ARIO pays', () => {
    expect(showsFundingSource({ kind: 'ario', fundFrom: 'any' })).toBe(true);
    expect(showsFundingSource({ kind: 'credits' })).toBe(false);
    expect(showsFundingSource({ kind: 'card' })).toBe(false);
    expect(showsFundingSource({ kind: 'topup', token: 'solana' })).toBe(false);
  });

  it('labels a two-step route with a continuing verb, not a buying one', () => {
    expect(actionLabel({ kind: 'topup', token: 'solana' })).toBe('Continue');
    expect(actionLabel({ kind: 'credits' })).toBe('Register name');
    expect(actionLabel({ kind: 'card' })).toBe('Pay with card');
  });
});
