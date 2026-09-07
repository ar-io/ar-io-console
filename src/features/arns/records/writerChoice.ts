/**
 * Which writer performs a record change, and why the user is told what it costs.
 *
 * Turbo's paid route accepts the ANT's OWNER only — the service verifies the
 * owner proof against the current on-chain owner, so a controller's signature
 * is rejected. Controllers keep the capability; they sign the Solana
 * transaction themselves and pay the network fee directly.
 *
 * Nothing here is subsidised. On the owner's route Turbo is the FEE PAYER and
 * bills the fee back in credits, which is why that route has a credits price
 * at all.
 *
 * `unknown` blocks rather than guesses. Guessing sponsored for a controller
 * spends a wallet prompt on a request that will 401; guessing self-signed for
 * an owner asks them to pay a fee they do not owe. Waiting for the answer costs
 * a moment; either wrong guess costs the user something real.
 */
import type { StrictAntRole } from '../antRole';

export type WriterKind = 'sponsored' | 'self-signed' | 'blocked';

/** Why this writer was chosen — the copy differs, so the reason must survive. */
export type WriterReason =
  /** Owner on the ordinary route: Turbo fee-pays, credits are billed. */
  | 'owner'
  /** Controller: Turbo won't take their signature, so they pay the network. */
  | 'controller'
  /** Owner who cannot cover the credits price but can cover the SOL. */
  | 'insufficient-credits'
  /** Owner who can cover neither — worth saying before they click, not after. */
  | 'insufficient-both'
  /** Role not yet known, or this wallet has no say over the name. */
  | 'unresolved';

export interface WriterChoice {
  kind: WriterKind;
  reason: WriterReason;
}

/**
 * What the wallet must hold for the funds-aware fallback to fire.
 *
 * `credits` is the SESSION wallet's balance, not the owner's: the sponsored
 * route bills whoever's Turbo client makes the request (`useCustodyOwnerClient`),
 * and on an Ethereum or Arweave session that is a different wallet from the
 * Solana one that signs as owner. `sol` is the owner's, since the owner is who
 * signs when we fall back.
 */
export interface WriterFunds {
  /** Session wallet's Turbo credits — the payer on the sponsored route. */
  credits?: number;
  /** Live credits price of the action. */
  priceCredits?: number;
  /** Owner wallet's SOL. */
  sol?: number;
}

/**
 * SOL the owner must hold before we route them away from credits.
 *
 * A signature fee is ~0.000005 SOL, but ADDING a record can create an account
 * and owe rent-exemption on it, which is the larger and less obvious number.
 * The threshold is deliberately generous, because the two ways of being wrong
 * are not symmetric: too high and we leave them on the credits route, where
 * they get a clear "not enough credits" message; too low and we hand them a
 * transaction their wallet fails to pay for, which reads as the app breaking.
 */
export const MIN_SOL_FOR_RECORD_WRITE = 0.002;

/**
 * The writer for a record change, given the wallet's role and what it holds.
 *
 * Credits stay the DEFAULT for an owner rather than "SOL first if you have
 * it": the credits price can be quoted exactly before the click, the sponsored
 * route is a single message signature with no transaction to confirm or fail,
 * and every price in this feature is denominated in credits. Preferring SOL
 * whenever it happens to be present would make the quoted figure wrong for
 * exactly the wallets that hold some.
 *
 * The fallback exists for the one case that was a dead end: an owner short on
 * credits who is perfectly able to sign for themselves. The minimum top-up is
 * $5, so sending them to buy credits for an action costing a fraction of a
 * cent is not a real option.
 */
export function chooseWriter(
  role: StrictAntRole,
  funds?: WriterFunds,
): WriterChoice {
  switch (role) {
    case 'controller':
      return { kind: 'self-signed', reason: 'controller' };
    case 'none':
    case 'unknown':
      return { kind: 'blocked', reason: 'unresolved' };
    case 'owner':
      break;
  }

  const credits = funds?.credits;
  const price = funds?.priceCredits;
  const sol = funds?.sol;

  /*
    Only a KNOWN shortfall may reroute. Both figures load asynchronously, and
    treating "not yet" as "can't afford it" would flip the route — and the
    quoted cost with it — under a user who is already reading the note.
  */
  const shortOnCredits =
    credits !== undefined && price !== undefined && credits < price;

  if (shortOnCredits && sol !== undefined) {
    return sol >= MIN_SOL_FOR_RECORD_WRITE
      ? { kind: 'self-signed', reason: 'insufficient-credits' }
      : /*
          Neither will cover it. Still the credits route — there is nothing
          better to route to — but flagged so the editor can say so up front
          rather than letting them fill in a record and meet the failure on
          save.
        */
        { kind: 'sponsored', reason: 'insufficient-both' };
  }

  return { kind: 'sponsored', reason: 'owner' };
}

/**
 * Role-only choice, for callers with no balances to hand.
 *
 * `useOwnedArNSNames` uses this deliberately: it runs mid-deploy, where an
 * extra balance lookup buys latency on the critical path and a wrong answer
 * fails a publish that used to work.
 */
export function writerForRole(role: StrictAntRole): WriterKind {
  return chooseWriter(role).kind;
}

/**
 * What this wallet's edits will cost, for the note above the records editor.
 *
 * `credits` is the live price for the action, which must be FETCHED — the
 * amount differs by environment and the actions are no longer free. Passing
 * `undefined` (still loading, or the lookup failed) deliberately produces a
 * note that promises nothing rather than one that says "free": the whole point
 * of this line is that nobody meets a charge they weren't told about.
 */
export function writerCostNote(
  kind: WriterKind,
  credits?: number,
  reason?: WriterReason,
): string | undefined {
  switch (kind) {
    case 'sponsored': {
      /*
        Said before the click. The alternative is letting someone compose a
        record and meet "insufficient credits" on save, having been told all
        along what it would cost and nothing about whether they could pay it.
      */
      if (reason === 'insufficient-both') {
        return credits === undefined
          ? 'Not enough credits to save changes. Add credits, or fund this wallet with a little SOL to sign it yourself.'
          : `Saving a record costs about ${credits.toLocaleString(undefined, {
              maximumFractionDigits: 4,
            })} credits, which is more than you have. Add credits, or fund this wallet with a little SOL to sign it yourself.`;
      }

      const cost =
        credits === undefined
          ? 'Saving a record costs a small amount of credits.'
          : credits === 0
            ? 'Saving a record is free on this network.'
            : `Saving a record costs about ${credits.toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })} credits.`;
      return `${cost} Your wallet will ask you to approve a message — that part needs no SOL.`;
    }
    case 'self-signed':
      /*
        Two different people end up here and the sentence must not be shared.
        Telling an owner they "don't own it" is both wrong and alarming, and it
        is the owner — not the controller — who is most likely to read this,
        since they arrived by running out of credits.
      */
      return reason === 'insufficient-credits'
        ? 'Not enough credits for this, so your wallet signs and pays the Solana fee instead.'
        : 'You control this name but don’t own it, so your wallet pays the Solana fee on each change.';
    case 'blocked':
      return undefined;
  }
}

/**
 * The writer for an OWNER-ONLY operation: transfer, add/remove controller.
 *
 * Same ladder as {@link chooseWriter} for an owner, and a hard stop for anyone
 * else. A controller may edit records — the program allows it — but cannot
 * transfer the name or change who controls it, so falling through to
 * self-signed here would spend a wallet prompt on a transaction the program
 * rejects.
 *
 * These ran self-signed only until now: `getWritableANT` with the owner's
 * signer, paying SOL. Turbo lists `transfer`, `add-controller` and
 * `remove-controller` among its actions and takes the same `ArNSOwnerSigner`
 * as `setArNSRecord`, so the same choice is available — pay in credits and need
 * no SOL, or sign it yourself and pay the network.
 */
export function chooseOwnerActionWriter(
  role: StrictAntRole,
  funds?: WriterFunds,
): WriterChoice {
  if (role !== 'owner') {
    return { kind: 'blocked', reason: 'unresolved' };
  }
  return chooseWriter('owner', funds);
}
