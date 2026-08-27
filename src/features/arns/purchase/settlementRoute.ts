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
