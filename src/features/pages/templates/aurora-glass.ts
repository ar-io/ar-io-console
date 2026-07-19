/**
 * Aurora Glass — frosted glass cards floating over a drifting aurora bloom.
 * Reproduces docs/pages-templates/aurora-glass.html as a block-driven module.
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

const ID = 'aurora-glass';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-aurora-glass',
  template: 'aurora-glass',
  title: 'Nova Meridian — Aurora Glass',
  arnsName: 'nova',
  profile: {
    avatar: '',
    displayName: 'Nova Meridian',
    tagline: 'Product designer & light-chaser',
    bio: 'Designing calm interfaces from a studio somewhere between the mountains and the sea. Currently exploring generative motion & spatial UI.',
  },
  blocks: [
    { type: 'link', label: 'View my portfolio', url: 'https://example.com/portfolio', icon: '◆' },
    { type: 'link', label: 'Aurora — my weekly newsletter', url: 'https://example.com/newsletter', icon: '✦' },
    { type: 'link', label: 'Shop print editions', url: 'https://example.com/shop', icon: '◇' },
    { type: 'divider' },
    { type: 'heading', text: 'Latest work' },
    {
      type: 'text',
      text: 'Just shipped a spatial design system for a calm-tech wearable. Case study & process notes are up now.',
    },
    {
      type: 'link',
      label: 'Read the case study — on the permaweb',
      url: 'ar://mT4nP8qX2vB9kR7wZ1cJ5sD3hN6fA0gE4uL7iO2YpQx',
      icon: '✧',
    },
    { type: 'divider' },
    {
      type: 'social',
      items: [
        { platform: 'x', url: 'https://example.com' },
        { platform: 'instagram', url: 'https://example.com' },
        { platform: 'github', url: 'https://example.com' },
        { platform: 'linkedin', url: 'https://example.com' },
      ],
    },
  ],
  theme: {
    colors: { bg: '#0B1026', surface: '#1A2142', text: '#EDF0FF', accent: '#2DD4BF' },
    font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    buttonShape: 'pill',
    background: 'aurora',
  },
  layout: { headerAlign: 'center', linkStyle: 'card', width: 'standard' },
};

// --- Inline social glyphs (static, trusted markup) -----------------------------

const SVG_X =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-7.5 8.6L23.3 22h-6.8l-5.3-6.9L5.1 22H2l8-9.2L1.5 2h7l4.8 6.3L18.9 2Zm-1.2 18h1.9L7.4 4H5.4l12.3 16Z"/></svg>';
const SVG_INSTAGRAM =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>';
const SVG_GITHUB =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.94.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>';
const SVG_LINKEDIN =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm6 0h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.3c0-1.27-.02-2.9-1.77-2.9-1.77 0-2.04 1.38-2.04 2.8V21H9V9Z"/></svg>';
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

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const bg = cssColor(c.bg, '#0B1026');
  const surface = cssColor(c.surface, '#1A2142');
  const text = cssColor(c.text, '#EDF0FF');
  const accent = cssColor(c.accent, '#2DD4BF');
  const bloomTeal = hexToRgba(c.accent, 0.16);
  const font = cssFontFamily(
    def.theme.font,
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  );

  const darkVars =
    `--bg:${bg}; --surface:${surface}; --text:${text}; --accent:${accent}; ` +
    `--violet:#8B5CF6; --glass:rgba(255,255,255,0.06); --glass-strong:rgba(255,255,255,0.12); ` +
    `--bloom-teal:${bloomTeal}; --bloom-violet:rgba(139,92,246,0.16); ` +
    `--muted:#AAB4E8; --card-border:rgba(255,255,255,0.12); --top-hi:rgba(255,255,255,0.14);`;

  const lightVars =
    `--bg:#EDF1FF; --surface:#FFFFFF; --text:#1A2142; --accent:#0E9C88; --violet:#8B5CF6; ` +
    `--glass:rgba(255,255,255,0.55); --glass-strong:rgba(255,255,255,0.7); ` +
    `--bloom-teal:rgba(45,212,191,0.10); --bloom-violet:rgba(139,92,246,0.10); ` +
    `--muted:#4A5178; --card-border:rgba(11,16,38,0.10); --top-hi:rgba(255,255,255,0.7);`;

  const lightRules = (s: string): string =>
    `
${s} .pg-tagline { color: #0E9C88; }
${s} .pg-card .pg-ico { color: #0E9C88; background: rgba(45,212,191,.14); }
${s} .pg-avatar-inner { color: #1A2142; background: #FFFFFF; }
${s} .pg-divider { box-shadow: 0 0 8px rgba(45,212,191,.25); opacity: .7; }
${s} .pg-card:hover { border-color: rgba(14,156,136,.5); }
${s} .pg-card:hover .pg-arrow,
${s} .pg-social a:hover,
${s} .pg-handle:hover,
${s} .pg-verify:hover { color: #0E9C88; }
${s} .pg-handle:hover { border-color: rgba(14,156,136,.5); }
${s} .pg-verify:hover { border-color: rgba(14,156,136,.3); }`.trim();

  return `
:root { color-scheme: light dark; }
.pg-${ID} {
  ${darkVars}
  position: relative; min-height: 100vh; color: var(--text); background: var(--bg);
  font-family: ${font};
  -webkit-font-smoothing: antialiased; overflow-x: hidden; isolation: isolate;
}
.pg-${ID} * { box-sizing: border-box; }
:root[data-theme="dark"] .pg-${ID} { ${darkVars} }
.pg-${ID}::before,
.pg-${ID}::after {
  content: ""; position: fixed; inset: -30% -20%; z-index: -1; pointer-events: none; filter: blur(60px);
}
.pg-${ID}::before {
  background:
    radial-gradient(38% 32% at 22% 18%, var(--bloom-teal), transparent 70%),
    radial-gradient(42% 36% at 82% 26%, var(--bloom-violet), transparent 72%),
    radial-gradient(46% 40% at 60% 82%, var(--bloom-teal), transparent 74%);
  animation: pg-auroraDrift-${ID} 40s ease-in-out infinite alternate;
}
.pg-${ID}::after {
  background:
    radial-gradient(40% 34% at 78% 72%, var(--bloom-violet), transparent 72%),
    radial-gradient(36% 30% at 14% 68%, var(--bloom-teal), transparent 70%);
  animation: pg-auroraDrift-${ID} 52s ease-in-out infinite alternate-reverse; opacity: .9;
}
@keyframes pg-auroraDrift-${ID} {
  0% { transform: translate3d(-4%,-2%,0) rotate(-2deg) scale(1.05); }
  50% { transform: translate3d(3%,2%,0) rotate(2deg) scale(1.12); }
  100% { transform: translate3d(-2%,4%,0) rotate(-1deg) scale(1.08); }
}
.pg-${ID} .pg-wrap {
  position: relative; width: 100%; max-width: 34rem; margin: 0 auto;
  padding: clamp(2rem,6vw,3.5rem) clamp(1rem,4vw,1.5rem) 3rem;
}
.pg-${ID} .pg-header { text-align: center; margin-bottom: 1.75rem; }
.pg-${ID} .pg-avatar {
  width: 104px; height: 104px; margin: 0 auto 1.1rem; border-radius: 50%; padding: 3px;
  background: conic-gradient(from 210deg, var(--accent), var(--violet), var(--accent));
  box-shadow: 0 8px 30px rgba(45,212,191,.22), 0 8px 30px rgba(139,92,246,.18);
}
.pg-${ID} .pg-avatar-inner {
  width: 100%; height: 100%; border-radius: 50%; display: grid; place-items: center;
  background: var(--surface); color: var(--text); font-size: 2.2rem; font-weight: 600;
  letter-spacing: .02em; text-transform: uppercase; overflow: hidden; border: 1px solid var(--glass-strong);
}
.pg-${ID} .pg-avatar-inner img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.pg-${ID} .pg-name { margin: 0 0 .35rem; font-size: clamp(1.5rem,5vw,1.9rem); font-weight: 700; letter-spacing: -.01em; }
.pg-${ID} .pg-tagline { margin: 0 auto .6rem; font-size: .95rem; font-weight: 600; color: var(--accent); }
.pg-${ID} .pg-handle {
  display: inline-flex; align-items: center; gap: .45rem; margin: 0 auto .8rem;
  padding: .3rem .75rem; border-radius: 999px; font-size: .8rem; font-weight: 600;
  letter-spacing: .01em; color: var(--text); text-decoration: none;
  background: var(--glass); border: 1px solid var(--card-border);
  box-shadow: inset 0 1px 0 var(--top-hi);
  transition: transform .28s ease, border-color .28s ease, box-shadow .28s ease, color .28s ease;
}
.pg-${ID} .pg-handle .pg-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--accent);
  box-shadow: 0 0 8px var(--accent); flex: 0 0 auto;
}
.pg-${ID} .pg-handle:hover {
  transform: translateY(-2px); color: var(--accent); border-color: rgba(45,212,191,.45);
  box-shadow: inset 0 1px 0 var(--top-hi), 0 8px 22px rgba(45,212,191,.18);
}
.pg-${ID} .pg-bio { margin: 0 auto; max-width: 28rem; font-size: .95rem; line-height: 1.55; color: var(--muted); }
.pg-${ID} .pg-links { display: flex; flex-direction: column; gap: .85rem; margin-top: 1.5rem; }
.pg-${ID} .pg-card {
  position: relative; display: flex; align-items: center; gap: .85rem; min-height: 52px;
  padding: .9rem 1.1rem; border-radius: 16px; text-decoration: none; color: var(--text);
  font-weight: 600; font-size: 1rem; background: var(--glass); border: 1px solid var(--card-border);
  box-shadow: inset 0 1px 0 var(--top-hi), 0 6px 18px rgba(6,10,28,.35); overflow: hidden;
  transition: transform .28s ease, box-shadow .28s ease, background .28s ease, border-color .28s ease;
}
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .pg-${ID} .pg-card,
  .pg-${ID} .pg-social a,
  .pg-${ID} .pg-handle,
  .pg-${ID} .pg-avatar-inner {
    -webkit-backdrop-filter: blur(14px) saturate(1.3); backdrop-filter: blur(14px) saturate(1.3);
  }
}
.pg-${ID} .pg-card .pg-ico {
  flex: 0 0 auto; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 9px;
  background: var(--bloom-teal); color: var(--accent); font-size: 1rem; border: 1px solid var(--glass-strong);
}
.pg-${ID} .pg-card .pg-label { flex: 1 1 auto; }
.pg-${ID} .pg-card .pg-arrow { flex: 0 0 auto; color: var(--muted); transition: transform .28s ease, color .28s ease; }
.pg-${ID} .pg-card:hover {
  transform: translateY(-3px); background: var(--glass-strong); border-color: rgba(45,212,191,.45);
  box-shadow: inset 0 1px 0 var(--top-hi), 0 12px 30px rgba(6,10,28,.5), 0 0 0 1px rgba(45,212,191,.12), 0 10px 40px rgba(45,212,191,.14);
}
.pg-${ID} .pg-card:hover .pg-arrow { transform: translateX(3px); color: var(--accent); }
.pg-${ID} .pg-card.pg-card--ar .pg-arrow { font-size: .68rem; font-weight: 700; letter-spacing: .06em; }
.pg-${ID} .pg-figure { margin: 1.5rem 0 0; }
.pg-${ID} .pg-img {
  display: block; width: 100%; height: auto; border-radius: 16px;
  border: 1px solid var(--card-border); box-shadow: inset 0 1px 0 var(--top-hi), 0 6px 18px rgba(6,10,28,.35);
}
.pg-${ID} .pg-divider {
  height: 1px; border: 0; margin: 1.6rem 0;
  background: linear-gradient(90deg, transparent, var(--accent), var(--violet), transparent);
  box-shadow: 0 0 12px rgba(45,212,191,.4); opacity: .8;
}
.pg-${ID} .pg-heading {
  margin: 1.75rem 0 .4rem; font-size: .78rem; font-weight: 700; letter-spacing: .14em;
  text-transform: uppercase; color: var(--muted); text-align: center;
}
.pg-${ID} .pg-text {
  margin: 0 auto 1rem; max-width: 30rem; text-align: center; font-size: .92rem; line-height: 1.55; color: var(--muted);
}
.pg-${ID} .pg-social {
  display: flex; justify-content: center; flex-wrap: wrap; gap: .65rem; margin: 1.5rem 0 0;
  list-style: none; padding: 0;
}
.pg-${ID} .pg-social a {
  width: 44px; height: 44px; display: grid; place-items: center; border-radius: 999px;
  color: var(--text); text-decoration: none; background: var(--glass); border: 1px solid var(--card-border);
  box-shadow: inset 0 1px 0 var(--top-hi);
  transition: transform .28s ease, background .28s ease, color .28s ease, box-shadow .28s ease, border-color .28s ease;
}
.pg-${ID} .pg-social a svg { width: 19px; height: 19px; display: block; }
.pg-${ID} .pg-social a .pg-soc-txt { font-size: .95rem; font-weight: 700; line-height: 1; }
.pg-${ID} .pg-social a:hover {
  transform: translateY(-3px); color: var(--accent); border-color: rgba(45,212,191,.45);
  box-shadow: inset 0 1px 0 var(--top-hi), 0 8px 22px rgba(45,212,191,.22);
}
.pg-${ID} .pg-footer { margin-top: 2.25rem; text-align: center; font-size: .78rem; color: var(--muted); }
.pg-${ID} .pg-footer .pg-made { display: block; opacity: .7; margin-top: .55rem; }
.pg-${ID} .pg-verify {
  display: inline-flex; align-items: center; gap: .4rem; color: var(--muted); text-decoration: none;
  padding: .28rem .6rem; border-radius: 999px; border: 1px solid transparent;
  transition: color .28s ease, border-color .28s ease, background .28s ease;
}
.pg-${ID} .pg-verify svg { width: 13px; height: 13px; display: block; opacity: .85; }
.pg-${ID} .pg-verify:hover { color: var(--accent); border-color: rgba(45,212,191,.3); background: var(--glass); }
.pg-${ID} a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 14px; }
.pg-${ID} .pg-social a:focus-visible,
.pg-${ID} .pg-handle:focus-visible,
.pg-${ID} .pg-verify:focus-visible { border-radius: 999px; }
@media (prefers-color-scheme: light) {
  .pg-${ID} { ${lightVars} }
${lightRules(`.pg-${ID}`)}
}
:root[data-theme="light"] .pg-${ID} { ${lightVars} }
${lightRules(`:root[data-theme="light"] .pg-${ID}`)}
@media (prefers-reduced-motion: reduce) {
  .pg-${ID}::before,
  .pg-${ID}::after { animation: none; }
  .pg-${ID} .pg-card,
  .pg-${ID} .pg-social a,
  .pg-${ID} .pg-handle,
  .pg-${ID} .pg-verify,
  .pg-${ID} .pg-card .pg-arrow { transition: background .01s, color .01s, border-color .01s; }
  .pg-${ID} .pg-card:hover,
  .pg-${ID} .pg-social a:hover,
  .pg-${ID} .pg-handle:hover,
  .pg-${ID} .pg-card:hover .pg-arrow { transform: none; }
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
    `<h1 class="pg-name">${escapeHtml(p.displayName)}</h1>`,
  ];
  if (p.tagline) parts.push(`<p class="pg-tagline">${escapeHtml(p.tagline)}</p>`);
  if (handle) {
    parts.push(
      `<a class="pg-handle" href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)}>` +
        `<span class="pg-dot" aria-hidden="true"></span>${escapeHtml(handle.text)}</a>`,
    );
  }
  if (p.bio) parts.push(`<p class="pg-bio">${escapeHtml(p.bio)}</p>`);
  return `<header class="pg-header">${parts.join('')}</header>`;
}

function renderCard(link: LinkBlock, ctx: RenderCtx): string {
  const t = linkTarget(link.url, ctx);
  const ico = link.icon
    ? `<span class="pg-ico" aria-hidden="true">${escapeHtml(link.icon)}</span>`
    : '';
  const cls = t.isAr ? 'pg-card pg-card--ar' : 'pg-card';
  const arrow = t.isAr ? 'ar://' : '→';
  return (
    `<a class="${cls}" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    ico +
    `<span class="pg-label">${escapeHtml(link.label)}</span>` +
    `<span class="pg-arrow" aria-hidden="true">${arrow}</span></a>`
  );
}

function renderLinks(group: LinkBlock[], ctx: RenderCtx): string {
  const cards = group.map((link) => renderCard(link, ctx)).join('');
  return `<nav class="pg-links" aria-label="Links">${cards}</nav>`;
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
    `<a class="pg-card pg-card--ar" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
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
  parts.push(`<span class="pg-made">Made with Aurora Glass</span>`);
  return `<p class="pg-footer">${parts.join('')}</p>`;
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const blocks = def.blocks;

  // The verify/permalink target lives in the footer — pull the first one out.
  let verifyBlock: VerifyBlock | undefined;
  for (const b of blocks) {
    if (b.type === 'verify' && !verifyBlock) verifyBlock = b;
  }

  const out: string[] = [renderHeader(def, ctx)];

  let i = 0;
  while (i < blocks.length) {
    const block: Block = blocks[i];
    if (block.type === 'link') {
      const group: LinkBlock[] = [];
      while (i < blocks.length && blocks[i].type === 'link') {
        group.push(blocks[i] as LinkBlock);
        i++;
      }
      out.push(renderLinks(group, ctx));
      continue;
    }
    switch (block.type) {
      case 'heading':
        out.push(`<h2 class="pg-heading">${escapeHtml(block.text)}</h2>`);
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

export const auroraGlassTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Aurora Glass',
    family: 'modern',
    description: 'Frosted glass cards floating over a drifting aurora bloom.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default auroraGlassTemplate;
