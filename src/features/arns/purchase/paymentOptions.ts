import type { SupportedTokenType } from '../../../constants';
import { formatHeldBalance } from './formatBalance';
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
  /**
   * Drop the credit-buying tokens, keeping the extras.
   *
   * A token top-up credits WHOEVER SENT THE TOKENS, and these flows send from
   * the Solana wallet that will own the name. Every credits-settled ArNS action
   * then spends the SESSION identity's credits (`purchaseWithCredits` takes
   * `client: getOwnerClient()`). On a Solana session those are one wallet and
   * all is well; on an Ethereum or Arweave session they are two, so the tokens
   * leave, the credits land somewhere the purchase never reads, and the buyer
   * is out real SOL with no name.
   *
   * The extras survive on purpose: ARIO pays the registry directly through
   * `@ar.io/sdk` and never touches credits, so it has no payer to mismatch.
   *
   * This removes an option rather than repairing it. Repairing it means sending
   * the top-up from the SESSION wallet using its own chains, which is a larger
   * change than a release should carry. Until then the working route for these
   * users is /topup — which credits the session wallet correctly — followed by
   * paying from Balance.
   */
  creditTopUpsUnavailable?: boolean;
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
}

export function buildPaymentOptions({
  walletType,
  credits,
  priceInCredits,
  tokenBalances = {},
  tokenPrices = {},
  extraTokens = [],
  isTokenSelectable,
  creditTopUpsUnavailable = false,
  cardEnabled = true,
  networkSolRequired,
  solBalance,
}: PaymentOptionsInput): PaymentOption[] {
  /*
    Only ARIO spends the buyer's own SOL.

    Paying in ARIO is not a Turbo action — it is the buyer's own `buyRecord`
    transaction, so their wallet covers the Solana account rent. Every other
    route settles in credits and Turbo pays that rent, so the block below is
    applied to the ARIO option alone. Applying it broadly is what would block
    the buyers this change exists to serve: the ones holding no SOL at all.

    It is stated on the option rather than at submit, because ARIO also carries
    the "Best price" badge — the cheapest route being the only one with a SOL
    requirement is exactly the trade someone should see before choosing.
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
      // Same shape as the token cards: an amount and its unit, nothing else.
      detail: `${formatHeldBalance(credits)} credits`,
      sufficient: priceInCredits === undefined ? true : credits >= priceInCredits,
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
      detail: 'via Stripe',
      // A card can always cover the price — the charge is sized to it — and
      // Turbo pays the Solana costs, so no SOL block applies.
      sufficient: true,
    });
  }

  const walletTokens = creditTopUpsUnavailable
    ? []
    : availableTokensForWallet(walletType, isTokenSelectable);
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
      /*
        "1,505,829.1436 available" overflowed the card and was CSS-truncated
        mid-digits — a number cut that way reads as broken, not shortened. The
        amount is abbreviated instead.

        The NETWORK stays. `usdc` and `base-usdc` are different tokens on
        different chains, so dropping it to save width would make two distinct
        options read identically — which is exactly the confusion the ticker
        and network together exist to prevent.
      */
      detail:
        held === undefined
          ? network
          : `${formatHeldBalance(held)} ${TOKEN_LABEL[token] ?? token}${
              network ? ` · ${network}` : ''
            }`,
      token,
      /*
        ARIO pays the ARIO registry directly and never touches the Turbo infra
        fee, so it is cheaper than every other route BY CONSTRUCTION — not by a
        market rate that could invert. Measured live: ARIO $1.36 vs SOL $2.09
        vs card $4.16 for the same name. Worth stating, since the whole point of
        correcting the ARIO rate was to make that difference visible.
      */
      badge: token === 'ario' ? 'Best price' : undefined,
      // ARIO alone; see the note on `shortOnNetworkSol`.
      blockedReason: token === 'ario' ? networkBlock : undefined,
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
