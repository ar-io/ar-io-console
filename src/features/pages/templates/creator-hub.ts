/**
 * Creator Hub — a polished, monetization-forward link hub for creators and
 * influencers. A soft banner gradient carries a large hero avatar with a
 * cosmetic verified tick, a prominent FEATURED link, then the remaining links
 * grouped under styled section labels, and a circular social row.
 *
 * (The "verified" tick is a decorative flourish only — it is NOT a claim of any
 * real identity verification.)
 */

import type {
  Block,
  LinkBlock,
  PageDef,
  SocialBlock,
  VerifyBlock,
} from '../schema';
import type { PagesTemplate, RenderCtx, RenderOutput } from '../render/renderPageHtml';
import { safeHref } from '../render/escape';
import {
  avatarInitials,
  cssColor,
  cssFontFamily,
  dataArAttr,
  escapeAttr,
  escapeHtml,
  hexToRgba,
  linkTarget,
  multiline,
  resolveHandle,
  safeImgSrc,
  verifyTarget,
} from './shared';

const ID = 'creator-hub';

const DEFAULT_FONT =
  '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, system-ui, sans-serif';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-creator-hub',
  template: 'creator-hub',
  title: 'Nova — Creator Hub',
  arnsName: 'nova',
  profile: {
    avatar: '',
    displayName: 'Nova Rey',
    tagline: 'Creator · maker · your favourite internet friend',
    bio: 'Sharing the drops, the process, and the little wins. Everything I make lives here — thank you for being early.',
    handle: 'nova.ar.io',
  },
  blocks: [
    { type: 'link', label: 'The Summer Drop — out now', url: 'https://example.com/drop', icon: '★' },
    { type: 'heading', text: 'Shop' },
    { type: 'link', label: 'Shop the collection', url: 'https://example.com/shop', icon: '◆' },
    { type: 'link', label: 'Limited prints', url: 'https://example.com/prints', icon: '◇' },
    { type: 'heading', text: 'Read & watch' },
    { type: 'link', label: 'The Nova Newsletter', url: 'https://example.com/newsletter', icon: '✎' },
    { type: 'link', label: 'Behind the drop — on the permaweb', url: 'ar://mT4nP8qX2vB9kR7wZ1cJ5sD3hN6fA0gE4uL7iO2YpQx', icon: '✧' },
    { type: 'heading', text: 'Support' },
    { type: 'link', label: 'Tip jar', url: 'https://example.com/tip', icon: '♥' },
    { type: 'divider' },
    { type: 'heading', text: 'Follow' },
    {
      type: 'social',
      items: [
        { platform: 'instagram', url: 'https://example.com' },
        { platform: 'x', url: 'https://example.com' },
        { platform: 'youtube', url: 'https://example.com' },
        { platform: 'tiktok', url: 'https://example.com' },
      ],
    },
    { type: 'verify', label: 'Permanent on Arweave', url: '#' },
  ],
  theme: {
    colors: { bg: '#FBF6FC', surface: '#FFFFFF', text: '#1B1420', accent: '#F5388B' },
    font: DEFAULT_FONT,
    buttonShape: 'pill',
    background: 'banner',
  },
  layout: { headerAlign: 'center', linkStyle: 'card', width: 'standard' },
};

// --- Inline social glyphs (static, trusted markup) -----------------------------

const SVG_X =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-7.5 8.6L23.3 22h-6.8l-5.3-6.9L5.1 22H2l8-9.2L1.5 2h7l4.8 6.3L18.9 2Zm-1.2 18h1.9L7.4 4H5.4l12.3 16Z"/></svg>';
const SVG_INSTAGRAM =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>';
const SVG_YOUTUBE =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 12s0-3.4-.4-5a2.5 2.5 0 0 0-1.8-1.8C19.2 4.8 12 4.8 12 4.8s-7.2 0-8.8.4A2.5 2.5 0 0 0 1.4 7C1 8.6 1 12 1 12s0 3.4.4 5a2.5 2.5 0 0 0 1.8 1.8c1.6.4 8.8.4 8.8.4s7.2 0 8.8-.4A2.5 2.5 0 0 0 22.6 17c.4-1.6.4-5 .4-5ZM9.8 15.3V8.7l6.2 3.3-6.2 3.3Z"/></svg>';
const SVG_TIKTOK =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.5 3c.3 2.3 1.6 3.9 3.9 4.1v2.7c-1.4.1-2.7-.3-3.9-1v5.8c0 3.6-2.8 6.4-6.3 6.1a5.9 5.9 0 0 1-5.3-5.9 5.9 5.9 0 0 1 6.6-5.8v2.9a3.2 3.2 0 0 0-1.2-.2 3 3 0 0 0-.4 6 3 3 0 0 0 3.5-3V3h3.4Z"/></svg>';
const SVG_GITHUB =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.94.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>';
const SVG_LINKEDIN =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm6 0h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.3c0-1.27-.02-2.9-1.77-2.9-1.77 0-2.04 1.38-2.04 2.8V21H9V9Z"/></svg>';
const SVG_TICK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7"/></svg>';
const SVG_LOCK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>';

/** Map a platform name to an inline glyph; unknown platforms get a lettered fallback. */
function socialGlyph(platform: string): string {
  switch (platform.trim().toLowerCase()) {
    case 'x':
    case 'twitter':
      return SVG_X;
    case 'instagram':
    case 'ig':
      return SVG_INSTAGRAM;
    case 'youtube':
    case 'yt':
      return SVG_YOUTUBE;
    case 'tiktok':
      return SVG_TIKTOK;
    case 'github':
    case 'gh':
      return SVG_GITHUB;
    case 'linkedin':
      return SVG_LINKEDIN;
    default: {
      const ch = (platform.trim()[0] || '•').toUpperCase();
      return `<span class="pg-soc-txt" aria-hidden="true">${escapeHtml(ch)}</span>`;
    }
  }
}

/** Deterministically darken a #rgb/#rrggbb color; returns null for non-hex input. */
function darkenHex(hex: string, factor: number): string | null {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(String(hex).trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const scale = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  const to2 = (v: number) => v.toString(16).padStart(2, '0');
  const r = scale(parseInt(h.slice(0, 2), 16));
  const g = scale(parseInt(h.slice(2, 4), 16));
  const b = scale(parseInt(h.slice(4, 6), 16));
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const accent = cssColor(c.accent, '#F5388B');
  const accent2 = darkenHex(accent, 0.72) || '#7A3CF0';
  const bannerA = hexToRgba(c.accent, 0.26);
  const bannerB = hexToRgba(c.accent, 0.1);
  const font = cssFontFamily(def.theme.font, DEFAULT_FONT);

  const lightVars =
    `--accent:${accent}; --accent-2:${accent2}; ` +
    `--bg:#FBF6FC; --surface:#FFFFFF; --raise:#FFFFFF; --text:#1B1420; --muted:#6B6577; ` +
    `--border:rgba(27,20,32,.09); --hair:rgba(27,20,32,.06); ` +
    `--banner-a:${bannerA}; --banner-b:${bannerB}; --banner-base:#F0E7F6; ` +
    `--shadow:0 1px 2px rgba(27,20,32,.05), 0 14px 32px -20px rgba(27,20,32,.28); ` +
    `--shadow-hi:0 20px 44px -18px rgba(27,20,32,.32);`;

  const darkVars =
    `--accent:${accent}; --accent-2:${accent2}; ` +
    `--bg:#120E16; --surface:#1D1622; --raise:#241C2C; --text:#F6F0F9; --muted:#A79FB2; ` +
    `--border:rgba(255,255,255,.10); --hair:rgba(255,255,255,.07); ` +
    `--banner-a:${bannerA}; --banner-b:${bannerB}; --banner-base:#241830; ` +
    `--shadow:0 12px 30px -16px rgba(0,0,0,.7); --shadow-hi:0 20px 44px -14px rgba(0,0,0,.78);`;

  return `
:root { color-scheme: light dark; }
.pg-${ID} {
  ${lightVars}
  min-height: 100vh; background: var(--bg); color: var(--text); font-family: ${font};
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
.pg-${ID} * { box-sizing: border-box; }
:root[data-theme="light"] .pg-${ID} { ${lightVars} }
@media (prefers-color-scheme: dark) { .pg-${ID} { ${darkVars} } }
:root[data-theme="dark"] .pg-${ID} { ${darkVars} }
.pg-${ID} .pg-wrap { width: 100%; max-width: 36rem; margin: 0 auto; padding: 0 clamp(1rem,4vw,1.5rem) 3rem; }
.pg-${ID} .pg-banner {
  position: relative; height: clamp(120px,26vw,168px); margin: 0 calc(-1 * clamp(1rem,4vw,1.5rem));
  border-radius: 0 0 28px 28px; overflow: hidden;
  background:
    radial-gradient(120% 140% at 12% 0%, var(--banner-a), transparent 60%),
    radial-gradient(120% 150% at 92% 8%, var(--banner-b), transparent 62%),
    linear-gradient(135deg, var(--accent), var(--accent-2)), var(--banner-base);
}
.pg-${ID} .pg-banner::after {
  content: ""; position: absolute; inset: 0;
  background-image: radial-gradient(rgba(255,255,255,.16) 1px, transparent 1px);
  background-size: 14px 14px; opacity: .5; mix-blend-mode: soft-light;
}
.pg-${ID} .pg-header { position: relative; text-align: center; margin-top: -58px; }
.pg-${ID} .pg-avatar {
  width: 116px; height: 116px; margin: 0 auto .9rem; border-radius: 50%; padding: 4px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: var(--shadow-hi);
}
.pg-${ID} .pg-avatar-inner {
  width: 100%; height: 100%; border-radius: 50%; display: grid; place-items: center;
  background: var(--surface); color: var(--text); font-size: 2.3rem; font-weight: 800;
  letter-spacing: .01em; text-transform: uppercase; overflow: hidden; border: 3px solid var(--surface);
}
.pg-${ID} .pg-avatar-inner img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; }
.pg-${ID} .pg-name-row { display: flex; align-items: center; justify-content: center; gap: .4rem; margin: 0 0 .3rem; }
.pg-${ID} .pg-name { margin: 0; font-size: clamp(1.5rem,5vw,1.95rem); font-weight: 800; letter-spacing: -.02em; }
.pg-${ID} .pg-tick {
  flex: 0 0 auto; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center;
  background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #fff;
  box-shadow: 0 2px 8px -2px var(--accent);
}
.pg-${ID} .pg-tick svg { width: 12px; height: 12px; display: block; }
.pg-${ID} .pg-tagline { margin: 0 auto .7rem; font-size: .95rem; font-weight: 600; color: var(--accent); }
.pg-${ID} .pg-handle {
  display: inline-flex; align-items: center; gap: .4rem; margin: 0 auto .85rem;
  padding: .3rem .8rem; border-radius: 999px; font-size: .78rem; font-weight: 700;
  color: var(--text); text-decoration: none; background: var(--raise);
  border: 1px solid var(--border); box-shadow: var(--shadow);
  transition: transform .2s ease, border-color .2s ease, color .2s ease;
}
.pg-${ID} .pg-handle .pg-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex: 0 0 auto; }
.pg-${ID} .pg-handle:hover { transform: translateY(-2px); border-color: var(--accent); color: var(--accent); }
.pg-${ID} .pg-bio { margin: 0 auto; max-width: 30rem; font-size: .95rem; line-height: 1.55; color: var(--muted); }
.pg-${ID} .pg-featured {
  position: relative; display: flex; align-items: center; gap: .9rem; margin: 1.75rem 0 0;
  padding: 1.1rem 1.2rem; border-radius: 20px; text-decoration: none; color: #fff; min-height: 66px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2)); box-shadow: var(--shadow-hi);
  transition: transform .2s ease, box-shadow .2s ease;
}
.pg-${ID} .pg-featured:hover { transform: translateY(-3px); }
.pg-${ID} .pg-featured .pg-ico {
  flex: 0 0 auto; width: 40px; height: 40px; display: grid; place-items: center; border-radius: 12px;
  background: rgba(255,255,255,.2); color: #fff; font-size: 1.25rem;
}
.pg-${ID} .pg-featured .pg-fbody { flex: 1 1 auto; min-width: 0; }
.pg-${ID} .pg-featured .pg-fkicker { font-size: .64rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; opacity: .82; }
.pg-${ID} .pg-featured .pg-label { display: block; font-size: 1.1rem; font-weight: 800; letter-spacing: -.01em; line-height: 1.2; word-break: break-word; }
.pg-${ID} .pg-featured .pg-arrow { flex: 0 0 auto; font-weight: 800; transition: transform .2s ease; }
.pg-${ID} .pg-featured:hover .pg-arrow { transform: translateX(3px); }
.pg-${ID} .pg-featured.pg-ar .pg-arrow { font-size: .72rem; letter-spacing: .05em; }
.pg-${ID} .pg-links { display: flex; flex-direction: column; gap: .7rem; margin-top: .85rem; }
.pg-${ID} .pg-card {
  position: relative; display: flex; align-items: center; gap: .85rem; min-height: 56px;
  padding: .85rem 1.05rem; border-radius: 16px; text-decoration: none; color: var(--text);
  font-weight: 700; font-size: 1rem; background: var(--surface); border: 1px solid var(--border);
  box-shadow: var(--shadow); transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
}
.pg-${ID} .pg-card:hover { transform: translateY(-2px); border-color: var(--accent); box-shadow: var(--shadow-hi); }
.pg-${ID} .pg-card .pg-ico {
  flex: 0 0 auto; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); font-size: 1.05rem;
}
.pg-${ID} .pg-card .pg-label { flex: 1 1 auto; min-width: 0; word-break: break-word; }
.pg-${ID} .pg-card .pg-arrow { flex: 0 0 auto; color: var(--muted); transition: transform .2s ease, color .2s ease; }
.pg-${ID} .pg-card:hover .pg-arrow { transform: translateX(3px); color: var(--accent); }
.pg-${ID} .pg-card.pg-ar .pg-arrow { font-size: .68rem; font-weight: 800; letter-spacing: .05em; }
.pg-${ID} .pg-section {
  display: flex; align-items: center; gap: .7rem; margin: 1.9rem 0 .3rem;
  font-size: .74rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--muted);
}
.pg-${ID} .pg-section::before { content: ""; width: 18px; height: 3px; border-radius: 3px; background: linear-gradient(90deg, var(--accent), var(--accent-2)); flex: 0 0 auto; }
.pg-${ID} .pg-section::after { content: ""; flex: 1 1 auto; height: 1px; background: var(--hair); }
.pg-${ID} .pg-text { margin: 1rem auto; max-width: 30rem; text-align: center; font-size: .93rem; line-height: 1.6; color: var(--muted); }
.pg-${ID} .pg-figure { margin: 1.4rem 0 0; }
.pg-${ID} .pg-img { display: block; width: 100%; height: auto; border-radius: 18px; border: 1px solid var(--border); box-shadow: var(--shadow); }
.pg-${ID} .pg-divider { height: 1px; border: 0; margin: 1.7rem 0; background: var(--hair); }
.pg-${ID} .pg-social { display: flex; justify-content: center; flex-wrap: wrap; gap: .6rem; margin: 1rem 0 0; list-style: none; padding: 0; }
.pg-${ID} .pg-social a {
  width: 46px; height: 46px; display: grid; place-items: center; border-radius: 999px;
  color: var(--text); text-decoration: none; background: var(--surface); border: 1px solid var(--border);
  box-shadow: var(--shadow); transition: transform .2s ease, color .2s ease, border-color .2s ease;
}
.pg-${ID} .pg-social a svg { width: 20px; height: 20px; display: block; }
.pg-${ID} .pg-social a .pg-soc-txt { font-size: 1rem; font-weight: 800; line-height: 1; }
.pg-${ID} .pg-social a:hover { transform: translateY(-3px); color: var(--accent); border-color: var(--accent); }
.pg-${ID} .pg-footer { margin-top: 2.25rem; text-align: center; font-size: .78rem; color: var(--muted); }
.pg-${ID} .pg-verify {
  display: inline-flex; align-items: center; gap: .4rem; color: var(--muted); text-decoration: none;
  padding: .3rem .7rem; border-radius: 999px; border: 1px solid transparent; transition: color .2s ease, border-color .2s ease;
}
.pg-${ID} .pg-verify svg { width: 13px; height: 13px; display: block; }
.pg-${ID} .pg-verify:hover { color: var(--accent); border-color: var(--border); }
.pg-${ID} .pg-made { display: block; opacity: .7; margin-top: .55rem; }
.pg-${ID} a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 14px; }
.pg-${ID} .pg-social a:focus-visible, .pg-${ID} .pg-handle:focus-visible, .pg-${ID} .pg-verify:focus-visible { border-radius: 999px; }
@media (prefers-reduced-motion: reduce) {
  .pg-${ID} .pg-card, .pg-${ID} .pg-featured, .pg-${ID} .pg-social a, .pg-${ID} .pg-handle,
  .pg-${ID} .pg-card .pg-arrow, .pg-${ID} .pg-featured .pg-arrow { transition: none; }
  .pg-${ID} .pg-card:hover, .pg-${ID} .pg-featured:hover, .pg-${ID} .pg-social a:hover, .pg-${ID} .pg-handle:hover { transform: none; }
  .pg-${ID} .pg-card:hover .pg-arrow, .pg-${ID} .pg-featured:hover .pg-arrow { transform: none; }
}
`.trim();
}

function renderHeader(def: PageDef, ctx: RenderCtx): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  const avatarSrc = p.avatar ? safeImgSrc(p.avatar, ctx) : '';
  const inner = avatarSrc
    ? `<img src="${escapeAttr(avatarSrc)}" alt="${escapeAttr(p.displayName)}" loading="lazy" />`
    : escapeHtml(avatarInitials(def));

  const parts: string[] = [
    `<div class="pg-avatar"><div class="pg-avatar-inner" aria-hidden="true">${inner}</div></div>`,
    `<div class="pg-name-row"><h1 class="pg-name">${escapeHtml(p.displayName)}</h1>` +
      `<span class="pg-tick" aria-hidden="true" title="Creator">${SVG_TICK}</span></div>`,
  ];
  if (p.tagline) parts.push(`<p class="pg-tagline">${escapeHtml(p.tagline)}</p>`);
  if (handle) {
    parts.push(
      `<a class="pg-handle" href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)}>` +
        `<span class="pg-dot" aria-hidden="true"></span>${escapeHtml(handle.text)}</a>`,
    );
  }
  if (p.bio) parts.push(`<p class="pg-bio">${escapeHtml(p.bio)}</p>`);
  return `<div class="pg-banner" aria-hidden="true"></div><header class="pg-header">${parts.join('')}</header>`;
}

function renderFeatured(link: LinkBlock, ctx: RenderCtx): string {
  const t = linkTarget(link.url, ctx);
  const ico = link.icon ? `<span class="pg-ico" aria-hidden="true">${escapeHtml(link.icon)}</span>` : '';
  const cls = t.isAr ? 'pg-featured pg-ar' : 'pg-featured';
  const arrow = t.isAr ? 'ar://' : '→';
  return (
    `<a class="${cls}" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    ico +
    `<span class="pg-fbody"><span class="pg-fkicker">Featured</span>` +
    `<span class="pg-label">${escapeHtml(link.label)}</span></span>` +
    `<span class="pg-arrow" aria-hidden="true">${arrow}</span></a>`
  );
}

function renderCard(link: LinkBlock, ctx: RenderCtx): string {
  const t = linkTarget(link.url, ctx);
  const ico = link.icon ? `<span class="pg-ico" aria-hidden="true">${escapeHtml(link.icon)}</span>` : '';
  const cls = t.isAr ? 'pg-card pg-ar' : 'pg-card';
  const arrow = t.isAr ? 'ar://' : '→';
  return (
    `<a class="${cls}" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    ico +
    `<span class="pg-label">${escapeHtml(link.label)}</span>` +
    `<span class="pg-arrow" aria-hidden="true">${arrow}</span></a>`
  );
}

/** Render a run of consecutive links. When `allowFeatured`, the first is the hero. */
function renderLinkGroup(group: LinkBlock[], ctx: RenderCtx, allowFeatured: boolean): string {
  if (group.length === 0) return '';
  const parts: string[] = [];
  let rest = group;
  if (allowFeatured) {
    parts.push(renderFeatured(group[0], ctx));
    rest = group.slice(1);
  }
  if (rest.length > 0) {
    const cards = rest.map((l) => renderCard(l, ctx)).join('');
    parts.push(`<nav class="pg-links" aria-label="Links">${cards}</nav>`);
  }
  return parts.join('');
}

function renderSocial(block: SocialBlock, ctx: RenderCtx): string {
  const items = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      const label = item.platform ? escapeAttr(item.platform) : 'Social link';
      return (
        `<li><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)} aria-label="${label}">` +
        `${socialGlyph(item.platform)}</a></li>`
      );
    })
    .join('');
  return `<ul class="pg-social" aria-label="Social links">${items}</ul>`;
}

function renderEmbed(arweave: string, ctx: RenderCtx): string {
  const raw = arweave.trim();
  const url = raw.toLowerCase().startsWith('ar://') ? raw : `ar://${raw}`;
  const t = linkTarget(url, ctx);
  return (
    `<nav class="pg-links" aria-label="Links">` +
    `<a class="pg-card pg-ar" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    `<span class="pg-ico" aria-hidden="true">✧</span>` +
    `<span class="pg-label">${escapeHtml(raw)}</span>` +
    `<span class="pg-arrow" aria-hidden="true">ar://</span></a></nav>`
  );
}

function renderFooter(verifyBlock: VerifyBlock | undefined, ctx: RenderCtx): string {
  const v = verifyTarget(verifyBlock, ctx);
  const parts: string[] = [];
  if (v) {
    const label = verifyBlock && verifyBlock.label ? verifyBlock.label : 'Permanent on Arweave';
    parts.push(
      `<a class="pg-verify" href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)}>` +
        `${SVG_LOCK} ${escapeHtml(label)}</a>`,
    );
  }
  parts.push(`<span class="pg-made">Made with Creator Hub</span>`);
  return `<p class="pg-footer">${parts.join('')}</p>`;
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const blocks = def.blocks;

  let verifyBlock: VerifyBlock | undefined;
  for (const b of blocks) {
    if (b.type === 'verify') {
      verifyBlock = b;
      break;
    }
  }

  const out: string[] = [renderHeader(def, ctx)];
  let featuredUsed = false;

  let i = 0;
  while (i < blocks.length) {
    const block: Block = blocks[i];
    if (block.type === 'link') {
      const group: LinkBlock[] = [];
      while (i < blocks.length && blocks[i].type === 'link') {
        group.push(blocks[i] as LinkBlock);
        i++;
      }
      out.push(renderLinkGroup(group, ctx, !featuredUsed));
      featuredUsed = true;
      continue;
    }
    switch (block.type) {
      case 'heading':
        out.push(`<h2 class="pg-section">${escapeHtml(block.text)}</h2>`);
        break;
      case 'text':
        out.push(`<p class="pg-text">${multiline(block.text)}</p>`);
        break;
      case 'divider':
        out.push(`<hr class="pg-divider" aria-hidden="true" />`);
        break;
      case 'social':
        out.push(renderSocial(block, ctx));
        break;
      case 'image': {
        const src = safeImgSrc(block.src, ctx);
        if (src) {
          out.push(
            `<figure class="pg-figure"><img class="pg-img" src="${escapeAttr(src)}" alt="${escapeAttr(block.alt || '')}" loading="lazy" /></figure>`,
          );
        }
        break;
      }
      case 'embed':
        out.push(renderEmbed(block.arweave, ctx));
        break;
      case 'verify':
        // Rendered in the footer via the pre-scan above.
        break;
    }
    i++;
  }

  out.push(renderFooter(verifyBlock, ctx));
  return `<main class="pg-wrap">${out.join('')}</main>`;
}

export const creatorHubTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Creator Hub',
    family: 'creator',
    description: 'A polished creator hub — banner, hero avatar, featured drop, and grouped links.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default creatorHubTemplate;
