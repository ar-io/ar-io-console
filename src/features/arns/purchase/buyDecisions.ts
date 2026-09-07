/**
 * The pure decisions inside a name purchase, lifted out of `useBuyArNSName`.
 *
 * Extracted so they can be tested at all: this repo's vitest harness runs in the
 * node environment with no DOM, so anything left inside a hook is untestable.
 * These are also the pieces most likely to break silently when the async fiat
 * path is added, which is why they are pinned before that work starts.
 *
 * Behaviour here is a faithful lift of the existing implementation — if a test
 * below needs changing to make a future refactor pass, that is a regression,
 * not a stale test.
 */

import type { ArioFundFrom } from './settlementMechanism';

import type { ArNSSettlementResult } from '../services/TurboArNSClient';

export type BuyRegistrationType = 'lease' | 'permabuy';

/** Shape of the `@ar.io/sdk` buyRecord response we actually read. */
export interface BuyRecordResponseLike {
  id?: string;
  result?: { processId?: string | null } | null;
}

/**
 * Args for `@ar.io/sdk`'s `buyRecord`.
 *
 * `processId` is deliberately never set: omitting it makes buyRecord mint the
 * ANT and assign the name in ONE transaction, which is what removes the
 * orphaned-ANT window a pre-spawn would open (see useBuyArNSName's comment).
 *
 * `years` must be absent — not undefined-valued — for a permabuy, which is why
 * this spreads conditionally rather than always setting the key.
 */
export interface BuyRecordArgs {
  name: string;
  type: BuyRegistrationType;
  /** Present only for a lease with a term — see the note above. */
  years?: number;
  /**
   * Narrowed to the sources `buyRecord` ACTS on.
   *
   * The SDK's own union also contains `'turbo'`, which it accepts and then
   * ignores — every Solana branch treats it as `'balance'` and debits the
   * wallet's ARIO. Excluding it here makes "pay with credits through the ARIO
   * SDK" a build error rather than a silent mischarge; credits settle through
   * turbo-sdk, which this function has nothing to do with.
   */
  fundFrom?: ArioFundFrom;
  referrer: string;
  /**
   * Initial ANT metadata and `@` target, applied on the atomic buy path.
   * Ignored when a `processId` is supplied, since that ANT already exists.
   */
  antState?: { transactionId?: string };
}

/**
 * Where a freshly bought name points before its owner sets anything.
 *
 * Without an explicit `antState.transactionId`, the SDK falls back to
 * `DEFAULT_ANT_TRANSACTION_ID` — which is the AR.IO **logo** image, chosen only
 * because an empty string fails the on-chain `is_valid_arweave_id` check. It is
 * a validation placeholder, not a destination, so a brand-new name resolved to
 * a picture of a logo. This points it at the real landing page instead.
 */
export const DEFAULT_ARNS_TARGET_TX =
  'T9_V2HfiAq5qlLzObfyayj2-cjPujxpg25TRi4OZbe4';

export function buildBuyRecordArgs({
  name,
  type,
  years,
  fundFrom,
  referrer,
}: BuyRecordArgs & { years?: number }): BuyRecordArgs {
  return {
    name,
    type,
    ...(type === 'lease' && years ? { years } : {}),
    fundFrom,
    referrer,
    // Only meaningful on the atomic path (no `processId`), which is the one
    // this app uses — a supplied ANT keeps whatever target it already has.
    antState: { transactionId: DEFAULT_ARNS_TARGET_TX },
  };
}

/**
 * Normalise a buyRecord response into the settlement shape the UI consumes.
 *
 * `nonce` is empty by design on this path: the purchase is a direct on-chain
 * write, so there is no server-side purchase record to poll. A fiat purchase
 * WILL have a nonce — that difference is the seam the async lifecycle hangs on.
 */
export function toSettlement(res: BuyRecordResponseLike | null | undefined): ArNSSettlementResult {
  return {
    nonce: '',
    messageId: res?.id ?? '',
    receipt: { processId: res?.result?.processId ?? null },
  };
}

export type BuyErrorRoute =
  /** Offer the Turbo-Credits top-up: they were paying with credits and ran out. */
  | { kind: 'insufficient-credits' }
  /** Everything else surfaces as a normal error and rethrows. */
  | { kind: 'error' };

/**
 * Decide how a failed purchase is surfaced.
 *
 * The `fundFrom === 'turbo'` guard is load-bearing: on the ARIO path an
 * insufficient-funds error is an ARIO shortfall, and offering to buy Turbo
 * Credits would not resolve it. Routing it to Top-Up would send the user to
 * spend money that cannot fix their problem.
 */
export function routeBuyError({
  mechanism,
  isInsufficientCredits,
}: {
  /**
   * Keyed on the settlement MECHANISM, not on `fundFrom`.
   *
   * It used to test `fundFrom === 'turbo'` — a value `@ar.io/sdk` accepts and
   * ignores, so it never described what actually happened. Only a real credits
   * settlement can run out of credits; on the ARIO path a shortfall is an ARIO
   * shortfall, and offering a credits top-up would not resolve it.
   */
  mechanism: 'ario-direct' | 'turbo-credits';
  isInsufficientCredits: boolean;
}): BuyErrorRoute {
  if (mechanism === 'turbo-credits' && isInsufficientCredits) {
    return { kind: 'insufficient-credits' };
  }
  return { kind: 'error' };
}

/** Status copy while the purchase is in flight. */
export function submittingMessage(name: string, type: BuyRegistrationType): string {
  /*
    "creating its ANT" was both jargon and, now, wrong: Turbo mints the name,
    the buyer does not. What they are waiting on is the registration, so say
    that and nothing else.
  */
  return type === 'permabuy'
    ? `Registering ${name} permanently…`
    : `Registering ${name}…`;
}
