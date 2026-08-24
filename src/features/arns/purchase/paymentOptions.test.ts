import { describe, expect, it } from 'vitest';

import { isTokenSelectable } from '../../../constants';
import { buildPaymentOptions, defaultPaymentOption } from './paymentOptions';

// The real predicate, not a permissive stub — it withdraws polygon-usdc and
// base-ario, and a test that stubs it past that asserts a UI we never render.
const base = { credits: 0, isTokenSelectable } as const;
const ids = (o: ReturnType<typeof buildPaymentOptions>) => o.map((x) => x.id);

describe('buildPaymentOptions', () => {
  it('offers card plus only what the wallet can sign', () => {
    // The whole point: a Solana session cannot sign an Ethereum transaction, so
    // ETH/USDC are absent rather than offered and failing later.
    expect(ids(buildPaymentOptions({ ...base, walletType: 'solana' })))
      .toEqual(['card', 'token:solana']);
    expect(ids(buildPaymentOptions({ ...base, walletType: 'ethereum' })))
      .toEqual(['card', 'token:base-usdc', 'token:base-eth', 'token:usdc', 'token:pol', 'token:ethereum']);
  });

  it('puts card first — the only option needing no crypto at all', () => {
    const first = buildPaymentOptions({ ...base, walletType: 'solana' })[0];
    expect(first.kind).toBe('card');
    // Naming the processor is the reassurance a card row exists to give.
    expect(first.detail).toBe('with Stripe');
  });

  it('drops card when the payment service has fiat disabled', () => {
    // The bundler 503s when Stripe is off (normal on testnet); offering Card
    // there would be a dead end.
    const o = buildPaymentOptions({ ...base, walletType: 'solana', cardEnabled: false });
    expect(ids(o)).toEqual(['token:solana']);
  });

  it('offers Balance only when there are credits, and names it Balance', () => {
    expect(ids(buildPaymentOptions({ ...base, walletType: 'solana', credits: 0 })))
      .not.toContain('balance');
    const o = buildPaymentOptions({ ...base, walletType: 'solana', credits: 12.4 });
    expect(ids(o)).toContain('balance');
    expect(o.find((x) => x.id === 'balance')?.label).toBe('Balance');
  });

  it('marks an option insufficient only when it genuinely cannot cover the price', () => {
    const o = buildPaymentOptions({
      ...base, walletType: 'solana', credits: 1, priceInCredits: 5,
      tokenBalances: { solana: 0.1 }, tokenPrices: { solana: 2 },
    });
    expect(o.find((x) => x.id === 'balance')?.sufficient).toBe(false);
    expect(o.find((x) => x.id === 'token:solana')?.sufficient).toBe(false);
  });

  it('treats an UNKNOWN balance or price as usable, not insufficient', () => {
    // Same conflation that made a funded wallet render as empty: not knowing is
    // not the same as not having.
    const o = buildPaymentOptions({ ...base, walletType: 'solana', tokenPrices: { solana: 2 } });
    expect(o.find((x) => x.id === 'token:solana')?.sufficient).toBe(true);
  });

  it('labels tokens by ticker and network, not by internal id', () => {
    const o = buildPaymentOptions({
      ...base, walletType: 'ethereum', tokenBalances: { 'base-usdc': 40 },
    });
    const usdc = o.find((x) => x.id === 'token:base-usdc');
    expect(usdc?.label).toBe('USDC');
    expect(usdc?.detail).toContain('Base');
    expect(usdc?.detail).toContain('40');
  });

  it('never offers a withdrawn token, and distinguishes same-ticker networks', () => {
    const o = buildPaymentOptions({ ...base, walletType: 'ethereum' });
    expect(o.map((x) => x.id)).not.toContain('token:polygon-usdc');
    expect(o.map((x) => x.id)).not.toContain('token:base-ario');
    // Two USDCs remain; identical labels would make an unpickable list.
    const usdcs = o.filter((x) => x.label === 'USDC');
    expect(usdcs).toHaveLength(2);
    expect(new Set(usdcs.map((x) => x.detail)).size).toBe(2);
  });

  it('offers nothing but card when no wallet is connected', () => {
    expect(ids(buildPaymentOptions({ ...base, walletType: null }))).toEqual(['card']);
  });
});

describe('extraTokens', () => {
  it('surfaces ARIO on a Solana wallet, which the wallet set alone omits', () => {
    // ARIO is how ArNS prices names and the only token that settles one in a
    // single transaction — but it is not a credits top-up token, so deriving
    // from the wallet alone drops it entirely.
    const without = buildPaymentOptions({ ...base, walletType: 'solana' });
    expect(without.map((o) => o.id)).not.toContain('token:ario');

    const withArio = buildPaymentOptions({
      ...base, walletType: 'solana', extraTokens: ['ario'],
    });
    expect(withArio.map((o) => o.id)).toEqual(['card', 'token:ario', 'token:solana']);
  });

  it('does not duplicate a token the wallet already offers', () => {
    const o = buildPaymentOptions({
      ...base, walletType: 'solana', extraTokens: ['solana'],
    });
    expect(o.map((o2) => o2.id)).toEqual(['card', 'token:solana']);
  });

  it('never offers an extra token with no wallet to sign it', () => {
    const o = buildPaymentOptions({ ...base, walletType: null, extraTokens: ['ario'] });
    expect(o.map((x) => x.id)).toEqual(['card']);
  });
});

describe('defaultPaymentOption', () => {
  it('prefers an existing balance that covers it — no new spend', () => {
    const o = buildPaymentOptions({
      ...base, walletType: 'solana', credits: 50, priceInCredits: 5,
    });
    expect(defaultPaymentOption(o)?.id).toBe('balance');
  });

  it('skips a balance that cannot cover the purchase', () => {
    const o = buildPaymentOptions({
      ...base, walletType: 'solana', credits: 1, priceInCredits: 5,
    });
    expect(defaultPaymentOption(o)?.id).not.toBe('balance');
  });

  it('falls back to the first option when nothing is sufficient', () => {
    const o = buildPaymentOptions({
      ...base, walletType: 'solana', credits: 1, priceInCredits: 5,
      cardEnabled: false, tokenBalances: { solana: 0 }, tokenPrices: { solana: 2 },
    });
    expect(defaultPaymentOption(o)?.id).toBe('token:solana');
  });

  it('returns undefined when there is nothing at all', () => {
    expect(defaultPaymentOption([])).toBeUndefined();
  });
});
