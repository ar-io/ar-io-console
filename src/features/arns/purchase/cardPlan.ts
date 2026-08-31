/**
 * What a purchase needs from the buyer's wallet before it can run.
 *
 * This used to be a ladder — self-custody, reconnect, link, or hand the name to
 * Turbo — because the deciding question was whether the wallet held enough SOL
 * to pay the Solana rent. Turbo pays that now, so the SOL question is gone and
 * with it every rung that existed to route around it.
 *
 * One question remains, and it is not about money: the name is minted directly
 * to a Solana address, so there has to be a Solana wallet able to sign for it.
 * That wallet never needs a balance — it needs to exist and be awake.
 */
export type PurchasePlan =
  /** A live signer is ready. Nothing to ask for. */
  | { kind: 'ready' }
  /** A wallet is linked but asleep — the Solana provider does not auto-connect. */
  | { kind: 'reconnect' }
  /** No Solana wallet at all. Email sign-in creates one; so does connecting. */
  | { kind: 'connect' };

export function planNamePurchase({
  needsLinking,
  signerLive,
}: {
  /** No Solana wallet is linked, and this is not a Solana session. */
  needsLinking: boolean;
  /** A Solana adapter is connected and can sign right now. */
  signerLive: boolean;
}): PurchasePlan {
  /*
    Asked before the purchase, not after it fails.

    An email user already has an embedded Solana wallet, so this is rarer than
    it looks — and when it does apply, signing in is the answer rather than
    "install a wallet", which is the sentence that used to lose people who had
    no reason to know what Solana was.
  */
  if (needsLinking) return { kind: 'connect' };

  /*
    A wallet that EXISTS but is asleep is not a missing wallet.

    The Solana provider runs `autoConnect=false`, so a returning user routinely
    arrives with a perfectly good linked wallet and no live signer. Conflating
    the two is what used to push them down a worse path than one reconnect
    prompt would have.
  */
  if (!signerLive) return { kind: 'reconnect' };

  return { kind: 'ready' };
}
