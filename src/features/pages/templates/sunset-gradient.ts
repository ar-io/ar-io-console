/**
 * Sunset Gradient — the flagship modern link-in-bio. A warm, full-bleed sunset
 * mesh (coral / amber / rose / violet radial blooms) drifts behind a centered,
 * frosted-glass card with big glassy pill buttons and a gentle hover lift.
 * Premium, clean, high-converting.
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
  linkTarget,
  multiline,
  resolveHandle,
  safeImgSrc,
  verifyTarget,
} from './shared';

const ID = 'sunset-gradient';

const DEFAULT_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, system-ui, sans-serif';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-sunset-gradient',
  template: 'sunset-gradient',
  title: 'Marisol Reyes — Photographer & traveler',
  arnsName: 'marisol',
  profile: {
    avatar: 'mr',
    displayName: 'Marisol Reyes',
    tagline: 'Photographer & traveler',
    bio: 'Chasing golden hour across coastlines and canyons. Prints, field notes & the occasional workshop — all in one place.',
    handle: 'marisol.ar.io',
  },
  blocks: [
    { type: 'link', label: 'View my portfolio', url: 'https://example.com/portfolio', icon: '◆' },
    { type: 'link', label: 'Shop print editions', url: 'https://example.com/prints', icon: '✦' },
    { type: 'link', label: 'Field notes — on the permaweb', url: 'ar://fieldnotes', icon: '✧' },
    { type: 'link', label: 'Join the newsletter', url: 'https://example.com/newsletter', icon: '✉' },
    { type: 'divider' },
    { type: 'heading', text: 'From the field' },
    {
      type: 'text',
      text: 'Just back from three weeks along the Oaxacan coast. New series & behind-the-scenes notes are up now.',
    },
    {
      type: 'social',
      items: [
        { platform: 'x', url: 'https://example.com' },
        { platform: 'instagram', url: 'https://example.com' },
        { platform: 'youtube', url: 'https://example.com' },
      ],
    },
    { type: 'verify', label: 'Permanent on Arweave', url: '#' },
  ],
  theme: {
    colors: { bg: '#FFD8A8', surface: '#FFFFFF', text: '#3A2A44', accent: '#E4572E' },
    font: DEFAULT_FONT,
    buttonShape: 'pill',
    background: 'sunset',
  },
  layout: { headerAlign: 'center', linkStyle: 'button', width: 'standard' },
};

// --- Inline social glyphs (static, trusted markup) -----------------------------

const SVG_X =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-7.5 8.6L23.3 22h-6.8l-5.3-6.9L5.1 22H2l8-9.2L1.5 2h7l4.8 6.3L18.9 2Zm-1.2 18h1.9L7.4 4H5.4l12.3 16Z"/></svg>';
const SVG_INSTAGRAM =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>';
const SVG_YOUTUBE =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z"/></svg>';
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
    case 'youtube':
    case 'yt':
      return SVG_YOUTUBE;
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
  const accent = cssColor(def.theme.colors.accent, '#E4572E');
  const font = cssFontFamily(def.theme.font, DEFAULT_FONT);

  return `
:root { color-scheme: light dark; }
.pg-${ID} {
  --sg-ink: #3A2A44; --sg-soft: #6A5870; --sg-accent: ${accent};
  --sg-glass: rgba(255,255,255,.58); --sg-glass-strong: rgba(255,255,255,.8);
  --sg-border: rgba(255,255,255,.7); --sg-card: rgba(255,255,255,.5);
  --sg-shadow: 0 24px 70px rgba(86,28,66,.28);
  position: relative; min-height: 100vh; color: var(--sg-ink); background: #FFD8A8;
  font-family: ${font}; -webkit-font-smoothing: antialiased; overflow-x: hidden; isolation: isolate;
}
.pg-${ID} * { box-sizing: border-box; }
.pg-${ID}::before,
.pg-${ID}::after { content: ""; position: fixed; inset: -25% -15%; z-index: -1; pointer-events: none; }
.pg-${ID}::before {
  background:
    radial-gradient(38% 34% at 16% 14%, rgba(255,196,112,.95), transparent 68%),
    radial-gradient(42% 38% at 84% 10%, rgba(255,116,108,.9), transparent 70%),
    radial-gradient(48% 44% at 82% 84%, rgba(126,92,255,.66), transparent 72%),
    radial-gradient(48% 44% at 14% 88%, rgba(248,96,150,.78), transparent 72%),
    linear-gradient(155deg, #FFD8A8 0%, #FF7E8A 52%, #6A4AA0 100%);
  animation: pg-sgDrift-${ID} 34s ease-in-out infinite alternate;
}
.pg-${ID}::after {
  background:
    radial-gradient(40% 36% at 70% 30%, rgba(255,158,120,.5), transparent 72%),
    radial-gradient(38% 34% at 26% 70%, rgba(196,120,255,.42), transparent 72%);
  filter: blur(40px); opacity: .8;
  animation: pg-sgDrift-${ID} 46s ease-in-out infinite alternate-reverse;
}
@keyframes pg-sgDrift-${ID} {
  0% { transform: translate3d(-3%,-2%,0) scale(1.05); }
  50% { transform: translate3d(3%,2%,0) scale(1.12); }
  100% { transform: translate3d(-2%,3%,0) scale(1.08); }
}
.pg-${ID} .pg-wrap {
  position: relative; width: 100%; max-width: 33rem; margin: 0 auto;
  padding: clamp(1.5rem,6vw,3rem) clamp(1rem,4vw,1.25rem) 3rem;
}
.pg-${ID} .pg-card-shell {
  background: var(--sg-card); border: 1px solid var(--sg-border); border-radius: 30px;
  padding: clamp(1.5rem,5vw,2.5rem);
  box-shadow: var(--sg-shadow), inset 0 1px 0 rgba(255,255,255,.75);
}
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .pg-${ID} .pg-card-shell,
  .pg-${ID} .pg-btn,
  .pg-${ID} .pg-social a,
  .pg-${ID} .pg-handle {
    -webkit-backdrop-filter: blur(22px) saturate(1.5); backdrop-filter: blur(22px) saturate(1.5);
  }
}
.pg-${ID} .pg-header { text-align: center; }
.pg-${ID} .pg-avatar {
  width: 100px; height: 100px; margin: 0 auto 1.1rem; border-radius: 50%; padding: 3px;
  background: conic-gradient(from 200deg, #FFB86C, #FF6B8B, #7A5FFF, #FFB86C);
  box-shadow: 0 10px 30px rgba(255,107,139,.4);
}
.pg-${ID} .pg-avatar-inner {
  width: 100%; height: 100%; border-radius: 50%; display: grid; place-items: center;
  background: var(--sg-glass-strong); color: var(--sg-accent); font-size: 2.1rem; font-weight: 700;
  letter-spacing: .02em; text-transform: uppercase; overflow: hidden;
}
.pg-${ID} .pg-avatar-inner img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.pg-${ID} .pg-name { margin: 0 0 .3rem; font-size: clamp(1.5rem,5vw,1.95rem); font-weight: 800; letter-spacing: -.01em; }
.pg-${ID} .pg-tagline { margin: 0 0 .7rem; font-size: .95rem; font-weight: 600; color: var(--sg-accent); }
.pg-${ID} .pg-handle {
  display: inline-flex; align-items: center; gap: .45rem; margin: 0 0 .85rem;
  padding: .32rem .8rem; border-radius: 999px; font-size: .8rem; font-weight: 600;
  color: var(--sg-ink); text-decoration: none; background: var(--sg-glass);
  border: 1px solid var(--sg-border); box-shadow: inset 0 1px 0 rgba(255,255,255,.6);
  transition: transform .25s ease, box-shadow .25s ease;
}
.pg-${ID} .pg-handle .pg-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--sg-accent); box-shadow: 0 0 8px var(--sg-accent); flex: 0 0 auto; }
.pg-${ID} .pg-handle:hover { transform: translateY(-2px); box-shadow: inset 0 1px 0 rgba(255,255,255,.6), 0 10px 22px rgba(120,50,80,.18); }
.pg-${ID} .pg-bio { margin: .2rem auto 0; max-width: 28rem; font-size: .93rem; line-height: 1.55; color: var(--sg-soft); }
.pg-${ID} .pg-links { display: flex; flex-direction: column; gap: .8rem; margin-top: 1.6rem; }
.pg-${ID} .pg-btn {
  display: flex; align-items: center; gap: .85rem; width: 100%; min-height: 54px;
  padding: .9rem 1.2rem; border-radius: 999px; background: var(--sg-glass);
  border: 1px solid var(--sg-border); color: var(--sg-ink); font-weight: 600; font-size: 1rem;
  text-decoration: none; box-shadow: 0 8px 18px rgba(120,50,80,.12), inset 0 1px 0 rgba(255,255,255,.75);
  transition: transform .25s ease, box-shadow .25s ease, background .25s ease;
}
.pg-${ID} .pg-btn .pg-ico { flex: 0 0 auto; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; background: rgba(255,255,255,.6); color: var(--sg-accent); font-size: 1rem; }
.pg-${ID} .pg-btn .pg-label { flex: 1 1 auto; text-align: left; }
.pg-${ID} .pg-btn .pg-arrow { flex: 0 0 auto; color: var(--sg-soft); transition: transform .25s ease, color .25s ease; }
.pg-${ID} .pg-btn:hover { transform: translateY(-3px); background: var(--sg-glass-strong); box-shadow: 0 16px 32px rgba(120,50,80,.2), inset 0 1px 0 rgba(255,255,255,.85); }
.pg-${ID} .pg-btn:hover .pg-arrow { transform: translateX(3px); color: var(--sg-accent); }
.pg-${ID} .pg-btn.pg-btn--ar .pg-arrow { font-size: .66rem; font-weight: 700; letter-spacing: .05em; }
.pg-${ID} .pg-heading { margin: 1.7rem 0 .3rem; font-size: .76rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--sg-soft); text-align: center; }
.pg-${ID} .pg-text { margin: 0 auto 1rem; max-width: 29rem; text-align: center; font-size: .92rem; line-height: 1.55; color: var(--sg-soft); }
.pg-${ID} .pg-figure { margin: 1.4rem 0 0; }
.pg-${ID} .pg-img { display: block; width: 100%; height: auto; border-radius: 20px; border: 1px solid var(--sg-border); box-shadow: 0 10px 24px rgba(120,50,80,.18); }
.pg-${ID} .pg-divider { height: 1px; border: 0; margin: 1.5rem 0; background: linear-gradient(90deg, transparent, rgba(255,107,139,.6), rgba(122,95,255,.5), transparent); }
.pg-${ID} .pg-social { display: flex; justify-content: center; flex-wrap: wrap; gap: .6rem; margin: 1.5rem 0 0; padding: 0; list-style: none; }
.pg-${ID} .pg-social a {
  width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%;
  color: var(--sg-ink); text-decoration: none; background: var(--sg-glass);
  border: 1px solid var(--sg-border); box-shadow: inset 0 1px 0 rgba(255,255,255,.7);
  transition: transform .25s ease, color .25s ease, background .25s ease;
}
.pg-${ID} .pg-social a svg { width: 19px; height: 19px; display: block; }
.pg-${ID} .pg-social a .pg-soc-txt { font-size: .95rem; font-weight: 700; line-height: 1; }
.pg-${ID} .pg-social a:hover { transform: translateY(-3px); color: var(--sg-accent); background: var(--sg-glass-strong); }
.pg-${ID} .pg-footer { margin-top: 1.9rem; text-align: center; }
.pg-${ID} .pg-verify {
  display: inline-flex; align-items: center; gap: .4rem; font-size: .8rem; color: var(--sg-soft);
  text-decoration: none; padding: .3rem .7rem; border-radius: 999px; border: 1px solid transparent;
  transition: color .25s ease, border-color .25s ease, background .25s ease;
}
.pg-${ID} .pg-verify svg { width: 13px; height: 13px; display: block; }
.pg-${ID} .pg-verify:hover { color: var(--sg-accent); border-color: var(--sg-border); background: var(--sg-glass); }
.pg-${ID} .pg-made { display: block; margin-top: .6rem; font-size: .72rem; color: var(--sg-soft); opacity: .75; }
.pg-${ID} a:focus-visible { outline: 2px solid var(--sg-accent); outline-offset: 2px; border-radius: 999px; }
@media (prefers-color-scheme: dark) {
  .pg-${ID} {
    --sg-ink: #F6ECFF; --sg-soft: #CBB9D8;
    --sg-glass: rgba(28,14,38,.44); --sg-glass-strong: rgba(40,22,54,.62);
    --sg-border: rgba(255,255,255,.14); --sg-card: rgba(22,11,30,.44);
    --sg-shadow: 0 24px 70px rgba(0,0,0,.5); background: #241031;
  }
  .pg-${ID}::before { opacity: .72; }
  .pg-${ID}::after { opacity: .55; }
  .pg-${ID} .pg-btn .pg-ico,
  .pg-${ID} .pg-avatar-inner { background: rgba(255,255,255,.08); }
}
:root[data-theme="dark"] .pg-${ID} {
  --sg-ink: #F6ECFF; --sg-soft: #CBB9D8;
  --sg-glass: rgba(28,14,38,.44); --sg-glass-strong: rgba(40,22,54,.62);
  --sg-border: rgba(255,255,255,.14); --sg-card: rgba(22,11,30,.44);
  --sg-shadow: 0 24px 70px rgba(0,0,0,.5); background: #241031;
}
:root[data-theme="dark"] .pg-${ID}::before { opacity: .72; }
:root[data-theme="dark"] .pg-${ID}::after { opacity: .55; }
:root[data-theme="dark"] .pg-${ID} .pg-btn .pg-ico,
:root[data-theme="dark"] .pg-${ID} .pg-avatar-inner { background: rgba(255,255,255,.08); }
@media (prefers-reduced-motion: reduce) {
  .pg-${ID}::before,
  .pg-${ID}::after { animation: none; }
  .pg-${ID} .pg-btn,
  .pg-${ID} .pg-social a,
  .pg-${ID} .pg-handle,
  .pg-${ID} .pg-btn .pg-arrow { transition: background .01s, color .01s, box-shadow .01s; }
  .pg-${ID} .pg-btn:hover,
  .pg-${ID} .pg-social a:hover,
  .pg-${ID} .pg-handle:hover,
  .pg-${ID} .pg-btn:hover .pg-arrow { transform: none; }
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

function renderButton(link: LinkBlock, ctx: RenderCtx): string {
  const t = linkTarget(link.url, ctx);
  const ico = link.icon
    ? `<span class="pg-ico" aria-hidden="true">${escapeHtml(link.icon)}</span>`
    : '';
  const cls = t.isAr ? 'pg-btn pg-btn--ar' : 'pg-btn';
  const arrow = t.isAr ? 'ar://' : '→';
  return (
    `<a class="${cls}" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    ico +
    `<span class="pg-label">${escapeHtml(link.label)}</span>` +
    `<span class="pg-arrow" aria-hidden="true">${arrow}</span></a>`
  );
}

function renderLinks(group: LinkBlock[], ctx: RenderCtx): string {
  const buttons = group.map((link) => renderButton(link, ctx)).join('');
  return `<nav class="pg-links" aria-label="Links">${buttons}</nav>`;
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
    `<a class="pg-btn pg-btn--ar" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
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
  parts.push(`<span class="pg-made">Made with Sunset Gradient</span>`);
  return `<p class="pg-footer">${parts.join('')}</p>`;
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const blocks = def.blocks;

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
  return `<main class="pg-wrap"><div class="pg-card-shell">${out.join('')}</div></main>`;
}

export const sunsetGradientTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Sunset Gradient',
    family: 'modern',
    description: 'A warm sunset mesh behind a frosted-glass card with big glassy pill buttons.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default sunsetGradientTemplate;
