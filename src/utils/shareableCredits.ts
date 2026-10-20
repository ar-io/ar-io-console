import { wincPerCredit } from '../constants';

/**
 * What a wallet can share, as opposed to what it can spend.
 *
 * The payment service reports two balances, and the app's global
 * `creditBalance` is the larger one: `effectiveBalance`, which adds credits
 * other wallets shared with this one so uploads can draw on them. Those
 * received credits can be spent but not re-shared, so a share page reading
 * `creditBalance` offers more than the service will approve. `winc` is the
 * figure turbo-sdk documents as what a user "can currently spend or share".
 */
export interface ShareableBalance {
  /** Owned winc the wallet can share now. */
  shareableWinc: bigint;
  /** Winc remaining on approvals other wallets gave this one: spendable, not shareable. */
  receivedWinc: bigint;
  /** Winc this wallet has approved to others and not yet had spent or revoked. */
  sharedOutWinc: bigint;
}

function toWinc(value: unknown): bigint {
  if (typeof value === 'bigint') return value > 0n ? value : 0n;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? BigInt(Math.floor(value)) : 0n;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return BigInt(value.trim());
  return 0n;
}

/**
 * Splits a `/v1/account/balance` response into what can be shared and what
 * can't. Missing fields read as zero, which is what an account that has never
 * shared or received credits returns (and what `getTurboBalance` returns on a
 * 404).
 */
export function toShareableBalance(balance: {
  winc?: unknown;
  controlledWinc?: unknown;
  effectiveBalance?: unknown;
} | null | undefined): ShareableBalance {
  const winc = toWinc(balance?.winc);
  const controlled = toWinc(balance?.controlledWinc);
  const effective = toWinc(balance?.effectiveBalance);
  return {
    shareableWinc: winc,
    receivedWinc: effective > winc ? effective - winc : 0n,
    sharedOutWinc: controlled > winc ? controlled - winc : 0n,
  };
}

/**
 * For display and form input only. `Number` loses precision above
 * Number.MAX_SAFE_INTEGER winc (about 9,007 credits), so never decide an
 * approval from this; `toApprovedWinc` compares as bigint.
 */
export function wincToCredits(winc: bigint): number {
  return Number(winc) / wincPerCredit;
}

const WINC_DECIMALS = String(wincPerCredit).length - 1; // 12

/**
 * Credits as typed ("5", "0.25", ".5", "3."), in winc, parsed as a decimal
 * string so nothing passes through floating point: `Number` turns some
 * four-place figures above ~9,000 credits into a winc more than they say.
 * Digits past the twelfth place round half up. Undefined for anything else.
 */
export function parseCreditsToWinc(text: string): bigint | undefined {
  const m = /^(\d*)(?:\.(\d*))?$/.exec(text.trim());
  if (!m || (m[1] === '' && !m[2])) return undefined;
  const frac = m[2] ?? '';
  const kept = frac.slice(0, WINC_DECIMALS).padEnd(WINC_DECIMALS, '0');
  const roundUp = frac.length > WINC_DECIMALS && frac[WINC_DECIMALS] >= '5' ? 1n : 0n;
  return BigInt(m[1] || '0') * BigInt(wincPerCredit) + BigInt(kept) + roundUp;
}

/** A credits figure that is already a number (not typed), in winc. */
function numberToWinc(credits: number): bigint | undefined {
  if (!Number.isFinite(credits) || credits < 0) return undefined;
  return BigInt(Math.round(credits * wincPerCredit));
}

const WINC_PER_TEN_THOUSANDTH = BigInt(wincPerCredit) / 10_000n;

/**
 * Winc as credits to four places, rounded DOWN, worked in bigint. Rounding
 * down means a figure the user copies into the form (or that Max fills in)
 * never exceeds the balance; doing it in floating point turned 37.4622 into
 * 37.4621.
 */
export function formatCreditsFloor(winc: bigint): string {
  const units = (winc > 0n ? winc : 0n) / WINC_PER_TEN_THOUSANDTH;
  return `${units / 10_000n}.${(units % 10_000n).toString().padStart(4, '0')}`;
}

/**
 * The winc to approve for a share of `credits`, never above `shareableWinc`.
 * Pass the form's text where there is one (`parseCreditsToWinc`, exact).
 *
 * The clamp is a backstop: a number can round-trip through floating point and
 * land a winc or two above the balance, which the service refuses. Clamping
 * here makes "share everything" always succeed.
 */
export function toApprovedWinc(credits: number | string, shareableWinc: bigint): bigint {
  const requested = (typeof credits === 'string' ? parseCreditsToWinc(credits) : numberToWinc(credits)) ?? 0n;
  return requested > shareableWinc ? shareableWinc : requested;
}

/** One approval as `/v1/account/balance` lists it (turbo-sdk `CreditShareApproval`). */
export interface ApprovalLike {
  approvedAddress?: string;
  payingAddress?: string;
  approvedWincAmount?: unknown;
  usedWincAmount?: unknown;
  creationDate?: string;
  expirationDate?: string;
}

/** Every approval between this wallet and one other wallet, in one direction. */
export interface ShareRow {
  /** The other wallet: the recipient of a given share, the granter of a received one. */
  address: string;
  approvedWinc: bigint;
  usedWinc: bigint;
  remainingWinc: bigint;
  /** The soonest expiry among these approvals; undefined when none expire. */
  soonestExpiry?: string;
  /** How many approvals the row stands for. */
  count: number;
}

const time = (iso?: string) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : undefined;
};

/**
 * Groups approvals by the other wallet, newest first, dropping any that have
 * expired.
 *
 * Grouping is not cosmetic for given shares: `revokeCredits` takes an address
 * and revokes every approval to it, so a Revoke button on a single approval
 * would revoke more than its row shows.
 */
export function toShareRows(
  approvals: ApprovalLike[] | null | undefined,
  direction: 'given' | 'received',
  now: number = Date.now(),
): ShareRow[] {
  const rows = new Map<string, ShareRow>();
  const newest = new Map<string, number>();
  for (const a of approvals ?? []) {
    const address = direction === 'given' ? a.approvedAddress : a.payingAddress;
    if (!address) continue;
    const expires = time(a.expirationDate);
    if (expires !== undefined && expires <= now) continue;

    const approved = toWinc(a.approvedWincAmount);
    const used = toWinc(a.usedWincAmount);
    const row = rows.get(address) ?? {
      address,
      approvedWinc: 0n,
      usedWinc: 0n,
      remainingWinc: 0n,
      count: 0,
    };
    row.approvedWinc += approved;
    row.usedWinc += used;
    row.remainingWinc += approved > used ? approved - used : 0n;
    row.count += 1;
    newest.set(address, Math.max(newest.get(address) ?? 0, time(a.creationDate) ?? 0));
    if (expires !== undefined && (row.soonestExpiry === undefined || expires < time(row.soonestExpiry)!)) {
      row.soonestExpiry = a.expirationDate;
    }
    rows.set(address, row);
  }
  return [...rows.values()].sort((x, y) => newest.get(y.address)! - newest.get(x.address)!);
}

/** Whether `candidate` is `own`, ignoring the case of a 0x address. */
export function isSameWallet(candidate: string, own: string | null | undefined): boolean {
  if (!own) return false;
  const a = candidate.trim();
  return /^0x/i.test(a) ? a.toLowerCase() === own.toLowerCase() : a === own;
}

/**
 * A share or revoke failure in words a person can act on. Both go through
 * turbo-sdk's `uploadFile`, so a service refusal arrives wrapped as "Failed to
 * upload file after N attempts Failed request (Status 400): <reason>", which
 * reads like a crash rather than a refusal.
 */
export function shareFailureMessage(err: unknown, action: 'share' | 'revoke'): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const verb = action === 'share' ? 'share credits' : 'revoke that share';
  if (/insufficient balance/i.test(raw)) {
    return `Couldn't ${verb}: the payment service says this wallet doesn't have enough credits for it. Your balance may have changed; it has been refreshed.`;
  }
  if (/user (rejected|denied|cancel)|cancelled|canceled|rejected the request/i.test(raw)) {
    return `Nothing was ${action === 'share' ? 'shared' : 'revoked'}: the signature request was cancelled.`;
  }
  const reason = raw
    .replace(/^Failed to upload file after \d+ attempts?\s*/i, '')
    .replace(/^Failed request \(Status (\d+)\):\s*/i, '')
    .trim();
  return reason ? `Couldn't ${verb}: ${reason}` : `Couldn't ${verb}. Try again.`;
}
