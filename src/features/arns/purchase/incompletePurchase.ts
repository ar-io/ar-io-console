import type { PendingArNSPurchase } from '../services/arnsPurchaseResume';
import { heldByPhrase, heldUntilFrom, type HeldAttempt } from './actionFailure';

/**
 * What "your names" should say about a purchase that was started but not
 * seen to finish: the browser left mid-approval, the prompt was closed, or
 * the approval came too late.
 *
 * The purchase is the one `useBuyArNSName` saves before the wallet opens
 * (`savePendingArNSPurchase`), and its outcome is read live from
 * `GET /v1/arns/actions/:nonce`, so nothing here is guessed. Without it a
 * buyer whose attempt quietly expired saw "No domains yet" and concluded
 * they had paid for nothing.
 */
export type IncompletePurchase =
  | { kind: 'none' }
  /** It went through, or the name is already listed: clear it and refresh. */
  | { kind: 'completed'; name: string }
  /**
   * Not finished, its credits held until Turbo refunds or completes it.
   * Turbo reports `awaiting-signature` from create until the purchase lands,
   * including after the wallet DID approve, so this never says what the
   * wallet did.
   */
  | { kind: 'waiting'; name: string; message: string }
  /** Expired and refunded: say so, and offer to try again. */
  | { kind: 'expired'; name: string; message: string };

export function incompletePurchase({
  pending,
  address,
  ownedNames,
  status,
  now,
  formatTime,
  displayName = (n) => `${n}.ar.io`,
  held,
}: {
  pending: PendingArNSPurchase | undefined;
  /** The wallet "your names" is showing; only its own purchase is shown. */
  address: string | undefined;
  ownedNames: readonly { name: string }[];
  /** The action's status record, or undefined while unknown. */
  status: Record<string, unknown> | undefined;
  now: number;
  formatTime?: (ms: number) => string;
  /** How to show the name in the sentence; defaults to `<name>.ar.io`. */
  displayName?: (name: string) => string;
  /**
   * The held attempt `useBuyArNSName` recorded, if any. When it is this
   * purchase and marked unconfirmed (the wallet approved, then the outcome
   * could not be confirmed), the copy says exactly that: it may yet land.
   */
  held?: Pick<HeldAttempt, 'nonce' | 'unconfirmed'>;
}): IncompletePurchase {
  /*
    Only a credits purchase has an action to read. A returned-name auction
    saves a processId in the same slot, for a different reason (reusing its
    spawned ANT), and is not ours to report on.
  */
  if (!pending?.nonce || pending.intent !== 'Buy-Name' || !address) {
    return { kind: 'none' };
  }
  if (pending.owner !== address) return { kind: 'none' };

  const name = pending.name;
  if (ownedNames.some((n) => n.name.toLowerCase() === name.toLowerCase())) {
    return { kind: 'completed', name };
  }

  switch (status?.status) {
    case 'completed':
      return { kind: 'completed', name };
    case 'expired':
      return {
        kind: 'expired',
        name,
        message: `Your purchase of ${displayName(name)} didn't go through, and its credits are back in your balance.`,
      };
    case 'awaiting-signature': {
      const by = heldByPhrase(heldUntilFrom(status.expiresAt, now), formatTime);
      const unconfirmed = held?.nonce === pending.nonce && held.unconfirmed;
      return {
        kind: 'waiting',
        name,
        message: unconfirmed
          ? `We couldn't confirm your purchase of ${displayName(name)}. If it didn't go through, its credits return to your balance ${by}.`
          : `Your purchase of ${displayName(name)} didn't finish. Its credits return to your balance ${by}.`,
      };
    }
    default:
      // Unknown (the read failed, or an unexpected status): say nothing.
      return { kind: 'none' };
  }
}
