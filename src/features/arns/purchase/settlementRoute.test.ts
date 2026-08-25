import { describe, expect, it } from 'vitest';

import { isTokenSelectable } from '../../../constants';
import { buildPaymentOptions } from './paymentOptions';
import {
  actionLabel, cardFlavor, isTwoStep, resolveSettlementRoute, showsFundingSource,
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

describe('cardFlavor', () => {
  it('self-custodies when the wallet can sign and cover gas', () => {
    expect(cardFlavor({ hasSolanaSigner: true, solCoversGas: true }))
      .toBe('self-custody');
  });

  it('goes custodial with no Solana signer — the only path that can work', () => {
    // An Arweave or Ethereum session with no linked Solana wallet cannot
    // perform the on-chain write at all; today it can't buy a name.
    expect(cardFlavor({ hasSolanaSigner: false, solCoversGas: true }))
      .toBe('custodial');
    expect(cardFlavor({ hasSolanaSigner: false, solCoversGas: undefined }))
      .toBe('custodial');
  });

  it('goes custodial when the wallet is known to be short on gas', () => {
    expect(cardFlavor({ hasSolanaSigner: true, solCoversGas: false }))
      .toBe('custodial');
  });

  it('treats an UNKNOWN balance as self-custody, not custodial', () => {
    // The asymmetry is the whole point: an underfunded self-custody attempt
    // fails before charging, while a custodial buy spends money and gives the
    // ANT away. Never guess in the direction you can't undo.
    expect(cardFlavor({ hasSolanaSigner: true, solCoversGas: undefined }))
      .toBe('self-custody');
  });
});
