/**
 * Shared, dependency-light helpers for Pages template render modules.
 *
 * These keep every template consistent in how it handles the ar.io-native hooks
 * (ArNS handle, `ar://` links, verify/permalink), how it escapes content, and
 * how it safely embeds theme values into scoped CSS. Templates own their bespoke
 * markup; this file owns the shared safety/resolution plumbing.
 */

import type { PageDef, VerifyBlock } from '../schema';
import type { RenderCtx } from '../render/renderPageHtml';
import { escapeAttr, escapeHtml } from '../render/escape';
import { isArUrl, resolveArUrl } from '../render/arResolve';

export interface LinkTarget {
  /** Resolved, browser-usable URL (ar:// already expanded). */
  href: string;
  /** Original `ar://…` intent, preserved for re-hydration; '' when not ar. */
  dataAr: string;
  isAr: boolean;
}

/** Resolve a (possibly `ar://`) url and preserve its native intent. */
export function linkTarget(url: string, ctx: RenderCtx): LinkTarget {
  const isAr = isArUrl(url);
  return { href: resolveArUrl(url, ctx), dataAr: isAr ? url.trim() : '', isAr };
}

/** ` data-ar="…"` attribute (leading space) or '' when there is no ar intent. */
export function dataArAttr(dataAr: string): string {
  return dataAr ? ` data-ar="${escapeAttr(dataAr)}"` : '';
}

export interface HandleInfo {
  /** Display text, e.g. `myname.ar.io`. */
  text: string;
  href: string;
  dataAr: string;
}

/**
 * Resolve the page's ArNS identity affordance. Prefers an explicit profile
 * handle, then the render context's arnsName, then the def's arnsName. Returns
 * null when the page has no ArNS identity to show.
 */
export function resolveHandle(def: PageDef, ctx: RenderCtx): HandleInfo | null {
  const raw = def.profile.handle || ctx.arnsName || def.arnsName;
  if (!raw) return null;
  const host = (ctx.arnsHost || 'ar.io').replace(/^\/+|\/+$/g, '');
  let name = raw.trim().replace(/^https?:\/\//i, '').replace(/^ar:\/\//i, '');
  if (name.toLowerCase().endsWith('.' + host.toLowerCase())) {
    name = name.slice(0, -(host.length + 1));
  }
  name = name.split('/')[0];
  if (!name) return null;
  return { text: `${name}.${host}`, href: resolveArUrl(`ar://${name}`, ctx), dataAr: `ar://${name}` };
}

export interface VerifyInfo {
  href: string;
  dataAr: string;
}

/**
 * Resolve the verify/permalink target: an explicit verify block url wins,
 * otherwise the page's own txId from context. Returns null when neither exists.
 */
export function verifyTarget(block: VerifyBlock | undefined, ctx: RenderCtx): VerifyInfo | null {
  // An explicit, real verify url wins; a placeholder '#' (from validation of an
  // empty url) or absent block falls back to the page's own txId from context.
  const explicit = block && block.url && block.url !== '#' ? block.url : '';
  const url = explicit || (ctx.selfTxId ? `ar://${ctx.selfTxId}` : '');
  if (!url) return null;
  return { href: resolveArUrl(url, ctx), dataAr: isArUrl(url) ? url : '' };
}

/** Escape text and turn newlines into <br> for inline prose. */
export function multiline(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, '<br>');
}

/** Derive up-to-two-letter lowercase initials from a display name. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '·';
  const chars = words.slice(0, 2).map((w) => w[0]);
  return chars.join('').toLowerCase();
}

/** Choose avatar initials: use a short non-URI avatar value, else derive from name. */
export function avatarInitials(def: PageDef): string {
  const a = (def.profile.avatar || '').trim();
  if (a && a.length <= 4 && !/[:/]/.test(a)) return a.toLowerCase();
  return initials(def.profile.displayName);
}

/** Resolve + sanitise an image `src` (data:image and http(s) allowed). '' if unsafe. */
export function safeImgSrc(url: string, ctx: RenderCtx): string {
  const resolved = resolveArUrl(url, ctx).trim();
  const lower = resolved.toLowerCase();
  if (lower.startsWith('https://') || lower.startsWith('http://') || lower.startsWith('data:image/')) {
    return resolved;
  }
  return '';
}

// --- CSS-injection-safe value sanitisers (template styles are inlined raw) -----

/** Allow only genuine CSS color tokens; otherwise fall back. Blocks `{};<>` etc. */
export function cssColor(v: string, fallback: string): string {
  const s = String(v).trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (/^(rgb|rgba|hsl|hsla)\([0-9%.,\s/-]+\)$/i.test(s)) return s;
  if (/^[a-zA-Z]{1,20}$/.test(s)) return s;
  return fallback;
}

/** Reject a font-family value that could break out of the CSS/style context. */
export function cssFontFamily(v: string, fallback: string): string {
  const s = String(v);
  // Reject anything that could break the CSS context OR pull a resource:
  // braces/brackets, semicolons, backslash, parens (url()), @ (@import), slash.
  return /[{}<>;\\()@/]/.test(s) ? fallback : s;
}

/** Convert #rgb / #rrggbb to an rgba() string; safe fallback on parse failure. */
export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(String(hex).trim());
  if (!m) return `rgba(0, 0, 0, ${alpha})`;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export { escapeAttr, escapeHtml };
