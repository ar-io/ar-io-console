/**
 * Which writer performs a record change, and why the user is told what it costs.
 *
 * Turbo sponsors record writes for the ANT's OWNER only — the service verifies
 * the owner proof against the current on-chain owner, so a controller's
 * signature is rejected. Controllers keep the capability; they pay their own
 * Solana fee for it.
 *
 * `unknown` blocks rather than guesses. Guessing sponsored for a controller
 * spends a wallet prompt on a request that will 401; guessing self-signed for
 * an owner asks them to pay a fee they do not owe. Waiting for the answer costs
 * a moment; either wrong guess costs the user something real.
 */
import type { StrictAntRole } from '../antRole';

export type WriterKind = 'sponsored' | 'self-signed' | 'blocked';

export function writerForRole(role: StrictAntRole): WriterKind {
  switch (role) {
    case 'owner':
      return 'sponsored';
    case 'controller':
      return 'self-signed';
    case 'none':
    case 'unknown':
      return 'blocked';
  }
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
): string | undefined {
  switch (kind) {
    case 'sponsored': {
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
      // Said plainly rather than apologetically: they control this name but do
      // not own it, so Turbo does not cover their Solana fee.
      return 'You control this name but don’t own it, so your wallet pays the Solana fee on each change.';
    case 'blocked':
      return undefined;
  }
}
