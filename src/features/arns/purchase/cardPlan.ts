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
  /** No Solana wallet, and custody is switched off: linking is the only path. */
  | { kind: 'link' }
  /** Turbo holds the ANT. `reason` drives what the user is told. */
  | { kind: 'custodial'; reason: 'no-wallet' | 'no-sol' };

export function planCardPurchase({
  needsLinking,
  signerLive,
  solCoversGas,
  custodialEnabled = true,
}: {
  /** No Solana wallet is linked (and this isn't a Solana session). */
  needsLinking: boolean;
  /** A Solana adapter is connected and can sign right now. */
  signerLive: boolean;
  /** `undefined` when the balance is unknown — see below. */
  solCoversGas: boolean | undefined;
  /**
   * Whether Turbo-custodied purchases may be sold at all.
   *
   * Off, every route that would have ended in custody instead asks for what
   * self-custody actually needs: a Solana wallet, and enough SOL for the rent.
   * The no-SOL case deliberately falls through to `self-custody` rather than
   * getting a bespoke blocked kind — the balance gating already stops that
   * purchase and names the shortfall, so this stays one rule instead of two.
   */
  custodialEnabled?: boolean;
}): CardPlan {
  /*
    No Solana wallet at all — buy it custodially, and say nothing about wallets.

    This used to stop and ask the user to link one first. That gate sat in front
    of the people least able to answer it: someone buying a domain with a card
    has no reason to know what Solana is, and the question arrives before they
    own anything that would make the answer matter. Custody is a legitimate
    destination for them, not a booby prize — the name works, records work,
    renewals work, and moving it to their own wallet later is free and needs no
    SOL. The offer belongs after the purchase, against a name they already own.

    A wallet that EXISTS but is asleep is a different case and still gets woken
    below: that user has already chosen self-custody, so reconnecting gives them
    what they picked rather than quietly deciding otherwise for them.
  */
  if (needsLinking) {
    return custodialEnabled
      ? { kind: 'custodial', reason: 'no-wallet' }
      : { kind: 'link' };
  }

  // A wallet exists; it just isn't awake. This is the case that was silently
  // costing users their ANT and an extra ~$2.06.
  if (!signerLive) return { kind: 'reconnect' };

  // Known to be short on rent: they cannot complete a self-custody buy, so
  // Turbo covering it is the only route that works.
  if (solCoversGas === false && custodialEnabled) {
    return { kind: 'custodial', reason: 'no-sol' };
  }

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

/**
 * Whether Turbo-custodied purchases are offered, by environment.
 *
 * OFF in production, deliberately, and this is a launch gate rather than a
 * verdict on the feature. Every custodial sub-flow reviewed before launch was
 * broken as written — the quote address, the transfer signature, record
 * writes, assigning a name to a deployment, renewals, and owner/signer
 * agreement — each found by reading, none by running, because no custodial
 * purchase has ever executed. Selling one in that state risks the worst
 * failure this product has: money taken, and a name the buyer cannot reach.
 *
 * OFF everywhere, including testnet — this is not an environment gate.
 *
 * Custody solved the wrong half of the problem. It removed the need to hold
 * SOL, but never the need for a wallet to sign with: `needsLinking` always
 * meant "no SOLANA wallet", and a session identity is required to reach the
 * checkout at all. Sponsored gas removes the SOL requirement without handing
 * Turbo the asset, a surcharge, a reduced action set, or a claim flow — so
 * custody is retired rather than fixed, and this stays false until that
 * replacement ships.
 *
 * Kept as one switch rather than deleted so the decision has a single home,
 * and the code beneath it stays reachable for whoever revisits this.
 */
export function custodialPurchaseEnabled(): boolean {
  return false;
}
