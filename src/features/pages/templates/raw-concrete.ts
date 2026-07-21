/**
 * Raw Concrete — brutalist link-in-bio: hard 3px ink borders, offset drop
 * shadows, one loud orange accent on a concrete-paper grid. Reproduces
 * docs/pages-templates/raw-concrete.html as a block-driven module.
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

const ID = 'raw-concrete';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-raw-concrete',
  template: 'raw-concrete',
  title: 'Mara Voss — Raw Concrete',
  arnsName: 'maravoss',
  profile: {
    avatar: '',
    displayName: 'Mara Voss',
    tagline: 'Art Director / Type',
    handle: 'maravoss.ar.io',
    bio: 'Building loud, honest brand systems from a studio in Rotterdam. Posters, type, and the occasional website that refuses to whisper.',
  },
  blocks: [
    { type: 'divider' },
    { type: 'heading', text: 'Work & Links' },
    { type: 'link', label: 'Portfolio 2026', url: 'https://example.com/portfolio', icon: '' },
    { type: 'link', label: 'Type Foundry Shop', url: 'https://example.com/shop', icon: '' },
    { type: 'link', label: 'Book a Project', url: 'https://example.com/booking', icon: '' },
    { type: 'link', label: 'Concrete Weekly', url: 'ar://concrete-weekly', icon: '' },
    {
      type: 'social',
      items: [
        { platform: 'instagram', url: 'https://instagram.com/example' },
        { platform: 'x', url: 'https://twitter.com/example' },
        { platform: 'dribbble', url: 'https://dribbble.com/example' },
        { platform: 'email', url: 'mailto:hello@example.com' },
      ],
    },
    { type: 'divider' },
    { type: 'verify', label: 'Permanent on Arweave', url: 'ar://b3F1kZ9pXcV7nQ2mR8tL5wY0dJ4hG6sA1uToE_iNrCa' },
    { type: 'text', text: '© 2026 Mara Voss Studio · Set in Helvetica · No apology' },
  ],
  theme: {
    colors: { bg: '#EDEAE4', surface: '#FFFFFF', text: '#111111', accent: '#FF4D00' },
    font: '"Helvetica Neue", Helvetica, Arial, "Arial Narrow", "Liberation Sans", sans-serif',
    buttonShape: 'square',
    background: 'concrete-paper',
  },
  layout: { headerAlign: 'left', linkStyle: 'button', width: 'standard' },
};

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const bg = cssColor(c.bg, '#EDEAE4');
  const surface = cssColor(c.surface, '#FFFFFF');
  const ink = cssColor(c.text, '#111111');
  const accent = cssColor(c.accent, '#FF4D00');
  const font = cssFontFamily(
    def.theme.font,
    '"Helvetica Neue", Helvetica, Arial, "Arial Narrow", "Liberation Sans", sans-serif',
  );

  return `
:root { color-scheme: light dark; }
.pg-${ID} {
  --bg: ${bg}; --surface: ${surface}; --ink: ${ink}; --accent: ${accent};
  --concrete-a: #D6D2C8; --concrete-b: ${bg}; --shadow: var(--ink);
  min-height: 100vh;
  background-color: var(--bg);
  background-image:
    repeating-linear-gradient(0deg, rgba(17,17,17,0.02) 0 1px, transparent 1px 4px),
    repeating-linear-gradient(90deg, rgba(17,17,17,0.02) 0 1px, transparent 1px 4px);
  color: var(--ink);
  font-family: ${font};
  -webkit-font-smoothing: antialiased;
  padding: clamp(1.25rem, 5vw, 3rem) 1.25rem clamp(2.5rem, 8vw, 4rem);
  display: flex; justify-content: center;
}
:root[data-theme="light"] .pg-${ID} {
  --bg: ${bg}; --surface: ${surface}; --ink: ${ink}; --accent: ${accent};
  --concrete-a: #D6D2C8; --concrete-b: ${bg}; --shadow: var(--ink);
  background-image:
    repeating-linear-gradient(0deg, rgba(17,17,17,0.02) 0 1px, transparent 1px 4px),
    repeating-linear-gradient(90deg, rgba(17,17,17,0.02) 0 1px, transparent 1px 4px);
}
.pg-${ID} * { box-sizing: border-box; }
.pg-${ID} .pg-shell { width: 100%; max-width: 600px; }
.pg-${ID} .pg-header { text-align: left; margin-bottom: 2rem; }
.pg-${ID} .pg-avatar {
  width: 96px; height: 96px; aspect-ratio: 1 / 1; border-radius: 0;
  border: 3px solid var(--ink); box-shadow: 6px 6px 0 var(--shadow);
  background: linear-gradient(135deg, var(--concrete-a), var(--concrete-b));
  display: flex; align-items: center; justify-content: center;
  font-weight: 900; font-size: 2.75rem; line-height: 1; color: var(--ink);
  text-transform: uppercase; overflow: hidden; margin-bottom: 1.75rem;
}
.pg-${ID} .pg-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pg-${ID} .pg-name {
  font-weight: 900; text-transform: uppercase; letter-spacing: -0.03em;
  line-height: 0.9; font-size: clamp(2.75rem, 12vw, 5.5rem); margin: 0 0 1rem;
}
.pg-${ID} .pg-tagline {
  font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em;
  font-size: 0.95rem; margin: 0 0 0.75rem; display: inline-block;
  background: var(--accent); color: var(--ink); padding: 4px 8px; border: 3px solid var(--ink);
}
.pg-${ID} .pg-handle {
  display: inline-flex; align-items: center; gap: 6px; margin: 0 0 0.25rem;
  text-decoration: none; color: var(--ink); background: var(--surface);
  border: 3px solid var(--ink); box-shadow: 4px 4px 0 var(--shadow); border-radius: 0;
  padding: 5px 9px; font-weight: 900; font-size: 0.8rem;
  text-transform: uppercase; letter-spacing: 0.06em;
}
.pg-${ID} .pg-handle::before {
  content: ""; width: 10px; height: 10px; background: var(--accent);
  border: 2px solid var(--ink); display: inline-block; flex: 0 0 auto;
}
.pg-${ID} .pg-handle:hover, .pg-${ID} .pg-handle:focus-visible { background: var(--accent); }
.pg-${ID} .pg-handle-wrap { display: block; margin-bottom: 0.9rem; }
.pg-${ID} .pg-bio { font-size: 1rem; line-height: 1.5; margin: 0.75rem 0 0; max-width: 46ch; }
.pg-${ID} .pg-divider { height: 16px; width: 100%; background: var(--ink); margin: 2rem 0; border-radius: 0; }
.pg-${ID} .pg-heading {
  font-weight: 900; text-transform: uppercase; letter-spacing: -0.01em;
  font-size: 1.5rem; line-height: 1; margin: 0 0 1rem;
}
.pg-${ID} .pg-links { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1rem; }
.pg-${ID} .pg-link {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  width: 100%; text-decoration: none; color: var(--ink); background: var(--surface);
  border: 3px solid var(--ink); box-shadow: 6px 6px 0 var(--shadow); border-radius: 0;
  padding: 19px 20px; min-height: 44px; font-weight: 800; font-size: 1.0625rem;
  text-transform: uppercase; letter-spacing: 0.02em;
}
.pg-${ID} .pg-link-label { display: inline-flex; align-items: center; gap: 8px; }
.pg-${ID} .pg-ar-tag {
  font-size: 0.6rem; font-weight: 900; letter-spacing: 0.08em; line-height: 1;
  padding: 3px 5px; border: 2px solid currentColor; border-radius: 0;
}
.pg-${ID} .pg-link .pg-link-arrow { font-weight: 900; font-size: 1.15rem; line-height: 1; }
.pg-${ID} .pg-link:hover, .pg-${ID} .pg-link:focus-visible {
  background: var(--accent); color: var(--ink); border-color: var(--ink);
}
.pg-${ID} .pg-link:focus-visible, .pg-${ID} .pg-social a:focus-visible,
.pg-${ID} .pg-handle:focus-visible, .pg-${ID} .pg-verify:focus-visible {
  outline: 3px solid var(--accent); outline-offset: 3px;
}
.pg-${ID} .pg-figure { margin: 1.25rem 0 0; }
.pg-${ID} .pg-img {
  display: block; max-width: 100%; height: auto; border-radius: 0;
  border: 3px solid var(--ink); box-shadow: 6px 6px 0 var(--shadow);
}
.pg-${ID} .pg-social { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.25rem; padding: 0; list-style: none; }
.pg-${ID} .pg-social a {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 48px; min-height: 48px; padding: 0 12px; background: var(--surface);
  border: 3px solid var(--ink); box-shadow: 4px 4px 0 var(--shadow); color: var(--ink);
  text-decoration: none; font-weight: 900; font-size: 0.8rem;
  text-transform: uppercase; letter-spacing: 0.04em; border-radius: 0;
}
.pg-${ID} .pg-social a:hover, .pg-${ID} .pg-social a:focus-visible { background: var(--accent); color: var(--ink); }
.pg-${ID} .pg-verify {
  display: inline-flex; align-items: center; gap: 8px; margin-top: 0.25rem;
  text-decoration: none; color: var(--ink); background: transparent;
  border: 3px solid var(--ink); border-radius: 0;
  padding: 8px 11px; font-weight: 900; font-size: 0.7rem;
  text-transform: uppercase; letter-spacing: 0.08em;
}
.pg-${ID} .pg-verify::before {
  content: ""; width: 12px; height: 12px; flex: 0 0 auto;
  background:
    linear-gradient(var(--ink), var(--ink)) no-repeat center/3px 12px,
    linear-gradient(var(--ink), var(--ink)) no-repeat center/12px 3px;
  transform: rotate(45deg);
}
.pg-${ID} .pg-verify:hover, .pg-${ID} .pg-verify:focus-visible { background: var(--accent); }
.pg-${ID} .pg-colophon { margin-top: 1.5rem; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink); }
.pg-${ID} .pg-colophon a { color: var(--ink); text-decoration: underline; }

@media (prefers-reduced-motion: no-preference) {
  .pg-${ID} .pg-link, .pg-${ID} .pg-social a,
  .pg-${ID} .pg-handle, .pg-${ID} .pg-verify {
    transition: transform 60ms ease-out, box-shadow 60ms ease-out, background-color 60ms ease-out;
  }
  .pg-${ID} .pg-link:active { transform: translate(6px, 6px); box-shadow: 0 0 0 var(--shadow); }
  .pg-${ID} .pg-social a:active, .pg-${ID} .pg-handle:active { transform: translate(4px, 4px); box-shadow: 0 0 0 var(--shadow); }
}
@media (prefers-reduced-motion: reduce) {
  .pg-${ID} .pg-link:active, .pg-${ID} .pg-social a:active { background: var(--accent); color: var(--ink); }
}

@media (prefers-color-scheme: dark) {
  .pg-${ID} {
    --bg: #111111; --surface: #1C1C1C; --ink: #EDEAE4;
    --concrete-a: #3a3a3a; --concrete-b: #1C1C1C; --shadow: #EDEAE4;
    background-image:
      repeating-linear-gradient(0deg, rgba(237,234,228,0.03) 0 1px, transparent 1px 4px),
      repeating-linear-gradient(90deg, rgba(237,234,228,0.03) 0 1px, transparent 1px 4px);
  }
  .pg-${ID} .pg-tagline,
  .pg-${ID} .pg-handle:hover, .pg-${ID} .pg-handle:focus-visible,
  .pg-${ID} .pg-link:hover, .pg-${ID} .pg-link:focus-visible,
  .pg-${ID} .pg-social a:hover, .pg-${ID} .pg-social a:focus-visible,
  .pg-${ID} .pg-verify:hover, .pg-${ID} .pg-verify:focus-visible,
  .pg-${ID} .pg-link:active, .pg-${ID} .pg-social a:active { color: #111111; }
}
:root[data-theme="dark"] .pg-${ID} {
  --bg: #111111; --surface: #1C1C1C; --ink: #EDEAE4;
  --concrete-a: #3a3a3a; --concrete-b: #1C1C1C; --shadow: #EDEAE4;
  background-image:
    repeating-linear-gradient(0deg, rgba(237,234,228,0.03) 0 1px, transparent 1px 4px),
    repeating-linear-gradient(90deg, rgba(237,234,228,0.03) 0 1px, transparent 1px 4px);
}
:root[data-theme="dark"] .pg-${ID} .pg-tagline,
:root[data-theme="dark"] .pg-${ID} .pg-handle:hover, :root[data-theme="dark"] .pg-${ID} .pg-handle:focus-visible,
:root[data-theme="dark"] .pg-${ID} .pg-link:hover, :root[data-theme="dark"] .pg-${ID} .pg-link:focus-visible,
:root[data-theme="dark"] .pg-${ID} .pg-social a:hover, :root[data-theme="dark"] .pg-${ID} .pg-social a:focus-visible,
:root[data-theme="dark"] .pg-${ID} .pg-verify:hover, :root[data-theme="dark"] .pg-${ID} .pg-verify:focus-visible,
:root[data-theme="dark"] .pg-${ID} .pg-link:active, :root[data-theme="dark"] .pg-${ID} .pg-social a:active { color: #111111; }
`.trim();
}

/** Short 1–2 char badge for a social platform (brutalist monogram). */
const SOCIAL_BADGES: Record<string, string> = {
  instagram: 'IG',
  ig: 'IG',
  x: 'X',
  twitter: 'X',
  dribbble: 'DR',
  behance: 'BE',
  github: 'GH',
  linkedin: 'LI',
  youtube: 'YT',
  facebook: 'FB',
  tiktok: 'TT',
  threads: 'TH',
  bluesky: 'BS',
  mastodon: 'MA',
  'are.na': 'AR',
  arena: 'AR',
  email: '@',
  mail: '@',
};

function socialBadge(platform: string): string {
  const p = platform.trim().toLowerCase();
  if (SOCIAL_BADGES[p]) return SOCIAL_BADGES[p];
  const letters = p.replace(/[^a-z0-9]/g, '');
  if (!letters) return '#';
  return letters.slice(0, 2).toUpperCase();
}

function renderHeader(def: PageDef, ctx: RenderCtx): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  const avatarSrc = safeImgSrc(p.avatar || '', ctx);
  const avatarInner = avatarSrc
    ? `<img src="${escapeAttr(avatarSrc)}" alt="" loading="lazy" />`
    : escapeHtml(avatarInitials(def));
  const parts: string[] = [
    `<div class="pg-avatar" aria-hidden="true">${avatarInner}</div>`,
    `<h1 class="pg-name">${escapeHtml(p.displayName)}</h1>`,
  ];
  if (p.tagline) parts.push(`<p class="pg-tagline">${escapeHtml(p.tagline)}</p>`);
  if (handle) {
    parts.push(
      `<span class="pg-handle-wrap"><a class="pg-handle" href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)}>${escapeHtml(handle.text)}</a></span>`,
    );
  }
  if (p.bio) parts.push(`<p class="pg-bio">${escapeHtml(p.bio)}</p>`);
  return `<header class="pg-header">${parts.join('')}</header>`;
}

function renderLink(link: LinkBlock, ctx: RenderCtx): string {
  const t = linkTarget(link.url, ctx);
  const arTag = t.isAr ? ` <span class="pg-ar-tag" aria-hidden="true">AR://</span>` : '';
  return (
    `<li><a class="pg-link" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    `<span class="pg-link-label">${escapeHtml(link.label)}${arTag}</span> ` +
    `<span class="pg-link-arrow" aria-hidden="true">&#8599;</span>` +
    `</a></li>`
  );
}

function renderSocial(block: SocialBlock, ctx: RenderCtx): string {
  const items = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      return (
        `<li><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)} aria-label="${escapeAttr(item.platform)}">` +
        `${escapeHtml(socialBadge(item.platform))}</a></li>`
      );
    })
    .join('');
  return `<ul class="pg-social">${items}</ul>`;
}

function renderVerify(block: VerifyBlock, ctx: RenderCtx): string {
  const v = verifyTarget(block, ctx);
  if (!v) return `<span class="pg-verify">${escapeHtml(block.label)}</span>`;
  return `<a class="pg-verify" href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)}>${escapeHtml(block.label)}</a>`;
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const out: string[] = [renderHeader(def, ctx)];
  const blocks = def.blocks;
  let i = 0;
  while (i < blocks.length) {
    const block: Block = blocks[i];
    if (block.type === 'link') {
      const rows: string[] = [];
      while (i < blocks.length && blocks[i].type === 'link') {
        rows.push(renderLink(blocks[i] as LinkBlock, ctx));
        i++;
      }
      out.push(`<ul class="pg-links">${rows.join('')}</ul>`);
      continue;
    }
    switch (block.type) {
      case 'heading':
        out.push(`<h2 class="pg-heading">${escapeHtml(block.text)}</h2>`);
        break;
      case 'text':
        out.push(`<p class="pg-colophon">${multiline(block.text)}</p>`);
        break;
      case 'divider':
        out.push(`<div class="pg-divider" aria-hidden="true"></div>`);
        break;
      case 'social':
        out.push(renderSocial(block, ctx));
        break;
      case 'verify':
        out.push(renderVerify(block, ctx));
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
      case 'embed': {
        const t = linkTarget(block.arweave, ctx);
        out.push(
          `<p class="pg-colophon"><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>${escapeHtml(block.arweave)}</a></p>`,
        );
        break;
      }
    }
    i++;
  }
  return `<main class="pg-shell">${out.join('')}</main>`;
}

export const rawConcreteTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Raw Concrete',
    family: 'modern',
    description: 'Brutalist ink borders, offset shadows, one loud orange accent on concrete paper.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default rawConcreteTemplate;
