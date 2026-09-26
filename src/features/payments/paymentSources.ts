import type { SupportedTokenType } from '../../constants';
import type { PaymentOption } from '../arns/purchase/paymentOptions';
import { TOKEN_LABEL, TOKEN_NETWORK } from '../arns/purchase/paymentOptions';
import type { WalletKind } from '../../utils/walletTokens';

/**
 * Payment sources: the (wallet, token) pairs a user can pay with, and the
 * decisions the picker makes about them.
 *
 * The picker offers three choices, Credits, Card and Crypto, and Crypto is one
 * dropdown of sources grouped by the wallet that pays (SPEC-payment-sources
 * § 7.1, § 7.2). This module is the pure half of that: which rows exist, how
 * they group, which are disabled and why, and which one is preselected. The
 * components only draw what it returns.
 *
 * Phase 1 changes the picker and nothing else, so the sources here are exactly
 * today's: `availableTokensForWallet(session)` on Top Up, and the token options
 * `buildPaymentOptions` already produces on the name checkout. Nothing in this
 * file decides how a payment is routed, priced or settled. Phase 2 adds the
 * linked wallet's sources here rather than rewriting it.
 */

export type PaymentMethod = 'credits' | 'card' | 'crypto';
export type SourceWallet = 'arweave' | 'ethereum' | 'solana';
export type PaymentSurface = 'name-checkout' | 'top-up';

const WALLET_NAME: Record<SourceWallet, string> = {
  arweave: 'Arweave',
  ethereum: 'Ethereum',
  solana: 'Solana',
};

/**
 * The wallet a token is paid from.
 *
 * ARIO is a Solana token, so on the name checkout it is paid by the Solana
 * wallet that owns the name. On an Arweave or Ethereum session that is the
 * linked wallet, not the session one, which is why the group heading names the
 * wallet rather than assuming the session's.
 */
export function walletForToken(token: SupportedTokenType): SourceWallet | undefined {
  switch (token) {
    case 'solana':
    case 'solana-usdc':
    case 'ario':
      return 'solana';
    case 'arweave':
      return 'arweave';
    case 'ethereum':
    case 'base-eth':
    case 'usdc':
    case 'base-usdc':
    case 'polygon-usdc':
    case 'pol':
    case 'base-ario':
      return 'ethereum';
    default:
      return undefined;
  }
}

export function walletHeading(wallet: SourceWallet): string {
  return `From your ${WALLET_NAME[wallet]} wallet`;
}

/** "Paid from your Solana wallet", for a source that is not the session's. */
export function paidFromLine(wallet: SourceWallet): string {
  return `Paid from your ${WALLET_NAME[wallet]} wallet`;
}

/**
 * How long a slow token takes to reach the balance, as a row label.
 *
 * Only AR qualifies. The Turbo backend measured submission-to-credit over the
 * 180 days to 2026-09-23 (SPEC-payment-sources § 7.8): AR waits for 18
 * confirmations, a median of about 39 minutes and a p90 of about 51. Every
 * other token credits within about 2.5 minutes at p90, which is inside the
 * name checkout's five-minute credit wait, so none of them is labelled.
 *
 * A label only. The two-step flow a slow token needs on the name checkout is
 * § 7.8's work, not this phase's; this just stops AR looking as quick as SOL.
 */
export const SLOW_TOKEN_WAIT: Partial<Record<SupportedTokenType, string>> = {
  arweave: 'about 40 min',
};

/**
 * Fast chains, best first, for Top Up's preselection (§ 7.2): USDC on Solana,
 * SOL, USDC on Base, ETH on Base. A stablecoin leads its chain because its
 * price does not move between the quote and the transfer.
 */
export const TOP_UP_FAST_ORDER: readonly SupportedTokenType[] = [
  'solana-usdc',
  'solana',
  'base-usdc',
  'base-eth',
];

/**
 * Every token by expected time to credit, for the name checkout's fallback
 * when ARIO cannot be preselected. Follows the p90 column of § 7.8, with the
 * Top Up order above kept intact at its head so the two surfaces never
 * disagree about which of two fast tokens is quicker.
 */
export const SPEED_ORDER: readonly SupportedTokenType[] = [
  'ario',
  ...TOP_UP_FAST_ORDER,
  'pol',
  'usdc',
  'ethereum',
  'arweave',
];

/**
 * The SOL a USDC-on-Solana transfer costs: the base signature fee, 5,000
 * lamports (§ 7.9).
 *
 * turbo-sdk builds the transfer with no priority fee and creates Turbo's token
 * account idempotently, and that account already exists, so one signature's
 * fee is the whole cost. If the SDK ever adds a compute-budget instruction this
 * must follow it; `paymentSources.test.ts` reads the SDK's transfer builder so
 * that change cannot land silently.
 */
export const SOLANA_BASE_FEE_LAMPORTS = 5_000;
export const SOLANA_BASE_FEE_SOL = SOLANA_BASE_FEE_LAMPORTS / 1e9;
export const SOL_FEE_REASON = 'Needs 0.000005 SOL for the network fee';

export interface PaymentSource {
  /** Matches `PaymentOption.id` on the name checkout: `token:<token>`. */
  id: string;
  token: SupportedTokenType;
  wallet: SourceWallet;
  /** "USDC", "SOL", "ETH". */
  label: string;
  /** "Base", "Solana". Absent where the ticker alone is unambiguous. */
  network?: string;
  /** Held, in whole tokens. `undefined` when unknown or still loading. */
  balance?: number;
  balanceLoading: boolean;
  /** What this costs, in whole tokens. `undefined` when not quoted. */
  price?: number;
  /** "Best price" on the name checkout's ARIO row. */
  badge?: string;
  /** "about 40 min" for a token slower than the credit wait. */
  wait?: string;
  /** Why the row cannot be chosen. Absent when it can. */
  disabledReason?: string;
}

export interface SourceInput {
  token: SupportedTokenType;
  badge?: string;
  /** A requirement outside the token itself, from `PaymentOption.blockedReason`. */
  blockedReason?: string;
}

export interface BuildSourcesInput {
  tokens: SourceInput[];
  /** Holdings per token. A missing key is an unknown balance, never zero. */
  balances?: Partial<Record<SupportedTokenType, number | undefined>>;
  /** Tokens whose balance is still being read. */
  loadingTokens?: readonly SupportedTokenType[];
  /** Price per token, in whole tokens. */
  prices?: Partial<Record<SupportedTokenType, number | undefined>>;
  /**
   * SOL held by the wallet that would send USDC on Solana. `undefined` means
   * unknown, and an unknown balance never disables a row: the fee notice in
   * `CryptoConfirmationPanel` covers it before the wallet opens.
   */
  solBalance?: number;
}

/**
 * The name checkout's token options as picker sources.
 *
 * Read straight off `buildPaymentOptions`, so the name checkout offers exactly
 * the tokens it offered before this picker existed, with ARIO's badge and SOL
 * block carried across untouched.
 */
export function sourceInputsFromOptions(options: PaymentOption[]): SourceInput[] {
  return options
    .filter((o): o is PaymentOption & { token: SupportedTokenType } =>
      o.kind === 'token' && !!o.token,
    )
    .map((o) => ({
      token: o.token,
      badge: o.badge,
      blockedReason: o.blockedReason,
    }));
}

export function buildSources({
  tokens,
  balances = {},
  loadingTokens = [],
  prices = {},
  solBalance,
}: BuildSourcesInput): PaymentSource[] {
  const sources: PaymentSource[] = [];
  for (const { token, badge, blockedReason } of tokens) {
    const wallet = walletForToken(token);
    // A token with no wallet to pay from is not a source. Never happens for
    // today's tokens; guarding keeps a new token from rendering headless.
    if (!wallet) continue;
    const label = TOKEN_LABEL[token] ?? token;
    const balanceLoading = loadingTokens.includes(token);
    const balance = balanceLoading ? undefined : balances[token];
    const price = prices[token];

    /*
      One reason, in the order the user has to clear them. A blocked reason
      (ARIO's SOL for the name's account rent) is a requirement outside the
      token, so it outranks "not enough of this token", which outranks the
      USDC transfer's own fee. Each is judged on KNOWN figures only: an unknown
      balance or price reads as affordable, matching `paymentOptions.ts`, so a
      failed lookup can never make a funded wallet look empty.
    */
    const short =
      balance !== undefined && price !== undefined && balance < price;
    const noFeeSol =
      token === 'solana-usdc' &&
      solBalance !== undefined &&
      solBalance < SOLANA_BASE_FEE_SOL;
    const disabledReason =
      blockedReason ??
      (short ? `Not enough ${label}` : noFeeSol ? SOL_FEE_REASON : undefined);

    sources.push({
      id: `token:${token}`,
      token,
      wallet,
      label,
      network: TOKEN_NETWORK[token],
      balance,
      balanceLoading,
      price,
      badge,
      wait: SLOW_TOKEN_WAIT[token],
      disabledReason,
    });
  }
  return sources;
}

export interface SourceGroup {
  wallet: SourceWallet;
  heading: string;
  sources: PaymentSource[];
}

/**
 * Rows grouped by the wallet that pays, so "which wallet will open?" is
 * answered before it is asked. The session wallet's group leads; the others
 * follow in the order their first source appears. Order within a group is the
 * input order, which is already best-first (`availableTokensForWallet`, and
 * the name checkout's extras ahead of the wallet's own tokens).
 */
export function groupSources(
  sources: PaymentSource[],
  sessionWalletType: WalletKind,
): SourceGroup[] {
  const groups: SourceGroup[] = [];
  for (const source of sources) {
    let group = groups.find((g) => g.wallet === source.wallet);
    if (!group) {
      group = {
        wallet: source.wallet,
        heading: walletHeading(source.wallet),
        sources: [],
      };
      groups.push(group);
    }
    group.sources.push(source);
  }
  const session = groups.findIndex((g) => g.wallet === sessionWalletType);
  if (session > 0) groups.unshift(...groups.splice(session, 1));
  return groups;
}

/** Can be chosen, and is not known to fall short. Unknown reads as affordable. */
export function isSelectable(source: PaymentSource): boolean {
  return !source.disabledReason;
}

/**
 * The source the crypto dropdown opens on.
 *
 * Name checkout: ARIO when it can be chosen, because it pays the registry
 * directly and is cheaper than every other route by construction. Otherwise
 * the fastest source that can be chosen.
 *
 * Top Up: the first fast-chain source that can be chosen and is not known to
 * be empty, then the session wallet's own first token. Top Up has no price at
 * this point (the amount is picked after the token), so "affordable" there can
 * only mean "holds some".
 *
 * Falls back to the first selectable source, then the first source, so a
 * dropdown with rows never opens on nothing.
 */
export function preselectSource(
  sources: PaymentSource[],
  surface: PaymentSurface,
): PaymentSource | undefined {
  const selectable = sources.filter(isSelectable);
  const byToken = (t: SupportedTokenType) => selectable.find((s) => s.token === t);

  if (surface === 'name-checkout') {
    for (const token of SPEED_ORDER) {
      const hit = byToken(token);
      if (hit) return hit;
    }
  } else {
    for (const token of TOP_UP_FAST_ORDER) {
      const hit = byToken(token);
      if (hit && (hit.balance === undefined || hit.balance > 0)) return hit;
    }
    // The session wallet's own token: the head of `availableTokensForWallet`,
    // which is where Top Up's sources come from.
    if (sources[0] && isSelectable(sources[0])) return sources[0];
  }
  return selectable[0] ?? sources[0];
}

/**
 * Keep a selection while it is still offered; fall back only when it is not.
 *
 * The same rule `TopUpPanel` applies in its "keep the selected token payable"
 * effect: a row that is still in the list stays chosen even if a balance
 * arriving late disables it, because moving the selection under someone who is
 * reading it is worse than showing them why it cannot be paid.
 */
export function resolveSourceSelection(
  sources: PaymentSource[],
  currentId: string | undefined,
  surface: PaymentSurface,
): PaymentSource | undefined {
  return (
    (currentId ? sources.find((s) => s.id === currentId) : undefined) ??
    preselectSource(sources, surface)
  );
}

/** Which of the three choices a name checkout option belongs to. */
export function methodForOption(option: Pick<PaymentOption, 'kind'>): PaymentMethod {
  return option.kind === 'balance'
    ? 'credits'
    : option.kind === 'card'
      ? 'card'
      : 'crypto';
}

/**
 * The option the name checkout opens on, once balances and prices are in.
 *
 * 1. Credits, when the balance covers the price: nothing new is spent.
 * 2. ARIO, when it is affordable on KNOWN figures: its spendable ARIO covers
 *    its price, and its SOL covers the network costs. The cheapest route, and
 *    today's "Best price" badge.
 * 3. Otherwise `fallback`, which the host passes as today's default
 *    (`defaultPaymentOption` over the routing list), so anyone ARIO does not
 *    suit opens exactly where they did before this picker.
 *
 * Every ARIO figure must be known, unlike a row merely being enabled.
 * Preselecting it for someone signed out, or whose lookup failed, would put a
 * route in front of them that most people cannot pay with.
 *
 * `arioSpendable` is the LIQUID balance, not the row's liquid-plus-staked
 * total: the checkout's funding source starts on 'balance' (liquid), so a
 * wallet whose ARIO is mostly staked would otherwise open on a route that
 * cannot pay until they change a second control.
 */
export function preselectNameCheckoutOption({
  options,
  sources,
  fallback,
  arioSpendable,
  solBalance,
  solRequired,
}: {
  options: PaymentOption[];
  sources: PaymentSource[];
  fallback: PaymentOption | undefined;
  /** Liquid ARIO; `undefined` when unknown. */
  arioSpendable?: number;
  /** SOL held by the paying wallet; `undefined` when unknown. */
  solBalance?: number;
  /** SOL the ARIO route spends on rent and fees; `undefined` when unquoted. */
  solRequired?: number;
}): string | undefined {
  const credits = options.find((o) => o.kind === 'balance');
  if (credits?.sufficient && !credits.blockedReason) return credits.id;
  const ario = sources.find((s) => s.token === 'ario');
  if (
    ario &&
    isSelectable(ario) &&
    ario.price !== undefined &&
    arioSpendable !== undefined &&
    arioSpendable >= ario.price &&
    solBalance !== undefined &&
    solRequired !== undefined &&
    solBalance >= solRequired
  ) {
    return ario.id;
  }
  return fallback?.id;
}

/**
 * A price or a holding, short enough for a picker row.
 *
 * Whole units below one get four significant figures, so 0.0015 ETH and
 * 0.2381 SOL both read in full; larger amounts get two decimals.
 */
export function formatSourceAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return '0';
  if (amount > 0 && amount < 1) {
    return amount.toLocaleString(undefined, { maximumSignificantDigits: 4 });
  }
  return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** "Not enough, need 6.61": the shortfall, in credits. */
export function creditsShortReason(held: number, price: number): string {
  return `Not enough, need ${formatSourceAmount(Math.max(0, price - held))}`;
}
