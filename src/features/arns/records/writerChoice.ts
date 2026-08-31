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

/** What this wallet's edits will cost, for the note above the records editor. */
export function writerCostNote(kind: WriterKind): string | undefined {
  switch (kind) {
    case 'sponsored':
      return 'Saving a record is free. Your wallet will ask you to approve a message — it costs nothing and needs no SOL.';
    case 'self-signed':
      // Said plainly rather than apologetically: they control this name but do
      // not own it, and Turbo covers the owner's fees only.
      return 'You control this name but don’t own it, so your wallet pays the Solana fee on each change.';
    case 'blocked':
      return undefined;
  }
}
