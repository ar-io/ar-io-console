/**
 * Pure, deterministic helpers for turning a PageDef into an uploadable HTML file
 * and for detecting content changes between versions (PRD §7.6 / §7.7).
 *
 * `computeDefHash` uses a plain FNV-1a-style string hash over a canonical JSON
 * serialisation (object keys sorted recursively), so it is deterministic in both
 * node and the browser with no Web Crypto / subtle dependency, and is stable
 * across object key insertion order.
 */

import type { PageDef } from '../schema';

/** Recursively sort object keys so logically-equal values serialise identically. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = canonicalize(obj[key]);
    }
    return out;
  }
  return value;
}

/** Deterministic canonical JSON string (stable regardless of key insertion order). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/**
 * Deterministic content hash of a PageDef. Two 32-bit FNV-1a-style passes over the
 * canonical JSON are concatenated into a 16-char hex digest. Not cryptographic —
 * it exists purely for change detection / dedup.
 */
export function computeDefHash(def: PageDef): string {
  // Hash only the meaningful content — exclude volatile timestamps so the
  // "no changes since last version" dedup compares what the page actually is,
  // not when it was last touched (edit-then-revert must hash back to the same).
  const content: Partial<PageDef> = { ...def };
  delete content.createdAt;
  delete content.updatedAt;
  const json = canonicalJson(content);
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < json.length; i++) {
    const c = json.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x85ebca77);
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return hex(h1) + hex(h2);
}

/** URL-safe slug derived from a page title (ascii, lowercase, dash-separated). */
export function slugify(title: string): string {
  const s = String(title ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return s || 'page';
}

/** Wrap generated HTML as a `text/html` File named `${slug}.html`. */
export function buildPageFile(html: string, slug: string): File {
  const safe = slugify(slug);
  const blob = new Blob([html], { type: 'text/html' });
  return new File([blob], `${safe}.html`, { type: 'text/html' });
}
