import { arNSActions, type ArNSAction } from '@ardrive/turbo-sdk/web';

/**
 * Which ArNS operations Turbo sponsors, and what each one asks of the user.
 *
 * This exists for COPY, not for control flow. turbo-sdk owns the protocol and
 * decides per request whether a signature is needed — and the answer changes
 * with state: a record write completes Turbo-alone while Turbo holds the
 * controller grant, and starts requiring the owner's signature the moment the
 * user revokes it. Nothing here may become a branch; the SDK's return value is
 * the only thing that knows.
 *
 * What the UI genuinely needs from this file is the ability to tell the truth
 * about cost before the user commits.
 */

/** The nine sponsored actions, taken from the SDK so the list cannot drift. */
export const SPONSORED_ACTIONS: readonly ArNSAction[] = arNSActions;

/**
 * ArNS operations Turbo does NOT sponsor.
 *
 * These have no action on the sponsored surface. They stay on the direct-signer
 * path and the user pays their own SOL. Console ships UI for every one of them
 * (`usePrimaryNameActions`, `useReleaseName`, `useReassignArNSName`,
 * `useSetArNSMetadata`/`useAntLogos`), which is exactly why the interface must
 * say WHICH operations are sponsored rather than making a blanket claim.
 *
 * Setting a primary name is common enough that "you never need SOL" gets quoted
 * back at us the first time a wallet asks for rent — the failure mode the style
 * guide's "never claim away a real requirement" rule is about.
 */
export const UNSPONSORED_OPERATIONS = [
  'primary-name',
  'release-name',
  'reassign',
  /*
    The name's OWN details — nickname, ticker, description, keywords, logo.

    Distinct from RECORD metadata, which `set-record-metadata` does sponsor,
    and the two sit next to each other in the program. Same-looking fields,
    different bill: editing a record's display name is free, editing the
    name's own is not. Label them so nobody has to discover that at a wallet
    prompt.
  */
  'ant-metadata',
  /*
    Auctions, deliberately excluded — the premium is unbounded, so Turbo will
    not front it. The costliest exception by far: ARIO-funded, ~0.02 SOL, and
    the only flow with two wallet approvals.
  */
  'buy-returned-name',
] as const;

export type UnsponsoredOperation = (typeof UNSPONSORED_OPERATIONS)[number];

export function isSponsoredAction(value: string): value is ArNSAction {
  return (SPONSORED_ACTIONS as readonly string[]).includes(value);
}

export interface SponsoredActionFacts {
  /**
   * Debits the payer's Turbo Credits.
   *
   * ALL twelve do. The eight non-purchase actions were free at launch and now
   * carry a small margin (ar-io-bundler#303) — the SDK's doc comments still say
   * "free", and they are stale. The amount is per-environment and must be
   * fetched (`useArNSActionPrice`), never assumed: removing a record is 0 on
   * testnet and 0.05 credits on production.
   */
  costsCredits: boolean;
  /**
   * What to TELL the user to expect — never what to branch on.
   *
   * `'transaction'` opens the wallet to sign a transaction, `'message'` to
   * approve an offline message, `'conditional'` means it depends on whether
   * Turbo still holds the controller grant, `'none'` means no prompt at all.
   */
  expectedPrompt: 'transaction' | 'message' | 'conditional' | 'none';
  /**
   * Needs the owner's action-bound proof, unconditionally — including while
   * Turbo is a controller.
   *
   * True for the two record actions. So a record write always costs the user a
   * wallet interaction. It is a MESSAGE signature: offline, instant, no SOL.
   * Say "approve a message"; never say "one click".
   */
  requiresOwnerProof: boolean;
}

export const SPONSORED_ACTION_FACTS: Record<ArNSAction, SponsoredActionFacts> = {
  /*
    The only action that always needs a transaction signature — and one
    signature is all it needs. ANT creation, initialization and the grant of
    Turbo as controller all ride in that same transaction, because adding a
    controller requires the owner's signature and this is the only one they
    give. The grant is operator-gated, so treat it as expected, never assumed.
  */
  'buy-name': {
    costsCredits: true,
    expectedPrompt: 'transaction',
    requiresOwnerProof: false,
  },
  // Registry payments against a name that already exists. They mint nothing, so
  // they carry no ANT-spawn surcharge and need no signature from the owner.
  'extend-lease': {
    costsCredits: true,
    expectedPrompt: 'none',
    requiresOwnerProof: false,
  },
  'upgrade-name': {
    costsCredits: true,
    expectedPrompt: 'none',
    requiresOwnerProof: false,
  },
  'increase-undername-limit': {
    costsCredits: true,
    expectedPrompt: 'none',
    requiresOwnerProof: false,
  },
  // Free to the user. Completes Turbo-alone while the grant stands; needs the
  // owner's transaction signature once it is revoked.
  'set-record': {
    costsCredits: true,
    expectedPrompt: 'conditional',
    requiresOwnerProof: true,
  },
  'remove-record': {
    costsCredits: true,
    expectedPrompt: 'conditional',
    requiresOwnerProof: true,
  },
  /*
    ANT authority changes. Only the owner can grant or revoke, so these always
    need their transaction signature. Revoking is free and costs no SOL —
    surface it plainly rather than burying it: revocability is what makes the
    controller grant safe to accept in the first place.
  */
  'add-controller': {
    costsCredits: true,
    expectedPrompt: 'transaction',
    requiresOwnerProof: false,
  },
  'remove-controller': {
    costsCredits: true,
    expectedPrompt: 'transaction',
    requiresOwnerProof: false,
  },
  transfer: {
    costsCredits: true,
    expectedPrompt: 'transaction',
    requiresOwnerProof: false,
  },
  /*
    Record-scoped metadata, sponsored as of alpha.11. Free, and needing the
    owner's proof like any record write — so a save that changes BOTH the
    target and the metadata costs two approvals, because they are two actions.
  */
  'set-record-metadata': {
    costsCredits: true,
    expectedPrompt: 'conditional',
    requiresOwnerProof: true,
  },
  'remove-record-metadata': {
    costsCredits: true,
    expectedPrompt: 'conditional',
    requiresOwnerProof: true,
  },
  /*
    Hands over ONE record, not the name. `transfer` moves the whole thing and
    every record on it; confusing the two gives away far more than intended,
    so they must never share confirmation copy.
  */
  'transfer-record': {
    costsCredits: true,
    expectedPrompt: 'transaction',
    requiresOwnerProof: false,
  },
};

/** True when this action moves credits — drives whether to show a price at all. */
export function actionCostsCredits(action: ArNSAction): boolean {
  return SPONSORED_ACTION_FACTS[action].costsCredits;
}
