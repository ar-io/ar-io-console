/**
 * Where a freshly registered name points on its first block.
 *
 * A name's `@` record can be set at mint — `ANT.spawn`'s `state.transactionId`
 * on the spawn-and-settle paths, `antState.transactionId` on the atomic
 * `buyRecord` one — so a buyer who already has something on Arweave never needs
 * a second write to point at it. Left alone, this resolves to
 * `DEFAULT_ARNS_TARGET_TX` exactly as it always has.
 *
 * The state and the option list live here rather than in the checkout component
 * because this repo's vitest harness is node-only: anything left inside a React
 * component is untestable, and "which of my deployments is this" is precisely
 * the part worth pinning.
 *
 * Arweave only, deliberately. `ANT.spawn` and `buyRecord` both accept
 * `targetProtocol: 1` for an IPFS CID today, but no ar.io gateway resolves one
 * yet — offering it would sell a name that points at nothing. When gateways
 * gain it, this module grows a protocol alongside the id and
 * `isValidRecordTarget` already knows how to check both.
 */
import { isArweaveTxId } from '../utils';

/** How the buyer chose the target. */
export type BuyTargetMode =
  /** Untouched — the name lands on `DEFAULT_ARNS_TARGET_TX`. */
  | 'default'
  /** Picked from something they already published through the console. */
  | 'deployment'
  /** Pasted an id by hand. */
  | 'custom';

export interface BuyTargetState {
  mode: BuyTargetMode;
  /** The chosen id. Meaningless (and ignored) while mode is `default`. */
  txId: string;
}

export const BLANK_BUY_TARGET: BuyTargetState = { mode: 'default', txId: '' };

/** What kind of thing an option came from — drives the badge in the picker. */
export type TargetOptionKind = 'site' | 'page' | 'file';

export interface TargetOption {
  txId: string;
  label: string;
  kind: TargetOptionKind;
  /** Newest-first ordering key. Undefined sorts last. */
  timestamp?: number;
}

/*
  Structural input shapes rather than the store's own types.

  `DeployResult` isn't exported from the store, and importing store types into a
  pure module would drag React-adjacent state into a node test for no benefit.
  These describe only the fields actually read.
*/
export interface DeployLike {
  type?: string;
  id?: string;
  manifestId?: string;
  timestamp?: number;
  appName?: string;
}

export interface PageLike {
  title?: string;
  latestTxId?: string;
  updatedAt?: number;
  /** Newest-first, as the store keeps them. Only the newest timestamp is read. */
  versions?: Array<{ timestamp?: number }>;
}

export interface UploadLike {
  id?: string;
  fileName?: string;
  timestamp?: number;
}

/** How many recent items the picker offers before falling back to "paste an id". */
export const MAX_TARGET_OPTIONS = 6;

/**
 * The buyer's own recent work, newest first, as pickable targets.
 *
 * Recency is the whole ranking: the reason someone is registering a name right
 * now is almost always the thing they published a minute ago. Kind is shown as
 * a badge rather than used to group, so a page published after a site deploy
 * doesn't get buried under it.
 *
 * Only `manifest` deploys qualify — a `files` entry is a bag of data items with
 * no single address to point at, and an `arns-update` is a record write, not
 * content. De-duplicated by id, because publishing a page also records a
 * deploy, and the same id twice reads as a bug.
 */
export function buildTargetOptions({
  deploys = [],
  pages = [],
  uploads = [],
  limit = MAX_TARGET_OPTIONS,
}: {
  deploys?: DeployLike[];
  pages?: PageLike[];
  uploads?: UploadLike[];
  limit?: number;
}): TargetOption[] {
  const candidates: TargetOption[] = [];

  for (const d of deploys) {
    if (d.type !== 'manifest') continue;
    const txId = d.manifestId ?? d.id;
    if (!isArweaveTxId(txId)) continue;
    candidates.push({
      txId: txId!.trim(),
      label: d.appName?.trim() || 'Site deploy',
      kind: 'site',
      timestamp: d.timestamp,
    });
  }

  for (const p of pages) {
    if (!isArweaveTxId(p.latestTxId)) continue;
    candidates.push({
      txId: p.latestTxId!.trim(),
      label: p.title?.trim() || 'Untitled page',
      kind: 'page',
      /*
        The last PUBLISH, not the last edit. `updatedAt` moves every time a
        draft is touched while `latestTxId` stays on the last published
        version — so ranking by it floats a stale id above genuinely newer
        work, and offers a month-old page as the freshest thing you have.
      */
      timestamp: p.versions?.[0]?.timestamp ?? p.updatedAt,
    });
  }

  for (const u of uploads) {
    if (!isArweaveTxId(u.id)) continue;
    candidates.push({
      txId: u.id!.trim(),
      label: u.fileName?.trim() || 'Upload',
      kind: 'file',
      timestamp: u.timestamp,
    });
  }

  candidates.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

  const seen = new Set<string>();
  const unique: TargetOption[] = [];
  for (const c of candidates) {
    if (seen.has(c.txId)) continue;
    seen.add(c.txId);
    unique.push(c);
    if (unique.length >= limit) break;
  }
  return unique;
}

export interface ResolvedBuyTarget {
  /** The id to mint with, or undefined to keep the standard default. */
  txId: string | undefined;
  /** False blocks the purchase — paired with `error`. */
  valid: boolean;
  /** Why it's blocked, phrased for display under the input. */
  error?: string;
}

/**
 * Turn the editor state into the value the buy path wants.
 *
 * A blank custom entry resolves to the default rather than an error. Someone
 * who opens the field, reads it and changes their mind should not have to
 * discover that emptying the box is what un-blocks the button — an untouched
 * input is not a mistake, and refusing to sell them a name over it would be
 * absurd. A non-empty id that isn't an Arweave id IS a mistake, and blocks:
 * minting against it fails the on-chain `is_valid_arweave_id` check, which
 * would surface as an opaque program revert after they'd paid.
 */
export function resolveBuyTarget(state: BuyTargetState): ResolvedBuyTarget {
  if (state.mode === 'default') return { txId: undefined, valid: true };

  const trimmed = state.txId.trim();
  if (trimmed === '') return { txId: undefined, valid: true };

  if (!isArweaveTxId(trimmed)) {
    return {
      txId: undefined,
      valid: false,
      error: 'That is not an Arweave transaction ID (43 characters).',
    };
  }
  return { txId: trimmed, valid: true };
}

/**
 * The one-line answer shown while the control is collapsed.
 *
 * The control is closed by default, so this line is the only thing most buyers
 * ever read about the target — it has to state the outcome, not the setting.
 */
export function describeBuyTarget(
  state: BuyTargetState,
  options: TargetOption[] = [],
  /** When given, a matched option is dated — see the note on duplicate labels. */
  now?: number,
): string {
  const { txId } = resolveBuyTarget(state);
  /*
    Not "AR.IO landing page" — the tx behind DEFAULT_ARNS_TARGET_TX is titled
    "ArNS - Ar.io Name System", so naming it ar.io's landing page overclaimed
    which page a buyer would land on. "Default" also self-explains when this
    line is read collapsed, with no segment visible beside it.
  */
  if (!txId) return 'Default landing page';
  const match = options.find((o) => o.txId === txId);
  if (!match) return shortTxId(txId);
  const when = now === undefined ? undefined : relativeTime(match.timestamp, now);
  return when ? `${match.label} · ${when}` : match.label;
}

/**
 * "2d ago" — coarse on purpose.
 *
 * `now` is injected rather than read from the clock so this stays pure and
 * testable, matching how the rest of this module is written. A timestamp in the
 * future (clock skew, a restored backup) returns undefined rather than "in 3
 * days", which would read as a bug in the row.
 */
export function relativeTime(
  timestamp: number | undefined,
  now: number,
): string | undefined {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp <= 0) {
    return undefined;
  }
  const diff = now - timestamp;
  if (diff < 0) return undefined;

  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/**
 * The second line of a picker row: `Site · 2d ago · Gil3ILKW…JGCdA4`.
 *
 * The date is load-bearing, not decoration. Deploying the same site twice
 * produces two rows with an identical title, and without a date the only way to
 * tell them apart is to recognise a truncated transaction id on sight.
 * Segments are dropped when unknown rather than rendered blank.
 */
export function describeOptionMeta(opt: TargetOption, now: number): string {
  return [KIND_META_LABEL[opt.kind], relativeTime(opt.timestamp, now), shortTxId(opt.txId)]
    .filter(Boolean)
    .join(' · ');
}

const KIND_META_LABEL: Record<TargetOptionKind, string> = {
  site: 'Site',
  page: 'Page',
  file: 'File',
};

/** `abcd1234…wxyz` — enough to recognise an id without wrapping the row. */
export function shortTxId(txId: string): string {
  const t = txId.trim();
  return t.length <= 16 ? t : `${t.slice(0, 8)}…${t.slice(-6)}`;
}
