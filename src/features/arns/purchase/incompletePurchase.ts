import type { PendingArNSPurchase } from '../services/arnsPurchaseResume';
import { heldByPhrase, heldUntilFrom } from './actionFailure';

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
  /** Still waiting on the wallet; its credits are held until a refund. */
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
    case 'awaiting-signature':
      return {
        kind: 'waiting',
        name,
        // One sentence: what happens to the credits, and when.
        message: `Your purchase of ${displayName(name)} wasn't approved in your wallet. Its credits return to your balance ${heldByPhrase(
          heldUntilFrom(status.expiresAt, now),
          formatTime,
        )}.`,
      };
    default:
      // Unknown (the read failed, or an unexpected status): say nothing.
      return { kind: 'none' };
  }
}
