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

import type { FundFrom } from '@ar.io/sdk/solana';

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
   * Typed as the SDK's own union rather than `string`, so this object can be
   * passed to `buyRecord` with no cast. A cast here would silence the compiler
   * on a call that spends money — if this shape ever drifts from the SDK's,
   * that must be a build error, not a runtime surprise.
   */
  fundFrom?: FundFrom;
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
  fundFrom,
  isInsufficientCredits,
}: {
  fundFrom: FundFrom | undefined;
  isInsufficientCredits: boolean;
}): BuyErrorRoute {
  if (fundFrom === 'turbo' && isInsufficientCredits) return { kind: 'insufficient-credits' };
  return { kind: 'error' };
}

/** Status copy while the purchase is in flight. */
export function submittingMessage(name: string, type: BuyRegistrationType): string {
  return type === 'permabuy'
    ? `Registering '${name}' permanently and creating its ANT…`
    : `Registering '${name}' and creating its ANT…`;
}
