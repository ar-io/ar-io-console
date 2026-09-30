/**
 * Why a sponsored ArNS action failed, told in terms of the buyer's credits.
 *
 * A sponsored action runs in two requests. `POST /v1/arns/actions/<action>`
 * RESERVES the credits and returns a transaction for the owner to sign; that
 * transaction is only valid for roughly 60 to 90 seconds (its blockhash).
 * `expiresAt`, about 15 minutes out, is the REFUND deadline, not a signing
 * deadline. Then `POST /:nonce/sign` submits it. When that fails the credits
 * are in one of three states, and the copy has to say which:
 *
 * - Released: the service proved the transaction expired AND refunded it:
 *   409 whose body says "credits have been returned", or 400 "Action <nonce>
 *   expired and was refunded".
 * - Held: expired but not yet refunded (409 without that wording, 400
 *   "Action <nonce> expired at ..."), or the wallet declined after the action
 *   was created. The credits stay reserved until the reconciler refunds them,
 *   around `expiresAt`.
 * - Unconfirmed: 503 "Blockhash not found". The service returns 409 when it
 *   can PROVE expiry; 503 means it could not (a lagging RPC), and the signed
 *   transaction may still land. So this never says "nothing was charged".
 *
 * A new attempt while credits are held (or unconfirmed) often gets 402, which
 * is not "you have no credits" but "they are still reserved".
 *
 * Only a 400 naming THIS action ("Action <nonce> expired") is an action
 * expiry. The ArNS program's own 400s ("Lease has expired", "Record is
 * expired", "Reservation has expired") are ordinary failures.
 *
 * turbo-sdk 2.1.0-alpha.2 surfaces all of these as `FailedRequestError`
 * (`.status` plus "Failed request (Status N): body"). A later SDK is expected
 * to throw typed errors (`ArNSActionExpiredError` with `creditsReleased`);
 * those are recognised first when present.
 */

export type ActionFailureKind =
  /** The signing window closed and the credits are already back. */
  | 'expired-released'
  /** The attempt ended but its credits stay reserved until the refund. */
  | 'expired-held'
  /**
   * 503 "Blockhash not found": expiry could not be proved and the purchase
   * may still land. Treated as held for the 402 decision.
   */
  | 'unconfirmed'
  /** The wallet declined before anything was reserved: nothing to explain. */
  | 'rejected'
  /** 402: not enough credits (unless an earlier attempt is still held). */
  | 'insufficient'
  | 'other';

/** How long a held attempt may take to return when `expiresAt` is unknown. */
export const HELD_FALLBACK_MS = 20 * 60_000;
/**
 * Slack after `expiresAt` before a held attempt is assumed refunded. The
 * reconciler runs on a schedule, so the refund lands shortly AFTER expiry.
 */
export const HELD_GRACE_MS = 5 * 60_000;

function statusOf(err: unknown): number | undefined {
  const e = err as { status?: unknown; response?: { status?: unknown } } | null;
  const direct = e?.status ?? e?.response?.status;
  if (typeof direct === 'number') return direct;
  // turbo-sdk's FailedRequestError: "Failed request (Status 409): ...".
  const m = /\(Status (\d{3})\)/.exec(messageOf(err));
  return m ? Number(m[1]) : undefined;
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  const m = (err as { message?: unknown } | null)?.message;
  return typeof m === 'string' ? m : String(err);
}

function nameOf(err: unknown): string {
  const n = (err as { name?: unknown } | null)?.name;
  return typeof n === 'string' ? n : '';
}

/** A wallet declining to sign, across adapters and EIP-1193-style codes. */
export function isWalletRejection(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  if (code === 4001) return true;
  const name = nameOf(err);
  if (/WalletSign(Transaction|Message)Error|UserRejected/i.test(name)) return true;
  return /user rejected|rejected the request|request rejected|user denied|denied by user|user declined|user cancell?ed/i.test(
    messageOf(err),
  );
}

/** "Action <id> expired" naming this action, or any uuid-shaped id when unknown. */
function namesThisAction(msg: string, nonce: string | undefined): boolean {
  const m = /\bAction\s+([0-9A-Za-z-]{8,})\s+expired\b/.exec(msg);
  if (!m) return false;
  return nonce ? m[1] === nonce : true;
}

/**
 * Classify a failed sponsored action.
 *
 * `nonceCreated` says whether the create request succeeded (the SDK's
 * `onNonce` fired). A wallet rejection after that leaves credits held; before
 * it, nothing was reserved. `nonce`, when known, is matched against a 400's
 * "Action <nonce> expired" so an unrelated expiry is not mistaken for this one.
 */
export function classifyActionFailure(
  err: unknown,
  { nonceCreated, nonce }: { nonceCreated: boolean; nonce?: string },
): ActionFailureKind {
  // A future typed error says outright whether the credits were released.
  if (nameOf(err) === 'ArNSActionExpiredError') {
    const released = (err as { creditsReleased?: unknown }).creditsReleased;
    return released === true ? 'expired-released' : 'expired-held';
  }

  const status = statusOf(err);
  const msg = messageOf(err);

  if (status === 409 && /expired/i.test(msg)) {
    // 409 is proven expiry; refunded only when the body says so.
    return /credits have been returned/i.test(msg) ? 'expired-released' : 'expired-held';
  }
  if (status === 400 && namesThisAction(msg, nonce)) {
    return /expired and was refunded/i.test(msg) ? 'expired-released' : 'expired-held';
  }
  if (/blockhash not found/i.test(msg)) return 'unconfirmed';
  if (status === 402 || nameOf(err) === 'InsufficientCreditsError') return 'insufficient';

  if (isWalletRejection(err)) return nonceCreated ? 'expired-held' : 'rejected';

  return 'other';
}

/** An attempt whose credits are reserved until a refund. */
export interface HeldAttempt {
  nonce: string;
  /** The payer (session identity) whose credits are held. */
  payer: string;
  name: string;
  /** Epoch ms when the credits are expected back. */
  heldUntil: number;
  /** Whether `heldUntil` came from the action's `expiresAt`, or is a fallback. */
  untilKnown: boolean;
  /**
   * The purchase could not be confirmed either way (503 "Blockhash not
   * found"): it may still land, so the copy never says nothing was charged.
   */
  unconfirmed?: boolean;
}

/**
 * When a held attempt's credits come back: the action's `expiresAt` when the
 * status read gave one, else `now` plus the fallback.
 */
export function heldUntilFrom(
  expiresAt: unknown,
  now: number,
): { heldUntil: number; untilKnown: boolean } {
  const t =
    typeof expiresAt === 'number'
      ? expiresAt < 1e12
        ? expiresAt * 1000
        : expiresAt
      : typeof expiresAt === 'string'
        ? Date.parse(expiresAt)
        : Number.NaN;
  if (Number.isFinite(t) && t > now) return { heldUntil: t, untilKnown: true };
  return { heldUntil: now + HELD_FALLBACK_MS, untilKnown: false };
}

/** A held attempt still explains a 402 until its refund plus the grace. */
export function isHeldActive(held: HeldAttempt | undefined, payer: string | undefined, now: number): boolean {
  return !!held && !!payer && held.payer === payer && now < held.heldUntil + HELD_GRACE_MS;
}

/**
 * The 402 decision. A fresh attempt that finds no credits while an earlier
 * one is still held is explained by the hold, not sent to buy more credits.
 */
export function explainInsufficient({
  held,
  payer,
  now,
}: {
  held: HeldAttempt | undefined;
  payer: string | undefined;
  now: number;
}): 'held' | 'insufficient' {
  return isHeldActive(held, payer, now) ? 'held' : 'insufficient';
}

/** Default time formatter: the viewer's local HH:MM. */
function hhmm(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export const RELEASED_MESSAGE =
  'The approval window closed before it was submitted. Your credits are back; try again.';

/**
 * "Nothing was charged. The credits for that attempt are held until about
 * 14:05, ..." or, when the purchase could not be confirmed, the wording that
 * does not promise nothing was charged.
 */
export function heldMessage(
  held: Pick<HeldAttempt, 'heldUntil' | 'untilKnown' | 'unconfirmed'> | undefined,
  formatTime: (ms: number) => string = hhmm,
): string {
  if (held?.unconfirmed) {
    const by = held.untilKnown ? `by about ${formatTime(held.heldUntil)}` : 'within about 20 minutes';
    return `We couldn't confirm the purchase. Check My domains in a minute. If it didn't go through, the credits for this attempt return to your balance ${by}.`;
  }
  if (held?.untilKnown) {
    return `Nothing was charged. The credits for that attempt are held until about ${formatTime(held.heldUntil)}, then return to your balance.`;
  }
  return 'Nothing was charged. The credits for that attempt are held for up to 20 minutes, then return to your balance.';
}

/** "about 14:05", or "in up to 20 minutes" when the time is a fallback. */
export function heldUntilPhrase(
  held: Pick<HeldAttempt, 'heldUntil' | 'untilKnown'>,
  formatTime: (ms: number) => string = hhmm,
): string {
  return held.untilKnown ? `about ${formatTime(held.heldUntil)}` : 'in up to 20 minutes';
}

/**
 * The same failures on a record or owner write (set record, transfer,
 * controllers), where nothing is being bought: say that nothing changed, and
 * what happened to the credits if any were reserved.
 */
export function mapActionExpiryMessage(err: unknown): string | undefined {
  const kind = classifyActionFailure(err, { nonceCreated: true });
  if (kind === 'expired-released') {
    return 'The approval expired before it was submitted, so nothing changed. Your credits are back. Try again.';
  }
  if (kind === 'expired-held' && !isWalletRejection(err)) {
    return 'The approval expired before it was submitted, so nothing changed. The credits for it return to your balance within about 20 minutes. Try again.';
  }
  if (kind === 'unconfirmed') {
    return "We couldn't confirm the change. Check again in a minute. If it didn't go through, the credits for it return to your balance within about 20 minutes.";
  }
  return undefined;
}

const HELD_KEY = 'arns-held-attempt';

/** Read a held attempt from storage, dropping it once it has lapsed. */
export function readHeldAttempt(
  storage: Pick<Storage, 'getItem' | 'removeItem'> | undefined,
  now: number,
): HeldAttempt | undefined {
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(HELD_KEY);
    if (!raw) return undefined;
    const v = JSON.parse(raw) as Partial<HeldAttempt>;
    if (
      typeof v.nonce !== 'string' ||
      typeof v.payer !== 'string' ||
      typeof v.name !== 'string' ||
      typeof v.heldUntil !== 'number' ||
      typeof v.untilKnown !== 'boolean' ||
      (v.unconfirmed !== undefined && typeof v.unconfirmed !== 'boolean')
    ) {
      storage.removeItem(HELD_KEY);
      return undefined;
    }
    if (now >= v.heldUntil + HELD_GRACE_MS) {
      storage.removeItem(HELD_KEY);
      return undefined;
    }
    return v as HeldAttempt;
  } catch {
    return undefined;
  }
}

export function writeHeldAttempt(
  storage: Pick<Storage, 'setItem'> | undefined,
  held: HeldAttempt,
): void {
  try {
    storage?.setItem(HELD_KEY, JSON.stringify(held));
  } catch {
    // Private mode or a full quota: the in-memory copy still covers this tab.
  }
}

export function clearHeldAttempt(storage: Pick<Storage, 'removeItem'> | undefined): void {
  try {
    storage?.removeItem(HELD_KEY);
  } catch {
    // Nothing to do.
  }
}
