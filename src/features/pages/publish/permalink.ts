/**
 * Pure permalink logic for publishing a page (PRD §7.12).
 *
 * A page cannot know its own tx id before it is uploaded, so the verify/permalink
 * affordance must never embed a guessed `ar://<txid>`. This module resolves the
 * publish-time target for the page's `verify` block:
 *   - With an ArNS name → point the verify block at that stable name
 *     (`ar://<name>` / `ar://<under_name>`), which survives re-publishes/rollbacks.
 *   - Without an ArNS name → neutralise any placeholder `ar://<txid>` verify url
 *     (e.g. a template seed's) to `#`, so the renderer omits the affordance rather
 *     than linking to a wrong/fake tx.
 *
 * Kept pure (no React / SDK imports) so the publish hook is a thin wrapper.
 */

import type { Block, PageDef } from '../schema';

export interface ArnsTarget {
  name: string;
  undername?: string;
}

/** A `ar://` followed by a 43-char base64url tx id — the placeholder we neutralise. */
const AR_TX_URL_RE = /^ar:\/\/[A-Za-z0-9_-]{43}$/i;

/** ArNS label used in `ar://…`: `under_name` for an undername, else the base name. */
export function arnsLabel(arns: ArnsTarget): string {
  return arns.undername ? `${arns.undername}_${arns.name}` : arns.name;
}

/**
 * Rewrite the verify block's target for publishing (see module doc). Returns the
 * same reference when nothing changes; never mutates the input def.
 */
export function prepareDefForPublish(def: PageDef, permalinkArns?: string): PageDef {
  let changed = false;
  const blocks: Block[] = def.blocks.map((b) => {
    if (b.type !== 'verify') return b;
    if (permalinkArns) {
      changed = true;
      return { ...b, url: `ar://${permalinkArns}` };
    }
    if (AR_TX_URL_RE.test((b.url || '').trim())) {
      changed = true;
      return { ...b, url: '#' };
    }
    return b;
  });
  return changed ? { ...def, blocks } : def;
}
