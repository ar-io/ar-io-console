/**
 * Reel — a vertical, stories-inspired stage for short-video creators. A full-height
 * dark canvas with a drifting neon bloom, a segmented "story bar", a big centered
 * avatar with a gradient ring, a punchy oversized name + bio, and bold full-width
 * "story" link cards with strong gradient accents and energetic CSS-only hover
 * (scale / lift / glow). Gen-Z, high-contrast, thumb-stopping.
 *
 * Self-contained: fixed vibrant palette + a theme-able accent, CSS gradients only,
 * no external assets and no `url(` anywhere.
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

const ID = 'reel' as unknown as import('../schema').TemplateId;

const DEFAULT_FONT =
  '"Space Grotesk", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, system-ui, sans-serif';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-reel',
  template: ID,
  title: 'Juno — daily drops',
  arnsName: 'juno',
  profile: {
    avatar: '',
    displayName: 'Juno',
    tagline: 'new video every day at 6pm',
    bio: 'chaotic-good creator making 60-second things about food, gear & tiny wins. 2.3M across the apps. come hang.',
    handle: 'juno.ar.io',
  },
  blocks: [
    { type: 'link', label: 'Watch the latest drop', url: 'https://example.com/latest', icon: '▶' },
    { type: 'link', label: 'Join the Sunday livestream', url: 'https://example.com/live', icon: '◉' },
    { type: 'link', label: 'Shop the gear I actually use', url: 'https://example.com/shop', icon: '🛍' },
    {
      type: 'link',
      label: 'The uncut archive — kept forever on Arweave',
      url: 'ar://mT4nP8qX2vB9kR7wZ1cJ5sD3hN6fA0gE4uL7iO2YpQx',
      icon: '✦',
    },
    { type: 'heading', text: 'The vibe' },
    { type: 'text', text: 'no ads, no gatekeeping — just the good stuff, on repeat.' },
    { type: 'divider' },
    {
      type: 'social',
      items: [
        { platform: 'tiktok', url: 'https://example.com' },
        { platform: 'youtube', url: 'https://example.com' },
        { platform: 'instagram', url: 'https://example.com' },
        { platform: 'twitch', url: 'https://example.com' },
      ],
    },
    { type: 'verify', label: 'Permanent on Arweave', url: '#' },
  ],
  theme: {
    colors: { bg: '#08070C', surface: '#141019', text: '#FBFAFE', accent: '#FF2E93' },
    font: DEFAULT_FONT,
    buttonShape: 'rounded',
    background: 'stage',
  },
  layout: { headerAlign: 'center', linkStyle: 'card', width: 'standard' },
};

/** Curated two-glyph labels for well-known platforms; else derived initials. */
const PLATFORM_GLYPHS: Record<string, string> = {
  tiktok: 'Tk',
  youtube: 'Yt',
  instagram: 'Ig',
  twitch: 'Tw',
  x: 'X',
  twitter: 'X',
  snapchat: 'Sc',
  threads: 'Th',
  discord: 'Dc',
  patreon: 'Pt',
  onlyfans: 'Of',
  kick: 'Ki',
  bluesky: 'Bs',
  spotify: 'Sp',
  soundcloud: 'Sd',
  facebook: 'Fb',
  pinterest: 'Pi',
  telegram: 'Tg',
  email: '@',
  mail: '@',
};

function platformGlyph(platform: string): string {
  const key = platform.trim().toLowerCase();
  if (PLATFORM_GLYPHS[key]) return PLATFORM_GLYPHS[key];
  const letters = key.replace(/[^a-z0-9]/g, '');
  if (!letters) return '·';
  if (letters.length === 1) return letters.toUpperCase();
  return letters[0].toUpperCase() + letters[1];
}

const VERIFY_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="5" y="11" width="14" height="10" rx="2"></rect>' +
  '<path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>';

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const accent = cssColor(c.accent, '#FF2E93');
  const accentSoft = hexToRgba(c.accent, 0.16);
  const accentGlow = hexToRgba(c.accent, 0.42);
  const font = cssFontFamily(def.theme.font, DEFAULT_FONT);

  return `
:root { color-scheme: dark; }
.pg-${ID} {
  --pg-stage: #08070C; --pg-card: #141019; --pg-card-2: #1B1524;
  --pg-text: #FBFAFE; --pg-muted: rgba(251,250,254,0.68); --pg-faint: rgba(251,250,254,0.44);
  --pg-line: rgba(255,255,255,0.10);
  --pg-accent: ${accent}; --pg-accent-2: #7C3AED; --pg-accent-3: #FF8A3C;
  --pg-accent-soft: ${accentSoft}; --pg-accent-glow: ${accentGlow};
  position: relative; min-height: 100vh; background: var(--pg-stage); color: var(--pg-text);
  font-family: ${font}; -webkit-font-smoothing: antialiased; overflow-x: hidden; isolation: isolate;
}
.pg-${ID} * { box-sizing: border-box; }
.pg-${ID}::before {
  content: ""; position: fixed; inset: -25% -15%; z-index: -1; pointer-events: none; filter: blur(70px);
  background:
    radial-gradient(38% 30% at 18% 12%, var(--pg-accent-glow), transparent 70%),
    radial-gradient(40% 34% at 84% 20%, rgba(124,58,237,0.34), transparent 72%),
    radial-gradient(46% 40% at 70% 88%, rgba(255,138,60,0.24), transparent 74%);
  animation: pg-drift-${ID} 34s ease-in-out infinite alternate;
}
@keyframes pg-drift-${ID} {
  0% { transform: translate3d(-3%,-2%,0) scale(1.05); }
  100% { transform: translate3d(3%,3%,0) scale(1.14); }
}
.pg-${ID} .pg-stage {
  position: relative; width: 100%; max-width: 30rem; margin: 0 auto;
  padding: clamp(1.25rem,5vw,2.25rem) clamp(1rem,5vw,1.5rem) 3rem;
}
.pg-${ID} .pg-storybar { display: flex; gap: 5px; margin: 0 0 1.75rem; }
.pg-${ID} .pg-storybar span {
  flex: 1 1 0; height: 3px; border-radius: 999px; background: rgba(255,255,255,0.16); overflow: hidden;
}
.pg-${ID} .pg-storybar span.on { background: linear-gradient(90deg, var(--pg-accent), var(--pg-accent-3)); }
.pg-${ID} .pg-header { text-align: center; margin-bottom: 1.9rem; }
.pg-${ID} .pg-avatar {
  width: 118px; height: 118px; margin: 0 auto 1.15rem; border-radius: 50%; padding: 4px;
  background: conic-gradient(from 210deg, var(--pg-accent), var(--pg-accent-3), var(--pg-accent-2), var(--pg-accent));
  box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 14px 40px -10px var(--pg-accent-glow);
}
.pg-${ID} .pg-avatar-inner {
  width: 100%; height: 100%; border-radius: 50%; display: grid; place-items: center; overflow: hidden;
  background: var(--pg-card); color: var(--pg-text); font-size: 2.6rem; font-weight: 800;
  letter-spacing: 0.01em; text-transform: uppercase; border: 3px solid var(--pg-stage);
}
.pg-${ID} .pg-avatar-inner img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }
.pg-${ID} .pg-name {
  margin: 0 0 0.35rem; font-size: clamp(2rem,9vw,2.9rem); font-weight: 800; line-height: 1.02;
  letter-spacing: -0.03em; word-break: break-word;
}
.pg-${ID} .pg-tagline {
  display: inline-block; margin: 0 0 0.85rem; padding: 0.3rem 0.85rem; border-radius: 999px;
  font-size: 0.8rem; font-weight: 700; letter-spacing: 0.01em; color: var(--pg-text);
  background: var(--pg-accent-soft); border: 1px solid var(--pg-accent-soft); overflow-wrap: anywhere;
}
.pg-${ID} .pg-handle {
  display: inline-flex; align-items: center; gap: 0.45rem; margin: 0 0 0.9rem; padding: 0.32rem 0.8rem;
  border-radius: 999px; border: 1px solid var(--pg-line); background: rgba(255,255,255,0.04);
  font-size: 0.78rem; font-weight: 700; color: var(--pg-muted); text-decoration: none;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  transition: border-color 200ms ease, color 200ms ease, transform 200ms ease;
}
.pg-${ID} .pg-handle .pg-dot {
  width: 7px; height: 7px; border-radius: 50%; background: var(--pg-accent);
  box-shadow: 0 0 10px var(--pg-accent); flex: 0 0 auto;
}
.pg-${ID} .pg-handle:hover { transform: translateY(-2px); color: var(--pg-text); border-color: var(--pg-accent); }
.pg-${ID} .pg-bio {
  margin: 0 auto; max-width: 26rem; font-size: 1rem; line-height: 1.55; color: var(--pg-muted);
  overflow-wrap: anywhere;
}
.pg-${ID} .pg-stories { display: flex; flex-direction: column; gap: 0.9rem; margin-top: 1.75rem; }
.pg-${ID} .pg-story {
  position: relative; display: flex; align-items: center; gap: 0.95rem; min-height: 68px;
  padding: 1rem 1.15rem 1rem 1.35rem; border-radius: 20px; text-decoration: none; color: var(--pg-text);
  background:
    linear-gradient(135deg, var(--pg-accent-soft), rgba(124,58,237,0.10)),
    linear-gradient(var(--pg-card), var(--pg-card));
  border: 1px solid var(--pg-line); overflow: hidden;
  box-shadow: 0 10px 30px -18px rgba(0,0,0,0.9);
  transition: transform 220ms cubic-bezier(.2,.7,.3,1), box-shadow 220ms ease, border-color 220ms ease;
}
.pg-${ID} .pg-story::before {
  content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
  background: linear-gradient(180deg, var(--pg-accent), var(--pg-accent-3));
  transition: width 220ms ease;
}
.pg-${ID} .pg-story:hover {
  transform: translateY(-4px) scale(1.02); border-color: var(--pg-accent);
  box-shadow: 0 22px 50px -16px var(--pg-accent-glow), 0 0 0 1px var(--pg-accent-soft);
}
.pg-${ID} .pg-story:hover::before { width: 7px; }
.pg-${ID} .pg-story:focus-visible { outline: 2px solid var(--pg-accent); outline-offset: 3px; }
.pg-${ID} .pg-story-ico {
  flex: 0 0 auto; width: 42px; height: 42px; display: grid; place-items: center; border-radius: 13px;
  background: rgba(255,255,255,0.06); border: 1px solid var(--pg-line); color: var(--pg-text);
  font-size: 1.2rem; line-height: 1;
}
.pg-${ID} .pg-story-body { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 0.15rem; }
.pg-${ID} .pg-story-label { font-size: 1.02rem; font-weight: 700; line-height: 1.25; letter-spacing: -0.01em; overflow-wrap: anywhere; }
.pg-${ID} .pg-story-sub { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--pg-accent); }
.pg-${ID} .pg-story-go {
  flex: 0 0 auto; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%;
  background: linear-gradient(135deg, var(--pg-accent), var(--pg-accent-3)); color: #0A0A0F;
  font-size: 1.05rem; font-weight: 800; transition: transform 220ms ease;
}
.pg-${ID} .pg-story:hover .pg-story-go { transform: translateX(3px) scale(1.08); }
.pg-${ID} .pg-heading {
  margin: 2rem 0 0.9rem; text-align: center; font-size: 0.76rem; font-weight: 800; letter-spacing: 0.2em;
  text-transform: uppercase; color: var(--pg-faint); overflow-wrap: anywhere;
}
.pg-${ID} .pg-text {
  margin: 0 auto 1rem; max-width: 24rem; text-align: center; font-size: 0.98rem; line-height: 1.55;
  color: var(--pg-muted); overflow-wrap: anywhere;
}
.pg-${ID} .pg-figure { margin: 1.5rem 0 0; }
.pg-${ID} .pg-img { display: block; width: 100%; height: auto; border-radius: 20px; border: 1px solid var(--pg-line); }
.pg-${ID} .pg-divider {
  height: 2px; border: 0; margin: 1.75rem auto; width: 60%; border-radius: 999px;
  background: linear-gradient(90deg, transparent, var(--pg-accent), var(--pg-accent-3), transparent);
  opacity: 0.7;
}
.pg-${ID} .pg-social { display: flex; justify-content: center; flex-wrap: wrap; gap: 0.65rem; margin: 1.75rem 0 0; padding: 0; list-style: none; }
.pg-${ID} .pg-social a {
  width: 48px; height: 48px; display: grid; place-items: center; border-radius: 50%;
  border: 1px solid var(--pg-line); background: rgba(255,255,255,0.04); color: var(--pg-text);
  text-decoration: none; font-size: 0.92rem; font-weight: 800; letter-spacing: 0.01em;
  transition: transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease, color 200ms ease;
}
.pg-${ID} .pg-social a:hover {
  transform: translateY(-4px) scale(1.05); border-color: var(--pg-accent); color: var(--pg-text);
  box-shadow: 0 12px 26px -12px var(--pg-accent-glow);
}
.pg-${ID} .pg-social a:focus-visible { outline: 2px solid var(--pg-accent); outline-offset: 3px; }
.pg-${ID} .pg-footer { margin-top: 2.5rem; text-align: center; }
.pg-${ID} .pg-verify {
  display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.4rem 0.9rem; border-radius: 999px;
  font-size: 0.78rem; font-weight: 700; color: var(--pg-muted); text-decoration: none;
  border: 1px solid var(--pg-line); background: rgba(255,255,255,0.03);
  transition: color 200ms ease, border-color 200ms ease, transform 200ms ease;
}
.pg-${ID} .pg-verify svg { width: 13px; height: 13px; flex: 0 0 auto; color: var(--pg-accent); }
.pg-${ID} .pg-verify:hover { color: var(--pg-text); border-color: var(--pg-accent); transform: translateY(-2px); }
.pg-${ID} .pg-verify:focus-visible { outline: 2px solid var(--pg-accent); outline-offset: 3px; }
.pg-${ID} .pg-made { display: block; margin-top: 0.9rem; font-size: 0.72rem; color: var(--pg-faint); letter-spacing: 0.03em; }
@media (prefers-reduced-motion: reduce) {
  .pg-${ID}::before { animation: none; }
  .pg-${ID} .pg-story, .pg-${ID} .pg-story::before, .pg-${ID} .pg-story-go,
  .pg-${ID} .pg-social a, .pg-${ID} .pg-handle, .pg-${ID} .pg-verify { transition: none; }
  .pg-${ID} .pg-story:hover, .pg-${ID} .pg-social a:hover, .pg-${ID} .pg-handle:hover, .pg-${ID} .pg-verify:hover { transform: none; }
  .pg-${ID} .pg-story:hover .pg-story-go { transform: none; }
}
`.trim();
}

function renderStoryBar(count: number): string {
  if (count <= 0) return '';
  const n = Math.min(count, 8);
  let segs = '';
  for (let k = 0; k < n; k++) {
    segs += `<span${k === 0 ? ' class="on"' : ''}></span>`;
  }
  return `<div class="pg-storybar" aria-hidden="true">${segs}</div>`;
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
      `<a class="pg-handle" href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)} ` +
        `aria-label="${escapeAttr(`My ar.io address: ${handle.text}`)}">` +
        `<span class="pg-dot" aria-hidden="true"></span>${escapeHtml(handle.text)}</a>`,
    );
  }
  if (p.bio) parts.push(`<p class="pg-bio">${escapeHtml(p.bio)}</p>`);
  return `<header class="pg-header">${parts.join('')}</header>`;
}

function renderStory(link: LinkBlock, ctx: RenderCtx): string {
  const t = linkTarget(link.url, ctx);
  const icon = (link.icon || '').trim();
  const ico = `<span class="pg-story-ico" aria-hidden="true">${icon ? escapeHtml(icon) : '&#9654;'}</span>`;
  const sub = t.isAr
    ? `<span class="pg-story-sub">Permaweb · ar://</span>`
    : '';
  const go = t.isAr ? '&#8599;' : '&rarr;';
  return (
    `<a class="pg-story" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    ico +
    `<span class="pg-story-body"><span class="pg-story-label">${escapeHtml(link.label)}</span>${sub}</span>` +
    `<span class="pg-story-go" aria-hidden="true">${go}</span></a>`
  );
}

function renderEmbedStory(arweave: string, ctx: RenderCtx): string {
  const raw = arweave.trim();
  const url = raw.toLowerCase().startsWith('ar://') ? raw : `ar://${raw}`;
  const t = linkTarget(url, ctx);
  return (
    `<a class="pg-story" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    `<span class="pg-story-ico" aria-hidden="true">&#10022;</span>` +
    `<span class="pg-story-body"><span class="pg-story-label">${escapeHtml(raw)}</span>` +
    `<span class="pg-story-sub">Permaweb · ar://</span></span>` +
    `<span class="pg-story-go" aria-hidden="true">&#8599;</span></a>`
  );
}

function renderSocial(block: SocialBlock, ctx: RenderCtx): string {
  const items = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      const label = item.platform ? escapeAttr(item.platform) : 'Social link';
      return (
        `<li><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)} aria-label="${label}">` +
        `<span aria-hidden="true">${escapeHtml(platformGlyph(item.platform))}</span></a></li>`
      );
    })
    .join('');
  return `<ul class="pg-social" aria-label="Social links">${items}</ul>`;
}

function renderFooter(verifyBlock: VerifyBlock | undefined, ctx: RenderCtx): string {
  const v = verifyTarget(verifyBlock, ctx);
  const parts: string[] = [];
  if (v) {
    const label = verifyBlock && verifyBlock.label ? verifyBlock.label : 'Permanent on Arweave';
    parts.push(
      `<a class="pg-verify" href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)} ` +
        `aria-label="${escapeAttr('Verify this page: permanent on Arweave')}">` +
        `${VERIFY_SVG} ${escapeHtml(label)}</a>`,
    );
  }
  parts.push(`<span class="pg-made">Made with Reel</span>`);
  return `<footer class="pg-footer">${parts.join('')}</footer>`;
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const blocks = def.blocks;

  let verifyBlock: VerifyBlock | undefined;
  let storyCount = 0;
  for (const b of blocks) {
    if (b.type === 'verify' && !verifyBlock) verifyBlock = b;
    if (b.type === 'link' || b.type === 'embed') storyCount++;
  }

  const out: string[] = [renderStoryBar(storyCount), renderHeader(def, ctx)];

  let i = 0;
  while (i < blocks.length) {
    const block: Block = blocks[i];
    if (block.type === 'link') {
      const group: string[] = [];
      while (i < blocks.length && blocks[i].type === 'link') {
        group.push(renderStory(blocks[i] as LinkBlock, ctx));
        i++;
      }
      out.push(`<nav class="pg-stories" aria-label="Links">${group.join('')}</nav>`);
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
            `<figure class="pg-figure"><img class="pg-img" src="${escapeAttr(src)}" ` +
              `alt="${escapeAttr(block.alt || '')}" loading="lazy" /></figure>`,
          );
        }
        break;
      }
      case 'embed':
        out.push(`<nav class="pg-stories" aria-label="Links">${renderEmbedStory(block.arweave, ctx)}</nav>`);
        break;
      case 'verify':
        // Rendered in the footer via the pre-scan above.
        break;
    }
    i++;
  }

  out.push(renderFooter(verifyBlock, ctx));
  return `<main class="pg-stage">${out.join('')}</main>`;
}

export const reelTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Reel',
    family: 'creator',
    description: 'A stories-inspired dark stage with bold full-width story cards for video creators.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default reelTemplate;
