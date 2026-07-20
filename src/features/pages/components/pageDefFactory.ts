/**
 * Editor-side factory helpers for producing a fresh working PageDef.
 *
 * These sit on top of the (immutable) template seeds and schema helpers: they
 * mint a new page id, stamp timestamps, guarantee every block carries a stable
 * id (so the editor's list can key/reorder without losing input focus), and
 * clear the seed's showcase ArNS identity so a new page never claims a name /
 * permalink the user does not own (the publish permalink logic keys off
 * `arnsName`, see publish/permalink.ts).
 */

import {
  DEFAULT_TEMPLATE,
  validatePageDef,
  type Block,
  type PageDef,
  type TemplateId,
} from '../schema';
import { getTemplate } from '../render/renderPageHtml';

function newId(prefix = 'pg'): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto && typeof g.crypto.randomUUID === 'function') return g.crypto.randomUUID();
  return `${prefix}-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** Ensure every block has a stable `id` (used as the React list key). */
export function withBlockIds(def: PageDef): PageDef {
  let changed = false;
  const seen = new Set<string>();
  const blocks: Block[] = def.blocks.map((b) => {
    if (b.id && !seen.has(b.id)) {
      seen.add(b.id);
      return b;
    }
    // Missing id, or a duplicate of one already used (e.g. from an imported/
    // hand-crafted def). Mint a fresh unique id — the editor keys and mutates
    // blocks by id, so colliding ids would make edit/delete hit the wrong twin.
    changed = true;
    let id = newId('blk');
    while (seen.has(id)) id = newId('blk');
    seen.add(id);
    return { ...b, id };
  });
  return changed ? { ...def, blocks } : def;
}

/** Deep-clone with structuredClone, falling back to JSON for older environments. */
function deepClone<T>(value: T): T {
  const g = globalThis as { structuredClone?: <U>(v: U) => U };
  if (typeof g.structuredClone === 'function') return g.structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Blank a template's showcase CONTENT while keeping its design (theme, layout,
 * meta) and block STRUCTURE. A picked template should open as a clean "fill in
 * the blanks" page — the sample text lives on as field placeholders — so users
 * don't accidentally publish the demo. The gallery still renders the full
 * `template.seed`, so previews stay populated. Structural blocks (divider) and
 * the functional verify block are kept as-is.
 *
 * NB: this deliberately does NOT re-run validatePageDef — that would coerce the
 * blanks back (empty url -> '#', missing displayName -> 'Untitled', src-less
 * image dropped). The seed is already a valid PageDef, so blanking its strings
 * keeps the shape valid.
 */
function blankContent(def: PageDef): PageDef {
  const profile = { ...def.profile };
  profile.displayName = '';
  delete profile.tagline;
  delete profile.bio;
  delete profile.avatar;
  delete profile.handle;

  const blocks: Block[] = def.blocks.map((b) => {
    switch (b.type) {
      case 'link':
        return { ...b, label: '', url: '' };
      case 'social':
        return { ...b, items: b.items.map((it) => ({ ...it, url: '' })) };
      case 'heading':
        return { ...b, text: '' };
      case 'text':
        return { ...b, text: '' };
      case 'image':
        return { ...b, src: '', ...(b.alt !== undefined ? { alt: '' } : {}) };
      case 'embed':
        return { ...b, arweave: '' };
      case 'divider':
      case 'verify':
      default:
        return b;
    }
  });
  return { ...def, title: '', profile, blocks };
}

/**
 * Seed a fresh working page from a template: deep copy the seed, blank its
 * showcase content (keeping the design + structure), mint a new id, stamp
 * timestamps, give blocks ids, and clear the template's showcase ArNS identity
 * so the new page starts as a clean slate the user fills in.
 */
export function seedFromTemplate(templateId: TemplateId): PageDef {
  const template = getTemplate(templateId);
  const now = Date.now();
  const clone = deepClone(template.seed);
  const def: PageDef = {
    ...blankContent(clone),
    id: newId(),
    createdAt: now,
    updatedAt: now,
  };
  // A new page must not inherit the template's demo domain.
  delete def.arnsName;
  return withBlockIds(def);
}

/**
 * A friendly "start blank" page — a clean, on-brand starting point with a couple
 * of placeholder blocks so the live preview isn't empty on first open.
 */
export function blankPageDef(): PageDef {
  const now = Date.now();
  const def: PageDef = {
    schema: 'ario-console/page',
    schemaVersion: 1,
    id: newId(),
    template: DEFAULT_TEMPLATE,
    title: 'My page',
    profile: {
      displayName: 'Your name',
      tagline: 'A permanent link-in-bio on the permaweb',
      bio: '',
    },
    blocks: [
      { type: 'link', label: 'My website', url: 'https://' },
      {
        type: 'social',
        items: [
          { platform: 'x', url: 'https://x.com/' },
          { platform: 'github', url: 'https://github.com/' },
        ],
      },
      { type: 'verify', label: 'Permanent on Arweave', url: '' },
    ],
    theme: {
      colors: { bg: '#FFFFFF', surface: '#F0F0F0', text: '#23232D', accent: '#5427C8' },
      font: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      buttonShape: 'pill',
      background: 'solid',
    },
    layout: { headerAlign: 'center', linkStyle: 'button', width: 'standard' },
    meta: { faviconEmoji: '🔗' },
    createdAt: now,
    updatedAt: now,
  };
  return withBlockIds(validatePageDef(def));
}
