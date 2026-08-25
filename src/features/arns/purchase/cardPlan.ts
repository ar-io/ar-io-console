/**
 * What a card purchase should actually do, given the wallet's state.
 *
 * Replaces a binary self-custody/custodial split that collapsed two very
 * different situations into one. "No live signer" was treated as "no Solana
 * wallet", but the Solana provider runs `autoConnect=false` — so a user with a
 * perfectly good linked wallet who simply hadn't reconnected this session was
 * routed into a CUSTODIAL purchase: paying the ANT-spawn surcharge and handing
 * Turbo their name, when one reconnect prompt would have given them
 * self-custody for less. That was almost certainly the most common way custody
 * was being triggered, and none of it was intended.
 *
 * Custody is a real commitment — Turbo holds the asset, supports only three of
 * the ANT operations, and owes the user a way out forever. It should be the
 * last rung, reached only when the alternatives have actually been offered.
 */
export type CardPlan =
  /** Their own signer buys and owns it. No surcharge. */
  | { kind: 'self-custody' }
  /** A linked wallet exists but is cold — reconnect beats giving custody away. */
  | { kind: 'reconnect' }
  /** No Solana wallet at all; offer to link one before falling back. */
  | { kind: 'link' }
  /** Turbo holds the ANT. `reason` drives what the user is told. */
  | { kind: 'custodial'; reason: 'no-wallet' | 'no-sol' };

export function planCardPurchase({
  needsLinking,
  signerLive,
  solCoversGas,
  declinedLink = false,
}: {
  /** No Solana wallet is linked (and this isn't a Solana session). */
  needsLinking: boolean;
  /** A Solana adapter is connected and can sign right now. */
  signerLive: boolean;
  /** `undefined` when the balance is unknown — see below. */
  solCoversGas: boolean | undefined;
  /** They were offered linking and chose to continue without it. */
  declinedLink?: boolean;
}): CardPlan {
  // No wallet to sign with. Linking is a better outcome than custody for
  // everyone, so ask first — but take no for an answer.
  if (needsLinking) {
    return declinedLink
      ? { kind: 'custodial', reason: 'no-wallet' }
      : { kind: 'link' };
  }

  // A wallet exists; it just isn't awake. This is the case that was silently
  // costing users their ANT and an extra ~$2.06.
  if (!signerLive) return { kind: 'reconnect' };

  // Known to be short on rent: they cannot complete a self-custody buy, so
  // Turbo covering it is the only route that works.
  if (solCoversGas === false) return { kind: 'custodial', reason: 'no-sol' };

  // Known-good, or unknown. Unknown resolves to self-custody deliberately: an
  // underfunded attempt fails before any charge, while a custodial purchase
  // spends real money AND transfers ownership. Never guess toward the outcome
  // that cannot be undone.
  return { kind: 'self-custody' };
}

/** True when Turbo will end up holding the name — drives price and disclosure. */
export function isCustodialPlan(plan: CardPlan): boolean {
  return plan.kind === 'custodial';
}
