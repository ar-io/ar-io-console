/**
 * Who holds a name's ANT, and therefore what can be done with it.
 *
 * ArNS splits into two kinds of operation, and custody only affects one:
 *
 * - **Registry** operations (extend a lease, upgrade to permabuy, add undername
 *   slots) are payments against the ARIO registry. Anyone can pay to extend any
 *   name, so these work no matter who holds the ANT.
 * - **ANT** operations (records, controllers, metadata, transfer, release)
 *   mutate the Metaplex Core asset itself and require its OWNER to sign.
 *
 * When Turbo holds the ANT the user cannot sign for it. Turbo exposes exactly
 * three operations on their behalf — set-record, remove-record and transfer —
 * so everything else is genuinely impossible until the name is transferred out,
 * not merely unimplemented. Saying so is the difference between a disabled
 * control with a reason and a button that fails.
 */
export type NameCustody = 'user-owned' | 'turbo-custodial' | 'unknown';

export type ArNSAction =
  // ANT operations — need the ANT owner's signature.
  | 'set-record'
  | 'remove-record'
  | 'transfer'
  | 'controllers'
  | 'details'
  | 'release'
  | 'primary-name'
  /** Repoint the name at a different ANT — the current ANT's owner signs. */
  | 'reassign'
  // Registry operations — a payment, not an ANT mutation.
  | 'extend'
  | 'upgrade'
  | 'increase-undernames';

export type ActionAvailability =
  /** The user's own wallet signs it. */
  | { kind: 'signer' }
  /** Turbo performs it on their behalf (custodial routes). */
  | { kind: 'turbo' }
  /** Not possible in this custody state; `reason` is shown to the user. */
  | { kind: 'unavailable'; reason: string };

/** Registry payments are unaffected by who holds the ANT. */
const REGISTRY_ACTIONS: ReadonlySet<ArNSAction> = new Set<ArNSAction>([
  'extend',
  'upgrade',
  'increase-undernames',
]);

/** The only ANT operations Turbo will perform for a custodied name. */
const TURBO_CUSTODIAL_ACTIONS: ReadonlySet<ArNSAction> = new Set<ArNSAction>([
  'set-record',
  'remove-record',
  'transfer',
]);

const TRANSFER_FIRST = 'Transfer this name to your wallet to change this.';

export function actionAvailability(
  action: ArNSAction,
  custody: NameCustody,
): ActionAvailability {
  // A payment against the registry — never blocked by custody.
  if (REGISTRY_ACTIONS.has(action)) return { kind: 'signer' };

  if (custody === 'turbo-custodial') {
    if (TURBO_CUSTODIAL_ACTIONS.has(action)) return { kind: 'turbo' };
    return { kind: 'unavailable', reason: TRANSFER_FIRST };
  }

  // `unknown` is treated as user-owned: it is overwhelmingly the common case
  // (custodial names only arise from a card purchase with no Solana wallet),
  // and the failure modes are asymmetric — offering a control that turns out to
  // need a transfer shows an error, whereas hiding controls on a name the user
  // genuinely owns makes the app look broken with no way forward.
  return { kind: 'signer' };
}

/** Convenience for rendering: is this control usable at all? */
export function isActionAvailable(
  action: ArNSAction,
  custody: NameCustody,
): boolean {
  return actionAvailability(action, custody).kind !== 'unavailable';
}

/**
 * Custody from the flag on a Turbo `getArNSNames` row.
 *
 * That endpoint is receipt history, not a live ownership check: a name appears
 * because it was PURCHASED through Turbo, and `custodial: false` covers both a
 * self-custody purchase and one since transferred out. A `false` therefore
 * means "not held by Turbo", which is what we need — but ABSENCE from the list
 * means nothing at all, so a missing row is `unknown`, never `user-owned`.
 */
export function custodyFromTurboName(
  row: { custodial?: boolean } | undefined,
): NameCustody {
  if (row === undefined) return 'unknown';
  return row.custodial ? 'turbo-custodial' : 'user-owned';
}
