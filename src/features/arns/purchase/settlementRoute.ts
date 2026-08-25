import type { ArNSFundingSource } from '../components/ArNSPaymentSelector';
import type { PaymentOption } from './paymentOptions';

/**
 * How a chosen payment option actually settles.
 *
 * The flat picker deliberately hides this: "Card", "SOL" and "ARIO" sit in one
 * row as equals, but underneath they are three different machines. Keeping the
 * mapping here — pure, and separate from the UI — is what lets the surface stay
 * flat without the components growing a tangle of conditionals.
 *
 * - `credits`  — spend the existing balance. One on-chain write.
 * - `ario`     — spend the wallet's ARIO directly, drawn from `fundFrom`.
 * - `card`     — fiat quote → Stripe → poll the nonce. The bundler settles.
 * - `topup`    — the token can't buy a name directly, so it buys credits first,
 *                then the name. Two steps, one button.
 */
export type SettlementRoute =
  | { kind: 'credits' }
  | { kind: 'ario'; fundFrom: ArNSFundingSource }
  | { kind: 'card' }
  | { kind: 'topup'; token: string };

/**
 * ARIO is the only token the ArNS contract prices in, so it is the only one
 * that can settle a purchase directly. Everything else has to become credits
 * first — which is a real extra step (a second signature, a confirmation wait),
 * so the UI must be able to say so rather than pretending it is instant.
 */
export function resolveSettlementRoute(
  option: PaymentOption,
  fundingSource: ArNSFundingSource,
): SettlementRoute {
  switch (option.kind) {
    case 'card':
      return { kind: 'card' };
    case 'balance':
      return { kind: 'credits' };
    case 'token':
      return option.token === 'ario'
        ? { kind: 'ario', fundFrom: fundingSource }
        : { kind: 'topup', token: option.token! };
  }
}

/** True when the route needs two transactions, not one. */
export function isTwoStep(route: SettlementRoute): boolean {
  return route.kind === 'topup';
}

/**
 * The ARIO funding-source picker (Liquid / Liquid+Staked / Staked) is only
 * meaningful when ARIO itself is paying. Showing it under Card or SOL would be
 * offering a choice that changes nothing.
 */
export function showsFundingSource(route: SettlementRoute): boolean {
  return route.kind === 'ario';
}

/**
 * What the primary button says. The verb should match the number of steps the
 * user is agreeing to, so a two-step route doesn't look like a one-tap buy.
 */
export function actionLabel(route: SettlementRoute): string {
  switch (route.kind) {
    case 'card':
      return 'Pay with card';
    case 'credits':
      return 'Register name';
    case 'ario':
      return 'Register name';
    case 'topup':
      return 'Continue';
  }
}

/**
 * Who ends up owning the name's ANT when paying by card.
 *
 * There are two card paths, and they differ in more than plumbing:
 *
 * - `self-custody` — the card buys credits, then the user's own Solana signer
 *   performs an atomic `buyRecord`. They own the ANT outright and pay the SOL
 *   rent themselves. No surcharge.
 * - `custodial` — the one-step fiat quote with no `processId`. Turbo spawns and
 *   OWNS the ANT, recovering its SOL rent as a surcharge (~$2.06). It is the
 *   only way to buy a name holding no crypto at all.
 *
 * Derived, never asked. Which one is possible is a fact about the wallet, not a
 * preference: choosing custodial when you could self-own costs more AND gives
 * away ownership, so there is no case where a funded Solana user wants it.
 */
export type CardFlavor = 'self-custody' | 'custodial';

export function cardFlavor({
  hasSolanaSigner,
  solCoversGas,
}: {
  hasSolanaSigner: boolean;
  /** `undefined` when the balance lookup failed or hasn't run. */
  solCoversGas: boolean | undefined;
}): CardFlavor {
  // No signer at all (an Arweave or Ethereum session with no linked Solana
  // wallet) — custodial is the only thing that can work.
  if (!hasSolanaSigner) return 'custodial';
  // Known to be short on gas: they cannot pay the rent, so Turbo must.
  if (solCoversGas === false) return 'custodial';
  // Known-good, or UNKNOWN. Unknown resolves to self-custody deliberately: a
  // self-custody attempt that turns out to be underfunded fails before any
  // charge, while a custodial purchase spends real money and hands Turbo the
  // ANT. Guessing wrong in that direction is not recoverable.
  return 'self-custody';
}
