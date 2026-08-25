import type { SettlementRoute } from './settlementRoute';

/**
 * How a purchase is actually paid for on the wire.
 *
 * Distinct from `SettlementRoute`, which says what the USER chose. Two routes
 * can share a mechanism: paying with SOL and paying from an existing balance
 * both end up debiting Turbo credits, because SOL becomes credits first.
 *
 * This exists because the two settle through DIFFERENT SDKs, and conflating
 * them cost real money. `@ar.io/sdk`'s Solana writes accept `fundFrom: 'turbo'`
 * and then ignore it — every branch treats it exactly like `'balance'` and
 * spends the wallet's ARIO:
 *
 *     if (!params.fundFrom || params.fundFrom === 'balance' ||
 *         params.fundFrom === 'turbo') { ... buyerTokenAccount: buyerATA ... }
 *
 * So "pay with credits" silently charged ARIO, and "pay with SOL" bought
 * credits and then charged ARIO on top. Credits are debited only by
 * turbo-sdk's `purchaseArNSName` family.
 */
export type SettlementMechanism =
  /** `@ar.io/sdk` write, drawn from the wallet's ARIO. */
  | { kind: 'ario-direct'; fundFrom: 'balance' | 'stakes' | 'any' }
  /** turbo-sdk purchase, debiting the signer's credit balance. */
  | { kind: 'turbo-credits' }
  /** turbo-sdk fiat quote — the card pays, Turbo settles on-chain. */
  | { kind: 'turbo-fiat' };

/**
 * `fundFrom` values that actually mean something to `@ar.io/sdk`.
 *
 * `'turbo'` is deliberately absent: it is accepted by the SDK's types and
 * ignored by its implementation, which is the whole defect. Anything reaching
 * `buyRecord` must be a value that changes behaviour.
 */
export type ArioFundFrom = 'balance' | 'stakes' | 'any';

export function settlementMechanismFor(
  route: SettlementRoute,
  /** Card only: Turbo holds the ANT and settles the fiat charge itself. */
  custodialCard = false,
): SettlementMechanism {
  switch (route.kind) {
    case 'ario':
      // The picker's funding sources map 1:1 onto real SDK modes.
      return { kind: 'ario-direct', fundFrom: route.fundFrom };
    case 'credits':
      return { kind: 'turbo-credits' };
    case 'topup':
      // The token bought credits; the purchase itself spends those credits.
      return { kind: 'turbo-credits' };
    case 'card':
      // A self-custody card buys credits first, so it lands on the same
      // mechanism as Balance. Only the custodial card is settled by Turbo.
      return custodialCard ? { kind: 'turbo-fiat' } : { kind: 'turbo-credits' };
  }
}

/**
 * Whether this mechanism needs a client-spawned ANT before it can settle.
 *
 * turbo-sdk's buy provisions a TURBO-OWNED ANT when no `processId` is supplied.
 * That is the right behaviour for a custodial card purchase and the wrong one
 * for a credits purchase, where the user is meant to own the name outright — so
 * a credits buy must spawn its own ANT and pass the id.
 */
export function needsClientSpawn(
  mechanism: SettlementMechanism,
  intent: string,
): boolean {
  if (mechanism.kind !== 'turbo-credits') return false;
  // Only a purchase creates a name; the rest act on one that already exists.
  return intent === 'Buy-Name' || intent === 'Buy-Record';
}
