/**
 * Portfolio Grid — a clean, gallery-style portfolio for creatives. A left-aligned
 * header (avatar, name, role, bio, ArNS handle) sits above a responsive grid of
 * project tiles: each consecutive run of link blocks becomes a set of cards, with
 * the link's icon/emoji used as a tile accent. Headings act as section breaks and
 * a circular social row closes the page. Image-friendly, understated, print-clean.
 *
 * Self-contained: fixed palette + a theme-able accent, CSS gradients only, no
 * external assets and no `url(` anywhere.
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

const ID = 'portfolio-grid' as unknown as import('../schema').TemplateId;

const DEFAULT_FONT =
  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, system-ui, sans-serif';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-portfolio-grid',
  template: ID,
  title: 'Ines Marchetti — Photographer & Art Director',
  arnsName: 'ines',
  profile: {
    avatar: '',
    displayName: 'Ines Marchetti',
    tagline: 'Photographer & art director',
    bio: 'I make quiet, sunlit images for people who build careful things. Editorial, product, and the occasional short film. Based in Lisbon, working anywhere the light is good.',
    handle: 'ines.ar.io',
  },
  blocks: [
    { type: 'heading', text: 'Selected work' },
    { type: 'link', label: 'Sunroom — editorial series', url: 'https://example.com/sunroom', icon: '◐' },
    { type: 'link', label: 'Field Notes — product photography', url: 'https://example.com/field-notes', icon: '❏' },
    { type: 'link', label: 'Longform — a short documentary', url: 'https://example.com/longform', icon: '▷' },
    {
      type: 'link',
      label: 'The Archive — preserved on the permaweb',
      url: 'ar://mT4nP8qX2vB9kR7wZ1cJ5sD3hN6fA0gE4uL7iO2YpQx',
      icon: '✦',
    },
    { type: 'divider' },
    { type: 'heading', text: 'Studio' },
    {
      type: 'text',
      text: 'Available for commissions from spring 2026. Prints and licensing on request — say hello and tell me what you are making.',
    },
    { type: 'link', label: 'Book a shoot', url: 'https://example.com/booking', icon: '✎' },
    { type: 'link', label: 'Print shop', url: 'https://example.com/shop', icon: '❍' },
    {
      type: 'social',
      items: [
        { platform: 'instagram', url: 'https://example.com' },
        { platform: 'behance', url: 'https://example.com' },
        { platform: 'x', url: 'https://example.com' },
        { platform: 'email', url: 'mailto:hello@example.com' },
      ],
    },
    { type: 'verify', label: 'Permanent on Arweave', url: '#' },
  ],
  theme: {
    colors: { bg: '#FBFAF8', surface: '#FFFFFF', text: '#1B1B1F', accent: '#4338CA' },
    font: DEFAULT_FONT,
    buttonShape: 'rounded',
    background: 'gallery',
  },
  layout: { headerAlign: 'left', linkStyle: 'grid', width: 'wide' },
};

/** Curated two-glyph labels for well-known platforms; else derived initials. */
const PLATFORM_GLYPHS: Record<string, string> = {
  twitter: 'X',
  x: 'X',
  github: 'Gh',
  gitlab: 'Gl',
  dribbble: 'Dr',
  behance: 'Be',
  linkedin: 'in',
  instagram: 'Ig',
  facebook: 'Fb',
  youtube: 'Yt',
  vimeo: 'Vm',
  twitch: 'Tw',
  mastodon: 'Ma',
  bluesky: 'Bs',
  threads: 'Th',
  tiktok: 'Tk',
  pinterest: 'Pi',
  discord: 'Dc',
  telegram: 'Tg',
  medium: 'Md',
  substack: 'Sb',
  email: '@',
  mail: '@',
  website: 'Ww',
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
  const accent = cssColor(c.accent, '#4338CA');
  const accentSoftLight = hexToRgba(c.accent, 0.1);
  const accentSoftDark = hexToRgba(c.accent, 0.22);
  const font = cssFontFamily(def.theme.font, DEFAULT_FONT);

  return `
:root { color-scheme: light dark; }
.pg-${ID} {
  --pg-bg: #FBFAF8; --pg-surface: #FFFFFF; --pg-text: #1B1B1F;
  --pg-muted: rgba(27,27,31,0.62); --pg-faint: rgba(27,27,31,0.42);
  --pg-border: rgba(27,27,31,0.10); --pg-line: rgba(27,27,31,0.08);
  --pg-accent: ${accent}; --pg-accent-soft: ${accentSoftLight};
  --pg-shadow: 0 1px 2px rgba(27,27,31,0.04), 0 10px 30px -18px rgba(27,27,31,0.30);
  --pg-shadow-hover: 0 16px 40px -18px rgba(27,27,31,0.32);
  min-height: 100vh; background: var(--pg-bg); color: var(--pg-text);
  font-family: ${font}; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
.pg-${ID} * { box-sizing: border-box; }
:root[data-theme="light"] .pg-${ID} {
  --pg-bg: #FBFAF8; --pg-surface: #FFFFFF; --pg-text: #1B1B1F;
  --pg-muted: rgba(27,27,31,0.62); --pg-faint: rgba(27,27,31,0.42);
  --pg-border: rgba(27,27,31,0.10); --pg-line: rgba(27,27,31,0.08);
  --pg-accent-soft: ${accentSoftLight};
  --pg-shadow: 0 1px 2px rgba(27,27,31,0.04), 0 10px 30px -18px rgba(27,27,31,0.30);
  --pg-shadow-hover: 0 16px 40px -18px rgba(27,27,31,0.32);
}
@media (prefers-color-scheme: dark) {
  .pg-${ID} {
    --pg-bg: #101014; --pg-surface: #17171C; --pg-text: #F4F4F5;
    --pg-muted: rgba(244,244,245,0.64); --pg-faint: rgba(244,244,245,0.44);
    --pg-border: rgba(255,255,255,0.09); --pg-line: rgba(255,255,255,0.07);
    --pg-accent-soft: ${accentSoftDark};
    --pg-shadow: 0 10px 30px -18px rgba(0,0,0,0.7);
    --pg-shadow-hover: 0 18px 44px -16px rgba(0,0,0,0.8);
  }
}
:root[data-theme="dark"] .pg-${ID} {
  --pg-bg: #101014; --pg-surface: #17171C; --pg-text: #F4F4F5;
  --pg-muted: rgba(244,244,245,0.64); --pg-faint: rgba(244,244,245,0.44);
  --pg-border: rgba(255,255,255,0.09); --pg-line: rgba(255,255,255,0.07);
  --pg-accent-soft: ${accentSoftDark};
  --pg-shadow: 0 10px 30px -18px rgba(0,0,0,0.7);
  --pg-shadow-hover: 0 18px 44px -16px rgba(0,0,0,0.8);
}
.pg-${ID} .pg-wrap {
  width: 100%; max-width: 68rem; margin: 0 auto;
  padding: clamp(1.75rem,5vw,3.5rem) clamp(1rem,4vw,2rem) 3.5rem;
}
.pg-${ID} .pg-header {
  display: flex; flex-wrap: wrap; align-items: flex-end; gap: clamp(1rem,3vw,1.75rem);
  padding-bottom: 1.75rem; margin-bottom: 1.75rem; border-bottom: 1px solid var(--pg-line);
}
.pg-${ID} .pg-avatar {
  flex: 0 0 auto; width: 84px; height: 84px; border-radius: 20px;
  background: linear-gradient(150deg, var(--pg-accent), var(--pg-text));
  display: grid; place-items: center; color: #fff; font-weight: 700; font-size: 1.7rem;
  letter-spacing: 0.02em; text-transform: uppercase; overflow: hidden;
  box-shadow: var(--pg-shadow);
}
.pg-${ID} .pg-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 20px; }
.pg-${ID} .pg-id { flex: 1 1 16rem; min-width: 0; }
.pg-${ID} .pg-name {
  margin: 0 0 0.25rem; font-size: clamp(1.6rem,5vw,2.4rem); font-weight: 800;
  line-height: 1.05; letter-spacing: -0.02em; word-break: break-word;
}
.pg-${ID} .pg-role {
  margin: 0 0 0.7rem; font-size: 0.9rem; font-weight: 600; letter-spacing: 0.02em;
  text-transform: uppercase; color: var(--pg-accent); word-break: break-word;
}
.pg-${ID} .pg-bio {
  margin: 0 0 0.9rem; max-width: 46ch; font-size: 0.98rem; line-height: 1.6; color: var(--pg-muted);
  overflow-wrap: anywhere;
}
.pg-${ID} .pg-handle {
  display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.34rem 0.8rem;
  border-radius: 999px; border: 1px solid var(--pg-border); background: var(--pg-surface);
  font-size: 0.78rem; font-weight: 600; letter-spacing: 0.01em; color: var(--pg-muted);
  text-decoration: none; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  transition: border-color 180ms ease, color 180ms ease, transform 180ms ease;
}
.pg-${ID} .pg-handle .pg-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--pg-accent); flex: 0 0 auto; }
.pg-${ID} .pg-handle:hover { border-color: var(--pg-accent); color: var(--pg-text); transform: translateY(-1px); }
.pg-${ID} .pg-section {
  margin: 2.25rem 0 1rem; font-size: 0.76rem; font-weight: 700; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--pg-faint); overflow-wrap: anywhere;
}
.pg-${ID} .pg-section:first-child { margin-top: 0; }
.pg-${ID} .pg-note {
  margin: 0 0 1.25rem; max-width: 52ch; font-size: 0.96rem; line-height: 1.6; color: var(--pg-muted);
  overflow-wrap: anywhere;
}
.pg-${ID} .pg-grid { display: grid; grid-template-columns: 1fr; gap: 14px; margin: 0 0 1.25rem; }
@media (min-width: 560px) { .pg-${ID} .pg-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 900px) { .pg-${ID} .pg-grid { grid-template-columns: repeat(3, 1fr); } }
.pg-${ID} .pg-tile {
  position: relative; display: flex; flex-direction: column; gap: 0.9rem; min-height: 148px;
  padding: 1.15rem 1.2rem; border-radius: 18px; background: var(--pg-surface);
  border: 1px solid var(--pg-border); box-shadow: var(--pg-shadow);
  text-decoration: none; color: var(--pg-text); overflow: hidden;
  transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
}
.pg-${ID} .pg-tile:hover { transform: translateY(-3px); box-shadow: var(--pg-shadow-hover); border-color: var(--pg-accent); }
.pg-${ID} .pg-tile:focus-visible { outline: 2px solid var(--pg-accent); outline-offset: 3px; }
.pg-${ID} .pg-tile-top { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; }
.pg-${ID} .pg-ico {
  flex: 0 0 auto; width: 40px; height: 40px; display: grid; place-items: center; border-radius: 12px;
  background: var(--pg-accent-soft); color: var(--pg-accent); font-size: 1.15rem; line-height: 1;
}
.pg-${ID} .pg-ico--empty { width: 12px; height: 12px; border-radius: 4px; background: var(--pg-accent); opacity: 0.55; }
.pg-${ID} .pg-artag {
  font-size: 0.62rem; font-weight: 700; letter-spacing: 0.06em; color: var(--pg-accent);
  border: 1px solid var(--pg-accent-soft); padding: 0.15rem 0.4rem; border-radius: 999px;
}
.pg-${ID} .pg-tile-label {
  flex: 1 1 auto; font-size: 1.02rem; font-weight: 650; line-height: 1.3; letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}
.pg-${ID} .pg-tile-go {
  display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; font-weight: 600;
  color: var(--pg-faint); transition: color 200ms ease, transform 200ms ease;
}
.pg-${ID} .pg-tile:hover .pg-tile-go { color: var(--pg-accent); transform: translateX(3px); }
.pg-${ID} .pg-figure { margin: 0 0 1.25rem; }
.pg-${ID} .pg-img {
  display: block; width: 100%; height: auto; border-radius: 18px;
  border: 1px solid var(--pg-border); box-shadow: var(--pg-shadow);
}
.pg-${ID} .pg-divider { height: 1px; border: 0; margin: 1.75rem 0; background: var(--pg-line); }
.pg-${ID} .pg-social { display: flex; flex-wrap: wrap; gap: 0.6rem; margin: 1.5rem 0 0; padding: 0; list-style: none; }
.pg-${ID} .pg-social a {
  width: 44px; height: 44px; display: grid; place-items: center; border-radius: 999px;
  border: 1px solid var(--pg-border); background: var(--pg-surface); color: var(--pg-text);
  text-decoration: none; font-size: 0.9rem; font-weight: 700; letter-spacing: 0.01em;
  transition: transform 180ms ease, border-color 180ms ease, color 180ms ease;
}
.pg-${ID} .pg-social a:hover { transform: translateY(-3px); border-color: var(--pg-accent); color: var(--pg-accent); }
.pg-${ID} .pg-social a:focus-visible { outline: 2px solid var(--pg-accent); outline-offset: 3px; }
.pg-${ID} .pg-footer {
  margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px solid var(--pg-line);
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;
  font-size: 0.8rem; color: var(--pg-faint);
}
.pg-${ID} .pg-verify {
  display: inline-flex; align-items: center; gap: 0.4rem; color: var(--pg-muted); text-decoration: none;
  border-bottom: 1px solid transparent; transition: color 180ms ease, border-color 180ms ease;
}
.pg-${ID} .pg-verify svg { width: 13px; height: 13px; flex: 0 0 auto; color: var(--pg-accent); }
.pg-${ID} .pg-verify:hover { color: var(--pg-text); border-bottom-color: var(--pg-border); }
.pg-${ID} .pg-verify:focus-visible { outline: 2px solid var(--pg-accent); outline-offset: 3px; }
.pg-${ID} .pg-made { margin-left: auto; opacity: 0.85; }
@media (prefers-reduced-motion: reduce) {
  .pg-${ID} .pg-tile, .pg-${ID} .pg-tile-go, .pg-${ID} .pg-social a, .pg-${ID} .pg-handle { transition: none; }
  .pg-${ID} .pg-tile:hover, .pg-${ID} .pg-social a:hover, .pg-${ID} .pg-handle:hover { transform: none; }
  .pg-${ID} .pg-tile:hover .pg-tile-go { transform: none; }
  .pg-${ID} .pg-tile:hover { box-shadow: var(--pg-shadow-hover); }
}
`.trim();
}

function renderHeader(def: PageDef, ctx: RenderCtx): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  const avatarSrc = p.avatar ? safeImgSrc(p.avatar, ctx) : '';
  const avatarInner = avatarSrc
    ? `<img src="${escapeAttr(avatarSrc)}" alt="${escapeAttr(p.displayName)}" loading="lazy" />`
    : escapeHtml(avatarInitials(def));

  const id: string[] = [`<h1 class="pg-name">${escapeHtml(p.displayName)}</h1>`];
  if (p.tagline) id.push(`<p class="pg-role">${escapeHtml(p.tagline)}</p>`);
  if (p.bio) id.push(`<p class="pg-bio">${escapeHtml(p.bio)}</p>`);
  if (handle) {
    id.push(
      `<a class="pg-handle" href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)} ` +
        `aria-label="${escapeAttr(`My ar.io address: ${handle.text}`)}">` +
        `<span class="pg-dot" aria-hidden="true"></span>${escapeHtml(handle.text)}</a>`,
    );
  }
  return (
    `<header class="pg-header">` +
    `<div class="pg-avatar" aria-hidden="true">${avatarInner}</div>` +
    `<div class="pg-id">${id.join('')}</div>` +
    `</header>`
  );
}

function renderTile(link: LinkBlock, ctx: RenderCtx): string {
  const t = linkTarget(link.url, ctx);
  const icon = (link.icon || '').trim();
  const accent = icon
    ? `<span class="pg-ico" aria-hidden="true">${escapeHtml(icon)}</span>`
    : `<span class="pg-ico pg-ico--empty" aria-hidden="true"></span>`;
  const artag = t.isAr ? `<span class="pg-artag" aria-hidden="true">ar://</span>` : '';
  const go = t.isAr ? 'Open on permaweb' : 'View project';
  return (
    `<a class="pg-tile" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    `<span class="pg-tile-top">${accent}${artag}</span>` +
    `<span class="pg-tile-label">${escapeHtml(link.label)}</span>` +
    `<span class="pg-tile-go">${escapeHtml(go)} <span aria-hidden="true">&rarr;</span></span>` +
    `</a>`
  );
}

function renderGrid(group: LinkBlock[], ctx: RenderCtx): string {
  return `<div class="pg-grid">${group.map((l) => renderTile(l, ctx)).join('')}</div>`;
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

function renderEmbedTile(arweave: string, ctx: RenderCtx): string {
  const raw = arweave.trim();
  const url = raw.toLowerCase().startsWith('ar://') ? raw : `ar://${raw}`;
  const t = linkTarget(url, ctx);
  return (
    `<div class="pg-grid">` +
    `<a class="pg-tile" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    `<span class="pg-tile-top"><span class="pg-ico" aria-hidden="true">&#10022;</span>` +
    `<span class="pg-artag" aria-hidden="true">ar://</span></span>` +
    `<span class="pg-tile-label">${escapeHtml(raw)}</span>` +
    `<span class="pg-tile-go">Open on permaweb <span aria-hidden="true">&rarr;</span></span>` +
    `</a></div>`
  );
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
  parts.push(`<span class="pg-made">Portfolio Grid</span>`);
  return `<footer class="pg-footer">${parts.join('')}</footer>`;
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

  let i = 0;
  while (i < blocks.length) {
    const block: Block = blocks[i];
    if (block.type === 'link') {
      const group: LinkBlock[] = [];
      while (i < blocks.length && blocks[i].type === 'link') {
        group.push(blocks[i] as LinkBlock);
        i++;
      }
      out.push(renderGrid(group, ctx));
      continue;
    }
    switch (block.type) {
      case 'heading':
        out.push(`<h2 class="pg-section">${escapeHtml(block.text)}</h2>`);
        break;
      case 'text':
        out.push(`<p class="pg-note">${multiline(block.text)}</p>`);
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
        out.push(renderEmbedTile(block.arweave, ctx));
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

export const portfolioGridTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Portfolio Grid',
    family: 'pro',
    description: 'A gallery-style grid of project tiles for photographers, designers and studios.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default portfolioGridTemplate;
