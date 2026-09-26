import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { isTokenSelectable } from '../../constants';
import {
  buildPaymentOptions,
  defaultPaymentOption,
} from '../arns/purchase/paymentOptions';
import { availableTokensForWallet, type WalletKind } from '../../utils/walletTokens';
import {
  SOLANA_BASE_FEE_LAMPORTS,
  SOLANA_BASE_FEE_SOL,
  SOL_FEE_REASON,
  buildSources,
  creditsShortReason,
  formatSourceAmount,
  groupSources,
  methodForOption,
  paidFromLine,
  preselectNameCheckoutOption,
  preselectSource,
  resolveSourceSelection,
  sourceInputsFromOptions,
  walletForToken,
  type BuildSourcesInput,
} from './paymentSources';

/** The name checkout's sources, built the way `ArNSPurchaseCard` builds them. */
function nameCheckout(
  walletType: WalletKind,
  extra: Omit<BuildSourcesInput, 'tokens'> & {
    credits?: number;
    priceInCredits?: number;
    creditPurchasesUnavailable?: boolean;
    networkSolRequired?: number;
  } = {},
) {
  const {
    credits = 0,
    priceInCredits,
    creditPurchasesUnavailable,
    networkSolRequired,
    ...rest
  } = extra;
  const options = buildPaymentOptions({
    walletType,
    credits,
    priceInCredits,
    extraTokens: ['ario'],
    isTokenSelectable,
    creditPurchasesUnavailable,
    networkSolRequired,
    solBalance: rest.solBalance,
  });
  const sources = buildSources({ tokens: sourceInputsFromOptions(options), ...rest });
  return { options, sources };
}

/** Top Up's sources, built the way `TopUpPanel` builds them. */
function topUp(walletType: WalletKind, extra: Omit<BuildSourcesInput, 'tokens'> = {}) {
  return buildSources({
    tokens: availableTokensForWallet(walletType, isTokenSelectable).map((token) => ({ token })),
    ...extra,
  });
}

const tokens = (s: { token: string }[]) => s.map((x) => x.token);

describe('sources are exactly today\'s (Phase 1)', () => {
  // § 7.3, the two rows that exist before linked-wallet sources: a Solana
  // session, and an Arweave session with no linked wallet.
  it('Solana session, name checkout: ARIO, SOL and USDC on Solana, all from the session wallet', () => {
    const { sources } = nameCheckout('solana');
    expect(tokens(sources)).toEqual(['ario', 'solana', 'solana-usdc']);
    expect(new Set(sources.map((s) => s.wallet))).toEqual(new Set(['solana']));
  });

  it('Arweave session, name checkout: ARIO and AR, as today', () => {
    const { sources } = nameCheckout('arweave');
    expect(tokens(sources)).toEqual(['ario', 'arweave']);
  });

  it('Ethereum session, name checkout: ARIO plus the session wallet\'s EVM tokens', () => {
    const { sources } = nameCheckout('ethereum');
    expect(tokens(sources)).toEqual([
      'ario', 'base-usdc', 'base-eth', 'usdc', 'pol', 'ethereum',
    ]);
  });

  it('name checkout sources are the token options buildPaymentOptions offers, one for one', () => {
    for (const w of ['solana', 'arweave', 'ethereum'] as const) {
      const { options, sources } = nameCheckout(w);
      expect(sources.map((s) => s.id)).toEqual(
        options.filter((o) => o.kind === 'token').map((o) => o.id),
      );
    }
  });

  it('Top Up offers availableTokensForWallet(session), unchanged, and no ARIO', () => {
    for (const w of ['solana', 'arweave', 'ethereum'] as const) {
      expect(tokens(topUp(w))).toEqual(availableTokensForWallet(w, isTokenSelectable));
      expect(tokens(topUp(w))).not.toContain('ario');
    }
  });

  it('no linked-wallet sources on any session (§ 7.5, not linked: hidden)', () => {
    // SOL and USDC on Solana appear only on a Solana session in this phase.
    for (const w of ['arweave', 'ethereum'] as const) {
      expect(tokens(nameCheckout(w).sources)).not.toContain('solana');
      expect(tokens(nameCheckout(w).sources)).not.toContain('solana-usdc');
      expect(tokens(topUp(w))).not.toContain('solana');
      expect(tokens(topUp(w))).not.toContain('solana-usdc');
    }
  });

  it('x402-only mode leaves ARIO alone on the name checkout, and nothing else', () => {
    const { options, sources } = nameCheckout('ethereum', {
      creditPurchasesUnavailable: true,
    });
    expect(tokens(sources)).toEqual(['ario']);
    expect(options.map((o) => o.kind)).toEqual(['token']);
  });

  it('signed out, there are no Top Up sources to show', () => {
    expect(topUp(null)).toEqual([]);
  });
});

describe('walletForToken', () => {
  it('pays ARIO from the Solana wallet, whatever the session', () => {
    expect(walletForToken('ario')).toBe('solana');
    expect(walletForToken('solana-usdc')).toBe('solana');
    expect(walletForToken('arweave')).toBe('arweave');
    for (const t of ['ethereum', 'base-eth', 'usdc', 'base-usdc', 'pol'] as const) {
      expect(walletForToken(t)).toBe('ethereum');
    }
  });
});

describe('groupSources', () => {
  it('names the wallet in the heading, not the chain', () => {
    const groups = groupSources(nameCheckout('solana').sources, 'solana');
    expect(groups.map((g) => g.heading)).toEqual(['From your Solana wallet']);
    expect(tokens(groups[0].sources)).toEqual(['ario', 'solana', 'solana-usdc']);
  });

  it('leads with the session wallet\'s group; ARIO sits under the Solana wallet', () => {
    const groups = groupSources(nameCheckout('arweave').sources, 'arweave');
    expect(groups.map((g) => g.heading)).toEqual([
      'From your Arweave wallet',
      'From your Solana wallet',
    ]);
    expect(tokens(groups[0].sources)).toEqual(['arweave']);
    expect(tokens(groups[1].sources)).toEqual(['ario']);
  });

  it('keeps best-first order within the Ethereum group', () => {
    const groups = groupSources(nameCheckout('ethereum').sources, 'ethereum');
    expect(groups[0].heading).toBe('From your Ethereum wallet');
    expect(tokens(groups[0].sources)).toEqual([
      'base-usdc', 'base-eth', 'usdc', 'pol', 'ethereum',
    ]);
  });

  it('says where a source that is not the session\'s is paid from', () => {
    expect(paidFromLine('solana')).toBe('Paid from your Solana wallet');
  });
});

describe('disabled rows', () => {
  it('disables a row the wallet cannot afford, with its reason', () => {
    const { sources } = nameCheckout('solana', {
      balances: { solana: 0.1, 'solana-usdc': 60 },
      prices: { solana: 0.2381, 'solana-usdc': 49.51 },
    });
    expect(sources.find((s) => s.token === 'solana')?.disabledReason).toBe('Not enough SOL');
    expect(sources.find((s) => s.token === 'solana-usdc')?.disabledReason).toBeUndefined();
  });

  it('reads an unknown balance or price as affordable, never as empty', () => {
    const unknownBalance = nameCheckout('solana', { prices: { solana: 5 } }).sources;
    expect(unknownBalance.find((s) => s.token === 'solana')?.disabledReason).toBeUndefined();
    const unknownPrice = nameCheckout('solana', { balances: { solana: 0 } }).sources;
    expect(unknownPrice.find((s) => s.token === 'solana')?.disabledReason).toBeUndefined();
  });

  it('shows no amount while a balance loads, and does not disable on it', () => {
    const { sources } = nameCheckout('solana', {
      balances: { solana: 0 },
      prices: { solana: 1 },
      loadingTokens: ['solana'],
    });
    const sol = sources.find((s) => s.token === 'solana')!;
    expect(sol.balance).toBeUndefined();
    expect(sol.balanceLoading).toBe(true);
    expect(sol.disabledReason).toBeUndefined();
  });

  it('carries ARIO\'s SOL block across from paymentOptions, ahead of any other reason', () => {
    const { sources } = nameCheckout('solana', {
      networkSolRequired: 0.0156,
      solBalance: 0.001,
      balances: { ario: 1 },
      prices: { ario: 500 },
    });
    expect(sources.find((s) => s.token === 'ario')?.disabledReason).toBe(
      'Needs ~0.0156 SOL for network costs',
    );
  });

  // § 7.7 and § 7.9.
  it('disables USDC on Solana when the SOL balance is KNOWN to be below the base fee', () => {
    const short = topUp('solana', { solBalance: 0.000004 });
    expect(short.find((s) => s.token === 'solana-usdc')?.disabledReason).toBe(SOL_FEE_REASON);
    expect(SOL_FEE_REASON).toBe('Needs 0.000005 SOL for the network fee');
  });

  it('keeps USDC on Solana enabled at exactly the fee, and when the SOL balance is unknown', () => {
    expect(
      topUp('solana', { solBalance: 0.000005 }).find((s) => s.token === 'solana-usdc')
        ?.disabledReason,
    ).toBeUndefined();
    expect(
      topUp('solana').find((s) => s.token === 'solana-usdc')?.disabledReason,
    ).toBeUndefined();
  });

  it('applies the fee rule to USDC on Solana alone', () => {
    const sources = topUp('solana', { solBalance: 0 });
    expect(sources.find((s) => s.token === 'solana')?.disabledReason).toBeUndefined();
  });

  it('says "Not enough USDC" before the fee when both apply', () => {
    const sources = topUp('solana', {
      solBalance: 0,
      balances: { 'solana-usdc': 1 },
      prices: { 'solana-usdc': 5 },
    });
    expect(sources.find((s) => s.token === 'solana-usdc')?.disabledReason).toBe('Not enough USDC');
  });
});

describe('slow tokens', () => {
  it('labels AR with its wait and still offers it', () => {
    const ar = topUp('arweave')[0];
    expect(ar.wait).toBe('about 40 min');
    expect(ar.disabledReason).toBeUndefined();
  });

  it('labels no other token', () => {
    const all = [
      ...nameCheckout('solana').sources,
      ...nameCheckout('ethereum').sources,
    ];
    expect(all.filter((s) => s.wait)).toEqual([]);
  });
});

describe('preselectSource', () => {
  it('name checkout: ARIO when it can be chosen', () => {
    const { sources } = nameCheckout('solana');
    expect(preselectSource(sources, 'name-checkout')?.token).toBe('ario');
  });

  it('name checkout: the fastest source when ARIO cannot be afforded', () => {
    const solana = nameCheckout('solana', {
      balances: { ario: 1 },
      prices: { ario: 500 },
    }).sources;
    expect(preselectSource(solana, 'name-checkout')?.token).toBe('solana-usdc');

    const ethereum = nameCheckout('ethereum', {
      balances: { ario: 0 },
      prices: { ario: 500 },
    }).sources;
    expect(preselectSource(ethereum, 'name-checkout')?.token).toBe('base-usdc');

    const arweave = nameCheckout('arweave', {
      balances: { ario: 0 },
      prices: { ario: 500 },
    }).sources;
    expect(preselectSource(arweave, 'name-checkout')?.token).toBe('arweave');
  });

  it('name checkout: skips a disabled fast source for the next one', () => {
    const { sources } = nameCheckout('solana', {
      balances: { ario: 0, 'solana-usdc': 0, solana: 3 },
      prices: { ario: 500, 'solana-usdc': 50, solana: 0.2 },
    });
    expect(preselectSource(sources, 'name-checkout')?.token).toBe('solana');
  });

  it('never opens on nothing: all disabled falls back to the first row', () => {
    const { sources } = nameCheckout('solana', {
      balances: { ario: 0, 'solana-usdc': 0, solana: 0 },
      prices: { ario: 1, 'solana-usdc': 1, solana: 1 },
    });
    expect(preselectSource(sources, 'name-checkout')?.token).toBe('ario');
    expect(preselectSource([], 'name-checkout')).toBeUndefined();
  });

  it('Top Up: USDC on Solana first when it holds some', () => {
    const sources = topUp('solana', { balances: { 'solana-usdc': 12.4, solana: 1 } });
    expect(preselectSource(sources, 'top-up')?.token).toBe('solana-usdc');
  });

  it('Top Up: SOL when the USDC balance is known to be empty', () => {
    const sources = topUp('solana', { balances: { 'solana-usdc': 0, solana: 1 } });
    expect(preselectSource(sources, 'top-up')?.token).toBe('solana');
  });

  it('Top Up: SOL when USDC cannot pay its network fee', () => {
    const sources = topUp('solana', {
      balances: { 'solana-usdc': 50, solana: 0 },
      solBalance: 0,
    });
    // SOL is empty too, so the session wallet's own first token wins.
    expect(preselectSource(sources, 'top-up')?.token).toBe('solana');
  });

  it('Top Up: USDC on Base for an Ethereum session, today\'s default', () => {
    expect(preselectSource(topUp('ethereum'), 'top-up')?.token).toBe('base-usdc');
    expect(preselectSource(topUp('ethereum'), 'top-up')?.token).toBe(
      availableTokensForWallet('ethereum', isTokenSelectable)[0],
    );
  });

  it('Top Up: ETH on Base when Base USDC is known to be empty', () => {
    const sources = topUp('ethereum', { balances: { 'base-usdc': 0 } });
    expect(preselectSource(sources, 'top-up')?.token).toBe('base-eth');
  });

  it('Top Up: the session wallet\'s own token when no fast chain applies', () => {
    expect(preselectSource(topUp('arweave'), 'top-up')?.token).toBe('arweave');
  });
});

describe('resolveSourceSelection', () => {
  const { sources } = nameCheckout('solana');

  it('keeps a selection while it is still offered', () => {
    expect(resolveSourceSelection(sources, 'token:solana', 'name-checkout')?.token).toBe('solana');
  });

  it('keeps it even when a late balance disables it', () => {
    const later = nameCheckout('solana', {
      balances: { solana: 0 },
      prices: { solana: 1 },
    }).sources;
    const kept = resolveSourceSelection(later, 'token:solana', 'name-checkout');
    expect(kept?.token).toBe('solana');
    expect(kept?.disabledReason).toBe('Not enough SOL');
  });

  it('falls back to the preselection only when the selection is gone', () => {
    // A Solana-session choice that an Ethereum session does not offer.
    const eth = nameCheckout('ethereum').sources;
    expect(resolveSourceSelection(eth, 'token:solana', 'name-checkout')?.token).toBe('ario');
    expect(resolveSourceSelection(eth, undefined, 'name-checkout')?.token).toBe('ario');
  });
});

describe('preselectNameCheckoutOption', () => {
  const pick = (args: Parameters<typeof nameCheckout>[1] & { walletType?: WalletKind }) => {
    const { walletType = 'solana', ...rest } = args;
    const { options, sources } = nameCheckout(walletType, rest);
    return preselectNameCheckoutOption({
      options,
      sources,
      fallback: defaultPaymentOption(options),
    });
  };

  it('picks ARIO when a known balance covers a known price', () => {
    expect(pick({ balances: { ario: 30_000 }, prices: { ario: 20_715 } })).toBe('token:ario');
  });

  it('falls back to today\'s default (the card) when ARIO is short', () => {
    expect(pick({ balances: { ario: 1 }, prices: { ario: 20_715 } })).toBe('card');
  });

  it('does not preselect ARIO on an unknown balance or price', () => {
    expect(pick({ prices: { ario: 20_715 } })).toBe('card');
    expect(pick({ balances: { ario: 30_000 } })).toBe('card');
  });

  it('does not preselect ARIO when it is blocked on SOL for network costs', () => {
    expect(
      pick({
        balances: { ario: 30_000 },
        prices: { ario: 20_715 },
        networkSolRequired: 0.0156,
        solBalance: 0,
      }),
    ).toBe('card');
  });

  it('prefers credits that cover the price, since nothing new is spent', () => {
    expect(
      pick({
        credits: 10,
        priceInCredits: 6.61,
        balances: { ario: 30_000 },
        prices: { ario: 20_715 },
      }),
    ).toBe('balance');
  });

  it('passes over credits that fall short', () => {
    expect(
      pick({
        credits: 2.45,
        priceInCredits: 6.61,
        balances: { ario: 30_000 },
        prices: { ario: 20_715 },
      }),
    ).toBe('token:ario');
    expect(pick({ credits: 2.45, priceInCredits: 6.61 })).toBe('card');
  });

  it('works on every session type, since ARIO is offered on each', () => {
    for (const walletType of ['arweave', 'ethereum'] as const) {
      expect(
        pick({ walletType, balances: { ario: 30_000 }, prices: { ario: 20_715 } }),
      ).toBe('token:ario');
    }
  });

  it('in x402-only mode ARIO is the only option, and is chosen', () => {
    expect(pick({ creditPurchasesUnavailable: true })).toBe('token:ario');
  });
});

describe('methodForOption', () => {
  it('maps each option kind to one of the three choices', () => {
    expect(methodForOption({ kind: 'balance' })).toBe('credits');
    expect(methodForOption({ kind: 'card' })).toBe('card');
    expect(methodForOption({ kind: 'token' })).toBe('crypto');
  });
});

describe('copy and formatting', () => {
  it('states the credit shortfall, not the price', () => {
    expect(creditsShortReason(2.45, 9.06)).toBe('Not enough, need 6.61');
    expect(creditsShortReason(10, 9)).toBe('Not enough, need 0');
  });

  it('keeps small amounts readable and large ones short', () => {
    expect(formatSourceAmount(0.0015234)).toBe('0.001523');
    expect(formatSourceAmount(0.2381)).toBe('0.2381');
    expect(formatSourceAmount(20_715.456)).toBe('20,715.46');
    expect(formatSourceAmount(0)).toBe('0');
    expect(formatSourceAmount(Number.NaN)).toBe('0');
  });
});

/*
  § 7.9: the fee threshold is taken from how turbo-sdk builds the transfer, so
  pin it to that. The SDK adds no compute-budget (priority fee) instruction, so
  the transfer costs exactly one base signature fee. If a later SDK adds one,
  this fails and the threshold has to be re-derived rather than drifting.
*/
describe('the USDC-on-Solana fee threshold', () => {
  it('is the base signature fee, 5,000 lamports', () => {
    expect(SOLANA_BASE_FEE_LAMPORTS).toBe(5_000);
    expect(SOLANA_BASE_FEE_SOL).toBe(0.000005);
  });

  it('matches the SDK\'s transfer shape: no priority fee, idempotent token account', () => {
    const spl = readFileSync(
      path.resolve(
        __dirname,
        '../../../node_modules/@ardrive/turbo-sdk/lib/esm/common/token/spl.js',
      ),
      'utf8',
    );
    expect(spl).not.toMatch(/ComputeBudget|setComputeUnitPrice|computeUnitPrice/i);
    expect(spl).toMatch(/createAssociatedTokenAccountIdempotentInstruction/);
    expect(spl).toMatch(/createTransferCheckedInstruction/);
  });
});
