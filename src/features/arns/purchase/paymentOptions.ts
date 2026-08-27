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
  /**
   * Why this option cannot complete, shown on the chip. Absent when usable.
   *
   * Distinct from `sufficient`, which asks whether the option's OWN asset
   * covers the price. This covers requirements shared across routes — chiefly
   * the SOL that creating an ANT costs, which every route needs except a
   * custodial card. Without it an ARIO-rich wallet holding no SOL saw ARIO
   * offered as usable and failed at signing.
   */
  blockedReason?: string;
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
  /**
   * SOL the wallet must hold for the ANT's account rent, and what it holds.
   *
   * `solBalance: undefined` means the lookup failed or has not run — every
   * option stays usable in that case. Blocking on an unknown balance would tell
   * a funded user to go buy SOL, a mistake this app has already shipped once.
   */
  networkSolRequired?: number;
  solBalance?: number;
  /**
   * Paying by card will leave Turbo holding the name's ANT.
   *
   * Surfaced on the option itself because it changes what you get, not just how
   * you pay — and a difference that large should be visible while choosing,
   * not discovered in the cost breakdown after.
   */
  cardIsCustodial?: boolean;
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
  cardIsCustodial = false,
  networkSolRequired,
  solBalance,
}: PaymentOptionsInput): PaymentOption[] {
  /*
    Creating a name costs SOL in account rent, whoever pays for the name itself.
    A custodial card is the sole exception — Turbo spawns the ANT from its own
    keypair — which is exactly why it exists as a fallback.
  */
  const shortOnNetworkSol =
    networkSolRequired !== undefined &&
    solBalance !== undefined &&
    solBalance < networkSolRequired;
  const networkBlock = shortOnNetworkSol
    ? `Needs ~${networkSolRequired.toLocaleString(undefined, {
        maximumFractionDigits: 4,
      })} SOL for network costs`
    : undefined;
  const options: PaymentOption[] = [];

  /*
    An existing balance leads when there is one: it is preselected WHEN IT
    COVERS THE PRICE (see `defaultPaymentOption`, which skips an insufficient
    balance), costs nothing new, and the eye should land on the likely choice
    rather than hunt for it at the end of the row.

    With no balance — the common case — Card leads instead. It is the only
    option that works with no crypto at all, and the one a newcomer is looking
    for.
  */
  if (credits > 0) {
    options.push({
      kind: 'balance',
      id: 'balance',
      label: 'Balance',
      detail: `${credits.toLocaleString(undefined, { maximumFractionDigits: 4 })} credits`,
      sufficient: priceInCredits === undefined ? true : credits >= priceInCredits,
      blockedReason: networkBlock,
    });
  }

  if (cardEnabled) {
    options.push({
      kind: 'card',
      id: 'card',
      label: 'Card',
      /*
        When it is the only route that works, say what makes it work rather than
        naming the processor. "Turbo holds the name" describes the trade; "No
        crypto needed" describes the reason to take it.
      */
      detail: cardIsCustodial
        ? shortOnNetworkSol
          ? 'No crypto needed'
          : 'Turbo holds the name'
        : 'with Stripe',
      // A card can always cover the price — the charge is sized to it. And a
      // custodial card needs no SOL, so the network block never applies.
      sufficient: true,
      ...(cardIsCustodial ? {} : { blockedReason: networkBlock }),
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
      blockedReason: networkBlock,
      // Unknown holdings or unknown price must NOT read as insufficient — the
      // same conflation that made a funded wallet look empty elsewhere.
      sufficient: held === undefined || price === undefined ? true : held >= price,
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
  // Blocked options are not choices — a route that cannot complete must never
  // be preselected, however cheap or convenient it looks.
  const usable = options.filter((o) => !o.blockedReason);
  return (
    usable.find((o) => o.kind === 'balance' && o.sufficient) ??
    usable.find((o) => o.sufficient) ??
    usable[0] ??
    options[0]
  );
}
