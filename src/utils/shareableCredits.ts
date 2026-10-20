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

/**
 * The winc to approve for a share of `credits`, never above `shareableWinc`.
 *
 * Credits are a float in the form, so sharing "the max" round-trips through
 * floating point and can land a winc or two above the balance, which the
 * service refuses. Clamping here makes "share everything" always succeed.
 */
export function toApprovedWinc(credits: number, shareableWinc: bigint): bigint {
  if (!Number.isFinite(credits) || credits <= 0) return 0n;
  const requested = BigInt(Math.round(credits * wincPerCredit));
  return requested > shareableWinc ? shareableWinc : requested;
}
