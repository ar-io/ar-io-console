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
  /** Owner on the credits route: Turbo fee-pays, credits are billed. */
  | 'owner'
  /** Owner holding SOL: signs and pays the network directly, the default. */
  | 'owner-sol'
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
  /**
   * The other rail, when it would also work for this owner, so the surface
   * can offer "pay with credits instead" (or SOL). Absent when there is no
   * real choice: a controller, a wallet without SOL, or credits short.
   */
  alternative?: Exclude<WriterKind, 'blocked'>;
}

/** Which rail the owner asked for, overriding the default when both work. */
export type WriterPreference = 'sol' | 'credits';

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
  /**
   * The SOL balance is still being read. The default rail now turns on it, so
   * the choice waits rather than showing credits and then switching rail, and
   * the cost sentence with it, under someone already reading it.
   */
  solLoading?: boolean;
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
 * SOL an owner must hold before the SOL rail is OFFERED for an action that
 * creates accounts (`ACCOUNT_CREATING_ACTIONS`): up to four rent-exempt ACL
 * accounts at roughly 0.001 SOL each, with room for the fee.
 */
export const MIN_SOL_FOR_ACCOUNT_CREATION = 0.005;

/**
 * Why a save cannot go through credits, and what would let it through: an
 * IPFS target or a priority is written only by the wallet's own transaction
 * (see `requiresSelfSigned` in recordFields).
 */
export const SELF_SIGNED_ONLY_NOTE =
  `IPFS targets and record priority are signed by your wallet, which pays the Solana fee. Add about ${MIN_SOL_FOR_RECORD_WRITE} SOL to the wallet that owns this name to save this.`;

/**
 * Owner-only actions that CREATE on-chain accounts, not merely pay a fee.
 *
 * `@ar.io/sdk`'s Solana `transfer` resolves the new owner's ACL accounts and
 * emits `register_acl_config` / `add_acl_page` when they are missing — so
 * sending a name to a wallet that has never held one bootstraps two rent-exempt
 * PDAs. It can also HEAL the old owner's entry (an ANT acquired by marketplace
 * transfer, or from before the ACL system), for up to four in one transaction.
 * `add-controller` bootstraps the same pair for a first-time controller.
 *
 * `remove-controller` creates nothing, which is why it is absent here.
 *
 * This is the whole reason {@link MIN_SOL_FOR_RECORD_WRITE} is as large as it
 * is, and the reason "pays the Solana network fee" was the wrong sentence to
 * show for these: a signature is ~0.000005 SOL, and rent-exemption is hundreds
 * of times that.
 */
export const ACCOUNT_CREATING_ACTIONS = ['transfer', 'add-controller'] as const;

export function createsAccounts(action: string): boolean {
  return (ACCOUNT_CREATING_ACTIONS as readonly string[]).includes(action);
}

/**
 * What paying in SOL actually costs, said before the user picks that rail.
 *
 * "Your wallet pays the Solana network fee" reads as a rounding error. For a
 * transfer it can be rent on up to four accounts, and someone holding a
 * fraction of a SOL has no way to know that from the sentence.
 */
export function selfSignedCostNote(action: string): string {
  if (!createsAccounts(action)) {
    return 'Your wallet pays the Solana fee in SOL, not credits.';
  }
  // The figure, not the reason: rent on accounts it may create is why.
  return `Your wallet pays up to about ${MIN_SOL_FOR_ACCOUNT_CREATION} SOL, not credits.`;
}

/**
 * Why the SOL rail is not on offer, for a wallet that would rather use it.
 *
 * The credits route says nothing about the alternative existing, so an owner
 * holding SOL sees a credits charge, no option, and no reason — which is
 * exactly how someone ends up asking why the app will not take their SOL.
 */
/** How to name an action mid-sentence, so the caveat says which one it is. */
const ACTION_GERUND: Record<string, string> = {
  transfer: 'transferring',
  'add-controller': 'adding a controller',
  'remove-controller': 'removing a controller',
};

export function solRailRequirementNote(
  action: string,
  /**
   * A second action priced on the same screen — the controllers modal offers
   * add and remove together.
   *
   * Taken into account because the two differ: adding bootstraps the
   * controller's ACL accounts, removing creates nothing. Deriving the caveat
   * from `action` alone made the remove flow inherit a rent warning it does
   * not owe.
   */
  secondaryAction?: string,
): string {
  /*
    Phrased as the alternative, not as a second opinion on SOL. Following "you
    don't need SOL" with "paying in SOL needs SOL" read as the line arguing
    with itself; "to sign it yourself instead" makes it the other option.
  */
  const creating = [action, secondaryAction].filter(
    (a): a is string => !!a && createsAccounts(a),
  );
  const need =
    creating.length > 0 ? MIN_SOL_FOR_ACCOUNT_CREATION : MIN_SOL_FOR_RECORD_WRITE;
  const base = `To pay with SOL instead, the owning wallet needs about ${need} SOL`;
  if (creating.length === 0) return `${base}.`;

  // Name the culprit when only one of the two creates anything, so the other
  // is not tarred with a cost it never incurs.
  const which =
    creating.length === 1 && secondaryAction
      ? (ACTION_GERUND[creating[0]] ?? 'that')
      : 'this';
  return `${base}, because ${which} creates accounts on chain.`;
}

/**
 * The writer for a record change, given the wallet's role and what it holds.
 *
 * An owner holding SOL signs and pays the network directly by DEFAULT. The two
 * rails cost very different amounts: a record save was 0.108 credits on
 * production when this was written, tens of cents, while signing it yourself
 * costs a Solana fee, usually a fraction of a cent (plus rent where a write
 * creates an account). Defaulting to credits charged the people who could least afford
 * to notice it the most, with no visible way out.
 *
 * Credits remain the rail for everyone else: a wallet with no SOL (every
 * email sign-in starts there), and an owner who prefers it. When both rails
 * would work, `alternative` says so and `preference` lets the owner switch.
 * When neither would, the choice says so before the click.
 *
 * `funds` absent means "role only" (see {@link writerForRole}): the credits
 * rail, as before, for callers that cannot wait on a balance.
 */
export function chooseWriter(
  role: StrictAntRole,
  funds?: WriterFunds,
  preference?: WriterPreference,
  rail: {
    /** SOL the owner must hold for the SOL rail to count as payable. */
    minSol?: number;
  } = {},
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

  if (!funds) return { kind: 'sponsored', reason: 'owner' };
  if (funds.solLoading && funds.sol === undefined) {
    return { kind: 'blocked', reason: 'unresolved' };
  }

  const { credits, priceCredits: price, sol } = funds;
  // An unread SOL balance is not SOL: it never routes anyone onto that rail.
  const solOk =
    sol !== undefined && sol >= (rail.minSol ?? MIN_SOL_FOR_RECORD_WRITE);
  /*
    Only a KNOWN shortfall rules credits out. Both figures load
    asynchronously, and treating "not yet" as "can't afford it" would flip
    the route under a user who is already reading the note.
  */
  const creditsOk =
    credits === undefined || price === undefined || credits >= price;

  if (solOk && creditsOk) {
    return preference === 'credits'
      ? { kind: 'sponsored', reason: 'owner', alternative: 'self-signed' }
      : { kind: 'self-signed', reason: 'owner-sol', alternative: 'sponsored' };
  }
  if (solOk) return { kind: 'self-signed', reason: 'insufficient-credits' };
  if (creditsOk) return { kind: 'sponsored', reason: 'owner' };
  /*
    Neither will cover it. Still the credits route, since there is nothing
    better to route to, but flagged so the editor can say so up front rather
    than letting them fill in a record and meet the failure on save.
  */
  return { kind: 'sponsored', reason: 'insufficient-both' };
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
      return reason === 'owner-sol'
        ? 'Your wallet signs this and pays the Solana network fee in SOL.'
        : reason === 'insufficient-credits'
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
  preference?: WriterPreference,
  /** The action, so one that creates accounts keeps credits as its default. */
  action?: string,
): WriterChoice {
  if (role !== 'owner') {
    return { kind: 'blocked', reason: 'unresolved' };
  }
  /*
    A transfer can create rent-exempt accounts for up to four ACL entries in
    one transaction, and adding a controller two: each far more than the fee
    `MIN_SOL_FOR_RECORD_WRITE` budgets for. So SOL is the default for them
    too, but only above the account-creation threshold; below it a wallet
    would be handed a transaction it might not fund, and credits stay.
  */
  return chooseWriter(
    'owner',
    funds,
    preference,
    action && createsAccounts(action)
      ? { minSol: MIN_SOL_FOR_ACCOUNT_CREATION }
      : {},
  );
}
