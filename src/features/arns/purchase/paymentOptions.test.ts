import { describe, expect, it } from 'vitest';

import { isTokenSelectable } from '../../../constants';
import { buildPaymentOptions, defaultPaymentOption } from './paymentOptions';
import { availableTokensForWallet } from '../../../utils/walletTokens';

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

  it('puts card first when there is no balance to lead with', () => {
    const first = buildPaymentOptions({ ...base, walletType: 'solana' })[0];
    expect(first.kind).toBe('card');
    // Naming the processor is the reassurance a card row exists to give.
    expect(first.detail).toBe('via Stripe');
  });

  it('names the processor on the Card option, with no custody caveat', () => {
    // Turbo holds nothing now — the name is minted straight to the buyer — so
    // there is no longer a "what you get" difference to disclose here.
    const normal = buildPaymentOptions({ ...base, walletType: 'solana' });
    expect(normal.find((o) => o.kind === 'card')?.detail).toBe(
      'via Stripe',
    );
  });

  it('drops card when the payment service has fiat disabled', () => {
    // The bundler 503s when Stripe is off (normal on testnet); offering Card
    // there would be a dead end.
    const o = buildPaymentOptions({ ...base, walletType: 'solana', cardEnabled: false });
    expect(ids(o)).toEqual(['token:solana']);
  });

  it('leads with Balance when there is one — it is what gets preselected', () => {
    // The eye should land on the already-chosen option, not hunt for it at the
    // end of the row.
    const o = buildPaymentOptions({ ...base, walletType: 'solana', credits: 12.4 });
    expect(o[0].kind).toBe('balance');
    expect(defaultPaymentOption(o)).toBe(o[0]);
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
    // Asserts the documented rule, not a position: something must stay selected
    // so the picker never renders with nothing chosen.
    const o = buildPaymentOptions({
      ...base, walletType: 'solana', credits: 1, priceInCredits: 5,
      cardEnabled: false, tokenBalances: { solana: 0 }, tokenPrices: { solana: 2 },
    });
    expect(o.every((x) => !x.sufficient)).toBe(true);
    expect(defaultPaymentOption(o)).toBe(o[0]);
  });

  it('returns undefined when there is nothing at all', () => {
    expect(defaultPaymentOption([])).toBeUndefined();
  });
});

describe('network-cost blocking', () => {
  const withSol = (solBalance: number | undefined) =>
    buildPaymentOptions({
      ...base, walletType: 'solana', credits: 50, extraTokens: ['ario'],
      networkSolRequired: 0.015, solBalance,
    });

  it('blocks ARIO alone, because only ARIO spends the buyer’s own SOL', () => {
    /*
      Paying in ARIO is the buyer's own `buyRecord` transaction, so their
      wallet covers the Solana rent. Every other route settles in credits and
      Turbo pays that rent — blocking those would stop exactly the buyers
      sponsorship exists to serve, the ones holding no SOL at all.
    */
    const o = withSol(0);
    expect(o.find((x) => x.id === 'token:ario')?.blockedReason).toMatch(
      /network costs/i,
    );
    for (const id of ['balance', 'token:solana']) {
      expect(o.find((x) => x.id === id)?.blockedReason).toBeUndefined();
    }
  });

  it('never blocks the card, whatever the wallet holds', () => {
    const card = withSol(0).find((x) => x.kind === 'card')!;
    expect(card.blockedReason).toBeUndefined();
    expect(card.detail).toBe('via Stripe');
  });

  it('blocks nothing when the SOL balance is UNKNOWN', () => {
    // Blocking on a failed lookup would tell a funded user to buy SOL — a
    // mistake this app has shipped once already.
    for (const o of withSol(undefined)) expect(o.blockedReason).toBeUndefined();
  });

  it('blocks nothing when the wallet covers the rent', () => {
    for (const o of withSol(1)) expect(o.blockedReason).toBeUndefined();
  });

  it('still preselects a usable option, leaving the blocked one aside', () => {
    // Balance leads and is no longer blocked, so it wins outright — the SOL
    // shortfall only ever costs the buyer the ARIO route.
    const o = withSol(0);
    expect(defaultPaymentOption(o)?.kind).toBe('balance');
  });
});

describe('paying with a token', () => {
  it('does not vouch for affordability it was never given a price for', () => {
    /*
      `tokenPrices` is not supplied by the purchase card, so every token option
      reports `sufficient: true`. That is the correct conservative answer here —
      an unknown price must not read as "you cannot afford this" — but it means
      the picker is NOT the thing protecting a SOL-poor wallet on a top-up.
      ArNSPurchaseCard owns that check; this test exists so the next person to
      "tidy up" that gate finds out here rather than in production.
    */
    const o = buildPaymentOptions({
      ...base, walletType: 'solana', credits: 0,
      extraTokens: ['ario'], tokenBalances: { solana: 0 },
    });
    expect(o.find((x) => x.id === 'token:solana')?.sufficient).toBe(true);
  });
});

describe('what a payment card says', () => {
  it('keeps the network on a token, so same-ticker chains stay distinct', () => {
    /*
      `usdc` and `base-usdc` are different tokens on different chains. Dropping
      the network to save width — which shortening the detail line briefly did
      — makes two distinct options read identically.
    */
    const o = buildPaymentOptions({
      ...base, walletType: 'ethereum',
      tokenBalances: { 'base-usdc': 40 },
    });
    const usdc = o.find((x) => x.id === 'token:base-usdc');
    expect(usdc?.detail).toContain('USDC');
    expect(usdc?.detail).toContain('Base');
  });

  it('abbreviates a holding rather than letting it be cut mid-digits', () => {
    // Reported from the picker as "1,505,829.1436 …".
    const o = buildPaymentOptions({
      ...base, walletType: 'solana', extraTokens: ['ario'],
      tokenBalances: { ario: 1_505_829.1436 },
    });
    const ario = o.find((x) => x.id === 'token:ario');
    expect(ario?.detail).toContain('1.51M');
    expect(ario?.detail).not.toContain('1,505,829');
  });

  it('gives every card the same shape: an amount and its unit', () => {
    // Three different grammars across four cards read as four unrelated
    // controls rather than one choice.
    const o = buildPaymentOptions({
      ...base, walletType: 'solana', credits: 2.4862,
    });
    expect(o.find((x) => x.kind === 'balance')?.detail).toBe('2.49 credits');
  });
});

describe('the token menu follows the payer', () => {
  const arns = { ...base, extraTokens: ['ario'] } as const;

  /*
    A token top-up credits WHOEVER SENT THE TOKENS, and the purchase spends the
    session identity's credits. So the menu has to be derived from the session
    wallet: anything else offers a route that funds an account the purchase
    never reads. `availableTokensForWallet` is exactly "what this wallet can
    sign", which makes the two line up by construction.
  */
  it('offers a Solana session SOL, unchanged', () => {
    expect(ids(buildPaymentOptions({ ...arns, walletType: 'solana' })))
      .toEqual(['card', 'token:ario', 'token:solana']);
  });

  it('offers an Ethereum session its own chains, and no SOL', () => {
    const offered = ids(buildPaymentOptions({ ...arns, walletType: 'ethereum' }));
    expect(offered).toContain('token:base-usdc');
    // SOL would be sent by the LINKED wallet and credit that address instead.
    expect(offered).not.toContain('token:solana');
  });

  it('offers an Arweave session AR, and no SOL', () => {
    const offered = ids(buildPaymentOptions({ ...arns, walletType: 'arweave' }));
    expect(offered).toContain('token:arweave');
    expect(offered).not.toContain('token:solana');
  });

  /*
    ARIO is an EXTRA, not a credit top-up: it pays the registry directly
    through @ar.io/sdk and never becomes credits, so it has no payer to
    mismatch and survives on every session.
  */
  it('keeps ARIO on every wallet type', () => {
    for (const w of ['solana', 'ethereum', 'arweave'] as const) {
      expect(ids(buildPaymentOptions({ ...arns, walletType: w }))).toContain(
        'token:ario',
      );
    }
  });

  it('never offers a credit-buying token the wallet cannot sign', () => {
    for (const w of ['solana', 'ethereum', 'arweave'] as const) {
      const signable = new Set([
        ...availableTokensForWallet(w, isTokenSelectable).map((t) => `token:${t}`),
        'token:ario',
        'card',
        'balance',
      ]);
      for (const id of ids(buildPaymentOptions({ ...arns, walletType: w, credits: 9 }))) {
        expect(signable.has(id)).toBe(true);
      }
    }
  });
});

describe('when the payment service is unavailable (x402-only mode)', () => {
  const arns = { ...base, walletType: 'solana', extraTokens: ['ario'] } as const;

  /*
    Card, token top-ups and spending a balance all settle through the payment
    service. In x402-only mode `isPaymentServiceAvailable()` is false by
    definition, so offering them produces a failure at the last step of a flow
    the user has already committed to.
  */
  it('withdraws everything that buys or spends credits', () => {
    const offered = ids(
      buildPaymentOptions({
        ...arns,
        credits: 50,
        creditPurchasesUnavailable: true,
      }),
    );
    expect(offered).not.toContain('card');
    expect(offered).not.toContain('balance');
    expect(offered).not.toContain('token:solana');
  });

  /*
    And why this is not simply "hide ArNS": ARIO pays the registry directly
    through @ar.io/sdk and never touches the payment service, so a name is
    still buyable.
  */
  it('leaves ARIO, which never touches the payment service', () => {
    const offered = ids(
      buildPaymentOptions({ ...arns, creditPurchasesUnavailable: true }),
    );
    expect(offered).toEqual(['token:ario']);
  });

  it('changes nothing when the payment service is up', () => {
    const before = buildPaymentOptions({ ...arns, credits: 50 });
    expect(
      buildPaymentOptions({ ...arns, credits: 50, creditPurchasesUnavailable: false }),
    ).toEqual(before);
    expect(ids(before)).toContain('card');
  });
});
