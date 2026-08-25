import type { SupportedTokenType } from '../../../constants';
import { availableTokensForWallet, type WalletKind } from '../../../utils/walletTokens';

/**
 * The flat list of ways to pay for a name.
 *
 * Replaces a two-step model where the top-level choice was "Turbo Credits vs
 * ARIO tokens" — two things that are not the same kind of thing. ARIO is a
 * token you hold; credits are a balance you must first fund, so choosing them
 * with an empty balance led to a second payment decision (card or crypto?)
 * inside a modal. That is the same question, one layer down, named after our
 * billing subsystem.
 *
 * What a user actually has is a card, and whatever their wallet holds. Turbo is
 * how we settle it — not something they should have to reason about.
 */
export type PaymentOptionKind = 'card' | 'token' | 'balance';

export interface PaymentOption {
  kind: PaymentOptionKind;
  /** Stable id for selection state. */
  id: string;
  /** What the user sees: "Card", "SOL", "ARIO", "Balance". */
  label: string;
  /** Secondary line: holdings, or what the card accepts. */
  detail?: string;
  /** Present for `kind: 'token'`. */
  token?: SupportedTokenType;
  /** False when the option exists but cannot cover this purchase. */
  sufficient: boolean;
  /** Short chip, e.g. "Best price". Absent for most options. */
  badge?: string;
}

const TOKEN_LABEL: Partial<Record<SupportedTokenType, string>> = {
  solana: 'SOL',
  ario: 'ARIO',
  arweave: 'AR',
  'base-eth': 'ETH',
  ethereum: 'ETH',
  'base-usdc': 'USDC',
  usdc: 'USDC',
  pol: 'POL',
};

const TOKEN_NETWORK: Partial<Record<SupportedTokenType, string>> = {
  'base-eth': 'Base',
  'base-usdc': 'Base',
  ethereum: 'Ethereum',
  usdc: 'Ethereum',
  pol: 'Polygon',
};

export interface PaymentOptionsInput {
  walletType: WalletKind;
  /** Credits already held. `Balance` is offered only when this is > 0. */
  credits: number;
  /** Price of the name in credits, for the sufficiency check. */
  priceInCredits?: number;
  /** Per-token holdings, for display and sufficiency. */
  tokenBalances?: Partial<Record<SupportedTokenType, number>>;
  /** Price per token, where known. */
  tokenPrices?: Partial<Record<SupportedTokenType, number>>;
  /**
   * Tokens this purchase accepts on top of the wallet's usual top-up set,
   * listed first.
   *
   * `availableTokensForWallet` answers "what can this wallet buy credits with",
   * which is not the same question. ARIO is the unit ArNS prices names in and
   * settles a purchase in a single transaction, but it is not a top-up token —
   * so deriving the list from the wallet alone drops the best option on the
   * surface that needs it most.
   */
  extraTokens?: SupportedTokenType[];
  isTokenSelectable: (t: SupportedTokenType) => boolean;
  /** Card is unavailable when the payment service has Stripe disabled (503). */
  cardEnabled?: boolean;
}

export function buildPaymentOptions({
  walletType,
  credits,
  priceInCredits,
  tokenBalances = {},
  tokenPrices = {},
  extraTokens = [],
  isTokenSelectable,
  cardEnabled = true,
}: PaymentOptionsInput): PaymentOption[] {
  const options: PaymentOption[] = [];

  // Card first: it is the only option that works with no crypto at all, and the
  // one a newcomer is looking for.
  if (cardEnabled) {
    options.push({
      kind: 'card',
      id: 'card',
      label: 'Card',
      // Name the processor: it tells a hesitant buyer who actually handles
      // their card details, which is the reassurance a card row is for.
      detail: 'with Stripe',
      // A card can always cover the price — the charge is sized to it.
      sufficient: true,
    });
  }

  const walletTokens = availableTokensForWallet(walletType, isTokenSelectable);
  // Extras lead, then the wallet's own set, deduped. A wallet with no signer
  // gets neither — an option it cannot sign is worse than one less option.
  const tokens =
    walletType === null
      ? []
      : [...extraTokens.filter(isTokenSelectable), ...walletTokens].filter(
          (t, i, a) => a.indexOf(t) === i,
        );

  for (const token of tokens) {
    const held = tokenBalances[token];
    const price = tokenPrices[token];
    const network = TOKEN_NETWORK[token];
    options.push({
      kind: 'token',
      id: `token:${token}`,
      label: TOKEN_LABEL[token] ?? token,
      detail:
        held === undefined
          ? network
          : `${network ? `${network} · ` : ''}${held.toLocaleString(undefined, {
              maximumFractionDigits: 4,
            })} available`,
      token,
      /*
        ARIO pays the ARIO registry directly and never touches the Turbo infra
        fee, so it is cheaper than every other route BY CONSTRUCTION — not by a
        market rate that could invert. Measured live: ARIO $1.36 vs SOL $2.09
        vs card $4.16 for the same name. Worth stating, since the whole point of
        correcting the ARIO rate was to make that difference visible.
      */
      badge: token === 'ario' ? 'Best price' : undefined,
      // Unknown holdings or unknown price must NOT read as insufficient — the
      // same conflation that made a funded wallet look empty elsewhere.
      sufficient: held === undefined || price === undefined ? true : held >= price,
    });
  }

  // Existing credits are the cheapest and fastest route, but only meaningful
  // when there are some. Named for what it is, not for the product.
  if (credits > 0) {
    options.push({
      kind: 'balance',
      id: 'balance',
      label: 'Balance',
      detail: `${credits.toLocaleString(undefined, { maximumFractionDigits: 4 })} credits`,
      sufficient: priceInCredits === undefined ? true : credits >= priceInCredits,
    });
  }

  return options;
}

/**
 * Which option to preselect.
 *
 * Prefers something the user can actually pay with right now — an existing
 * balance first (no new spend), then any sufficient option, then whatever is
 * first. Never preselects an option that cannot cover the purchase while a
 * usable one exists.
 */
export function defaultPaymentOption(options: PaymentOption[]): PaymentOption | undefined {
  return (
    options.find((o) => o.kind === 'balance' && o.sufficient) ??
    options.find((o) => o.sufficient) ??
    options[0]
  );
}
