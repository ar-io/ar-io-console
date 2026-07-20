/**
 * Mesh Noir — premium dark mode. A near-black base carries a colorful, heavily
 * blurred mesh glow (magenta / cyan / indigo blobs) behind a translucent dark
 * glass card with a thin hairline border. Links are frosted rows with a subtle
 * glow and a right chevron. Sleek and expensive-feeling.
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

const ID = 'mesh-noir';

const DEFAULT_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, system-ui, sans-serif';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-mesh-noir',
  template: 'mesh-noir',
  title: 'Kairo — Producer & Designer',
  arnsName: 'kairo',
  profile: {
    avatar: 'kv',
    displayName: 'Kairo Vance',
    tagline: 'Music producer & designer',
    bio: 'Late-night synths, sound design and the occasional album cover. Building a small, permanent home for the work.',
    handle: 'kairo.ar.io',
  },
  blocks: [
    { type: 'link', label: 'Listen — latest release', url: 'https://example.com/listen', icon: '►' },
    { type: 'link', label: 'The archive — on the permaweb', url: 'ar://archive', icon: '✦' },
    { type: 'link', label: 'Sample packs & presets', url: 'https://example.com/packs', icon: '◈' },
    { type: 'link', label: 'Book studio time', url: 'https://example.com/booking', icon: '◆' },
    { type: 'divider' },
    { type: 'heading', text: 'Now playing' },
    {
      type: 'text',
      text: 'NOCTURNE — a five-track EP recorded between 2am and sunrise. Out on every platform, minted forever on Arweave.',
    },
    {
      type: 'social',
      items: [
        { platform: 'spotify', url: 'https://example.com' },
        { platform: 'soundcloud', url: 'https://example.com' },
        { platform: 'instagram', url: 'https://example.com' },
        { platform: 'x', url: 'https://example.com' },
        { platform: 'youtube', url: 'https://example.com' },
      ],
    },
    { type: 'verify', label: 'Permanent on Arweave', url: '#' },
  ],
  theme: {
    colors: { bg: '#07070C', surface: '#12121A', text: '#ECECF4', accent: '#C86BFF' },
    font: DEFAULT_FONT,
    buttonShape: 'rounded',
    background: 'mesh-noir',
  },
  layout: { headerAlign: 'center', linkStyle: 'card', width: 'standard' },
};

// --- Inline social glyphs (static, trusted markup) -----------------------------

const SVG_X =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-7.5 8.6L23.3 22h-6.8l-5.3-6.9L5.1 22H2l8-9.2L1.5 2h7l4.8 6.3L18.9 2Zm-1.2 18h1.9L7.4 4H5.4l12.3 16Z"/></svg>';
const SVG_INSTAGRAM =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>';
const SVG_YOUTUBE =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z"/></svg>';
const SVG_SPOTIFY =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.4a.75.75 0 0 1-1 .25c-2.8-1.7-6.3-2.08-10.44-1.14a.75.75 0 1 1-.33-1.46c4.5-1.02 8.4-.58 11.52 1.32.36.22.47.68.25 1.03Zm1.23-2.74a.94.94 0 0 1-1.28.31c-3.2-1.97-8.08-2.54-11.86-1.39a.94.94 0 1 1-.55-1.8c4.32-1.31 9.7-.68 13.38 1.59.44.27.58.85.31 1.29Zm.1-2.85C14.2 8.54 7.99 8.33 4.32 9.45a1.12 1.12 0 1 1-.65-2.15c4.21-1.28 11.07-1.03 15.43 1.55a1.12 1.12 0 1 1-1.15 1.92Z"/></svg>';
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
    case 'spotify':
      return SVG_SPOTIFY;
    default: {
      const ch = (platform.trim()[0] || '•').toUpperCase();
      return `<span class="pg-soc-txt" aria-hidden="true">${escapeHtml(ch)}</span>`;
    }
  }
}

function styleFor(def: PageDef): string {
  const accent = cssColor(def.theme.colors.accent, '#C86BFF');
  const font = cssFontFamily(def.theme.font, DEFAULT_FONT);

  return `
:root { color-scheme: dark; }
.pg-${ID} {
  --mn-bg: #07070C; --mn-ink: #ECECF4; --mn-soft: #9A9AB0; --mn-faint: #6E6E86;
  --mn-accent: ${accent}; --mn-cyan: #38E1FF; --mn-magenta: #FF4FD8; --mn-indigo: #6B5BFF;
  --mn-glass: rgba(255,255,255,.045); --mn-glass-strong: rgba(255,255,255,.08);
  --mn-hair: rgba(255,255,255,.09); --mn-hair-strong: rgba(255,255,255,.16);
  position: relative; min-height: 100vh; color: var(--mn-ink); background: var(--mn-bg);
  font-family: ${font}; -webkit-font-smoothing: antialiased; overflow-x: hidden; isolation: isolate;
}
.pg-${ID} * { box-sizing: border-box; }
.pg-${ID}::before,
.pg-${ID}::after { content: ""; position: fixed; inset: -30% -20%; z-index: -1; pointer-events: none; filter: blur(90px); }
.pg-${ID}::before {
  background:
    radial-gradient(36% 30% at 20% 16%, rgba(255,79,216,.5), transparent 70%),
    radial-gradient(40% 34% at 82% 22%, rgba(56,225,255,.42), transparent 72%),
    radial-gradient(44% 38% at 62% 84%, rgba(107,91,255,.5), transparent 74%);
  animation: pg-mnDrift-${ID} 42s ease-in-out infinite alternate;
}
.pg-${ID}::after {
  background:
    radial-gradient(34% 30% at 78% 70%, rgba(255,79,216,.3), transparent 72%),
    radial-gradient(32% 28% at 16% 66%, rgba(56,225,255,.28), transparent 70%);
  opacity: .85;
  animation: pg-mnDrift-${ID} 54s ease-in-out infinite alternate-reverse;
}
@keyframes pg-mnDrift-${ID} {
  0% { transform: translate3d(-3%,-2%,0) scale(1.05); }
  50% { transform: translate3d(3%,2%,0) scale(1.14); }
  100% { transform: translate3d(-2%,3%,0) scale(1.09); }
}
.pg-${ID} .pg-wrap {
  position: relative; width: 100%; max-width: 34rem; margin: 0 auto;
  padding: clamp(1.5rem,6vw,3.25rem) clamp(1rem,4vw,1.25rem) 3rem;
}
.pg-${ID} .pg-card-shell {
  background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02));
  border: 1px solid var(--mn-hair); border-radius: 26px; padding: clamp(1.5rem,5vw,2.4rem);
  box-shadow: 0 30px 80px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.08);
}
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .pg-${ID} .pg-card-shell,
  .pg-${ID} .pg-row,
  .pg-${ID} .pg-social a,
  .pg-${ID} .pg-handle {
    -webkit-backdrop-filter: blur(20px) saturate(1.4); backdrop-filter: blur(20px) saturate(1.4);
  }
}
.pg-${ID} .pg-header { text-align: center; }
.pg-${ID} .pg-avatar {
  width: 96px; height: 96px; margin: 0 auto 1.05rem; border-radius: 50%; padding: 2px;
  background: conic-gradient(from 210deg, var(--mn-magenta), var(--mn-indigo), var(--mn-cyan), var(--mn-magenta));
  box-shadow: 0 0 30px rgba(255,79,216,.35), 0 0 40px rgba(56,225,255,.2);
}
.pg-${ID} .pg-avatar-inner {
  width: 100%; height: 100%; border-radius: 50%; display: grid; place-items: center;
  background: #0C0C14; color: var(--mn-ink); font-size: 2rem; font-weight: 700;
  letter-spacing: .02em; text-transform: uppercase; overflow: hidden; border: 1px solid var(--mn-hair-strong);
}
.pg-${ID} .pg-avatar-inner img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.pg-${ID} .pg-name { margin: 0 0 .3rem; font-size: clamp(1.5rem,5vw,1.95rem); font-weight: 800; letter-spacing: -.02em; }
.pg-${ID} .pg-tagline {
  margin: 0 0 .7rem; font-size: .94rem; font-weight: 600;
  background: linear-gradient(90deg, var(--mn-magenta), var(--mn-cyan));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.pg-${ID} .pg-handle {
  display: inline-flex; align-items: center; gap: .45rem; margin: 0 0 .85rem;
  padding: .32rem .8rem; border-radius: 999px; font-size: .8rem; font-weight: 600;
  color: var(--mn-soft); text-decoration: none; background: var(--mn-glass); border: 1px solid var(--mn-hair);
  transition: transform .25s ease, border-color .25s ease, color .25s ease;
}
.pg-${ID} .pg-handle .pg-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--mn-cyan); box-shadow: 0 0 8px var(--mn-cyan); flex: 0 0 auto; }
.pg-${ID} .pg-handle:hover { transform: translateY(-2px); color: var(--mn-ink); border-color: var(--mn-hair-strong); }
.pg-${ID} .pg-bio { margin: .2rem auto 0; max-width: 28rem; font-size: .92rem; line-height: 1.55; color: var(--mn-soft); }
.pg-${ID} .pg-links { display: flex; flex-direction: column; gap: .7rem; margin-top: 1.6rem; }
.pg-${ID} .pg-row {
  position: relative; display: flex; align-items: center; gap: .9rem; width: 100%; min-height: 56px;
  padding: .9rem 1.15rem; border-radius: 16px; background: var(--mn-glass); border: 1px solid var(--mn-hair);
  color: var(--mn-ink); font-weight: 600; font-size: 1rem; text-decoration: none; overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
  transition: transform .25s ease, border-color .25s ease, background .25s ease, box-shadow .25s ease;
}
.pg-${ID} .pg-row .pg-ico { flex: 0 0 auto; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 9px; background: var(--mn-glass-strong); color: var(--mn-cyan); font-size: 1rem; border: 1px solid var(--mn-hair); }
.pg-${ID} .pg-row .pg-label { flex: 1 1 auto; text-align: left; }
.pg-${ID} .pg-row .pg-chev { flex: 0 0 auto; color: var(--mn-faint); font-size: 1.3rem; line-height: 1; transition: transform .25s ease, color .25s ease; }
.pg-${ID} .pg-row:hover {
  transform: translateY(-2px); background: var(--mn-glass-strong); border-color: var(--mn-hair-strong);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 0 0 1px rgba(56,225,255,.12), 0 14px 34px rgba(0,0,0,.5), 0 0 30px rgba(107,91,255,.18);
}
.pg-${ID} .pg-row:hover .pg-chev { transform: translateX(3px); color: var(--mn-cyan); }
.pg-${ID} .pg-row.pg-row--ar .pg-chev { font-size: .66rem; font-weight: 700; letter-spacing: .05em; }
.pg-${ID} .pg-heading { margin: 1.7rem 0 .3rem; font-size: .74rem; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--mn-faint); text-align: center; }
.pg-${ID} .pg-text { margin: 0 auto 1rem; max-width: 29rem; text-align: center; font-size: .92rem; line-height: 1.55; color: var(--mn-soft); }
.pg-${ID} .pg-figure { margin: 1.4rem 0 0; }
.pg-${ID} .pg-img { display: block; width: 100%; height: auto; border-radius: 16px; border: 1px solid var(--mn-hair); }
.pg-${ID} .pg-divider { height: 1px; border: 0; margin: 1.5rem 0; background: linear-gradient(90deg, transparent, var(--mn-magenta), var(--mn-cyan), transparent); opacity: .55; }
.pg-${ID} .pg-social { display: flex; justify-content: center; flex-wrap: wrap; gap: .6rem; margin: 1.5rem 0 0; padding: 0; list-style: none; }
.pg-${ID} .pg-social a {
  width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%;
  color: var(--mn-ink); text-decoration: none; background: var(--mn-glass); border: 1px solid var(--mn-hair);
  transition: transform .25s ease, color .25s ease, border-color .25s ease;
}
.pg-${ID} .pg-social a svg { width: 19px; height: 19px; display: block; }
.pg-${ID} .pg-social a .pg-soc-txt { font-size: .95rem; font-weight: 700; line-height: 1; }
.pg-${ID} .pg-social a:hover { transform: translateY(-3px); color: var(--mn-cyan); border-color: var(--mn-hair-strong); }
.pg-${ID} .pg-footer { margin-top: 1.9rem; text-align: center; }
.pg-${ID} .pg-verify {
  display: inline-flex; align-items: center; gap: .4rem; font-size: .8rem; color: var(--mn-faint);
  text-decoration: none; padding: .3rem .7rem; border-radius: 999px; border: 1px solid transparent;
  transition: color .25s ease, border-color .25s ease;
}
.pg-${ID} .pg-verify svg { width: 13px; height: 13px; display: block; }
.pg-${ID} .pg-verify:hover { color: var(--mn-cyan); border-color: var(--mn-hair); }
.pg-${ID} .pg-made { display: block; margin-top: .6rem; font-size: .72rem; color: var(--mn-faint); }
.pg-${ID} a:focus-visible { outline: 2px solid var(--mn-cyan); outline-offset: 2px; border-radius: 999px; }
@media (prefers-reduced-motion: reduce) {
  .pg-${ID}::before,
  .pg-${ID}::after { animation: none; }
  .pg-${ID} .pg-row,
  .pg-${ID} .pg-social a,
  .pg-${ID} .pg-handle,
  .pg-${ID} .pg-row .pg-chev { transition: color .01s, border-color .01s, background .01s, box-shadow .01s; }
  .pg-${ID} .pg-row:hover,
  .pg-${ID} .pg-social a:hover,
  .pg-${ID} .pg-handle:hover,
  .pg-${ID} .pg-row:hover .pg-chev { transform: none; }
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

function renderRow(link: LinkBlock, ctx: RenderCtx): string {
  const t = linkTarget(link.url, ctx);
  const ico = link.icon
    ? `<span class="pg-ico" aria-hidden="true">${escapeHtml(link.icon)}</span>`
    : '';
  const cls = t.isAr ? 'pg-row pg-row--ar' : 'pg-row';
  const chev = t.isAr ? 'ar://' : '›';
  return (
    `<a class="${cls}" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    ico +
    `<span class="pg-label">${escapeHtml(link.label)}</span>` +
    `<span class="pg-chev" aria-hidden="true">${chev}</span></a>`
  );
}

function renderLinks(group: LinkBlock[], ctx: RenderCtx): string {
  const rows = group.map((link) => renderRow(link, ctx)).join('');
  return `<nav class="pg-links" aria-label="Links">${rows}</nav>`;
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
    `<a class="pg-row pg-row--ar" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    `<span class="pg-ico" aria-hidden="true">✦</span>` +
    `<span class="pg-label">${escapeHtml(raw)}</span>` +
    `<span class="pg-chev" aria-hidden="true">ar://</span></a></nav>`
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
  parts.push(`<span class="pg-made">Made with Mesh Noir</span>`);
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

export const meshNoirTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Mesh Noir',
    family: 'modern',
    description: 'Premium dark glass over a blurred magenta-cyan-indigo mesh, with frosted link rows.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default meshNoirTemplate;
