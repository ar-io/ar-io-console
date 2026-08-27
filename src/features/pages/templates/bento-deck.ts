/**
 * Bento Deck — a modern, tactile grid of rounded tiles: an oversized profile
 * hero, a gradient "featured" tile, tidy link tiles, a circular social chip
 * cluster and a quiet permalink footer. Reproduces
 * docs/pages-templates/bento-deck.html as a block-driven module.
 */

import type {
  Block,
  LinkBlock,
  PageDef,
  SocialBlock,
  TextBlock,
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

const ID = 'bento-deck';

const DEFAULT_FONT =
  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, system-ui, sans-serif';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-bento-deck',
  template: 'bento-deck',
  title: 'Maya Okonkwo — Product Designer',
  arnsName: 'mayaok',
  profile: {
    avatar: '',
    displayName: 'Maya Okonkwo',
    tagline: 'Designing calm, useful interfaces for teams that move fast.',
    bio: 'Currently shaping the design system at Northwind. Previously at Figma & Linear. Berlin-based, always sketching.',
    handle: 'mayaok.ar.io',
  },
  blocks: [
    { type: 'link', label: 'View my case studies', url: 'https://example.com/work', icon: 'featured' },
    { type: 'link', label: 'The Weekly Sketch', url: 'ar://weeklysketch', icon: 'writing' },
    { type: 'link', label: 'Resume & CV', url: 'https://example.com/resume', icon: 'about' },
    { type: 'link', label: 'Book a 30-min design consult', url: 'https://example.com/booking', icon: 'available' },
    {
      type: 'social',
      items: [
        { platform: 'twitter', url: 'https://twitter.com/' },
        { platform: 'github', url: 'https://github.com/' },
        { platform: 'dribbble', url: 'https://dribbble.com/' },
        { platform: 'linkedin', url: 'https://www.linkedin.com/' },
      ],
    },
    { type: 'divider' },
    { type: 'text', text: '© 2026 Maya Okonkwo' },
    { type: 'verify', label: 'Permanent on Arweave', url: 'ar://3nQ8Kj2LpWm5vR9tX1yZ7bD4gH6sF0cU2eI7oN3aP9q' },
  ],
  theme: {
    colors: { bg: '#F7F7F5', surface: '#FFFFFF', text: '#18181B', accent: '#4F46E5' },
    font: DEFAULT_FONT,
    buttonShape: 'rounded',
    background: 'warm-off-white',
  },
  layout: { headerAlign: 'left', linkStyle: 'grid', width: 'wide' },
};

/** Deterministically darken a #rgb/#rrggbb color; returns null for non-hex input. */
function darkenHex(hex: string, factor: number): string | null {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const scale = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  const r = scale(parseInt(h.slice(0, 2), 16));
  const g = scale(parseInt(h.slice(2, 4), 16));
  const b = scale(parseInt(h.slice(4, 6), 16));
  const to2 = (v: number) => v.toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const bg = cssColor(c.bg, '#F7F7F5');
  const surface = cssColor(c.surface, '#FFFFFF');
  const text = cssColor(c.text, '#18181B');
  const accent = cssColor(c.accent, '#4F46E5');
  const accent2 = darkenHex(accent, 0.82) || accent;
  const avatarA = darkenHex(accent, 1.12) || accent;
  const muted = hexToRgba(c.text, 0.55);
  const microlabel = hexToRgba(c.text, 0.42);
  const border = hexToRgba(c.text, 0.06);
  const chipBorder = hexToRgba(c.text, 0.12);
  const font = cssFontFamily(def.theme.font, DEFAULT_FONT);

  return `
:root { color-scheme: light dark; }
.pg-${ID} {
  --pg-bg: ${bg}; --pg-surface: ${surface}; --pg-text: ${text}; --pg-muted: ${muted};
  --pg-microlabel: ${microlabel}; --pg-border: ${border}; --pg-accent: ${accent};
  --pg-accent-2: ${accent2}; --pg-avatar-a: ${avatarA}; --pg-avatar-b: ${accent};
  --pg-focus: ${accent}; --pg-chip-border: ${chipBorder};
  --pg-shadow: 0 1px 2px rgba(24,24,27,0.04), 0 8px 24px -12px rgba(24,24,27,0.10);
  --pg-shadow-hover: 0 12px 32px -10px rgba(24,24,27,0.18);
  max-width: 920px; margin: 0 auto; padding: clamp(20px,5vw,56px) clamp(16px,4vw,32px);
  background: var(--pg-bg); color: var(--pg-text); font-family: ${font};
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; min-height: 100vh;
}
:root[data-theme="light"] .pg-${ID} {
  --pg-bg: ${bg}; --pg-surface: ${surface}; --pg-text: ${text}; --pg-muted: ${muted};
  --pg-microlabel: ${microlabel}; --pg-border: ${border}; --pg-accent: ${accent};
  --pg-accent-2: ${accent2}; --pg-avatar-a: ${avatarA}; --pg-avatar-b: ${accent};
  --pg-focus: ${accent}; --pg-chip-border: ${chipBorder};
  --pg-shadow: 0 1px 2px rgba(24,24,27,0.04), 0 8px 24px -12px rgba(24,24,27,0.10);
  --pg-shadow-hover: 0 12px 32px -10px rgba(24,24,27,0.18);
}
@media (prefers-color-scheme: dark) {
  .pg-${ID} {
    --pg-bg: #111113; --pg-surface: #1C1C1F; --pg-text: #F4F4F5; --pg-muted: #A1A1AA;
    --pg-microlabel: #71717A; --pg-border: rgba(255,255,255,0.07); --pg-accent: ${accent};
    --pg-accent-2: ${accent2}; --pg-avatar-a: ${avatarA}; --pg-avatar-b: ${accent};
    --pg-focus: ${accent}; --pg-chip-border: rgba(255,255,255,0.14);
    --pg-shadow: 0 8px 24px -12px rgba(0,0,0,0.6);
    --pg-shadow-hover: 0 14px 34px -10px rgba(0,0,0,0.72);
  }
}
:root[data-theme="dark"] .pg-${ID} {
  --pg-bg: #111113; --pg-surface: #1C1C1F; --pg-text: #F4F4F5; --pg-muted: #A1A1AA;
  --pg-microlabel: #71717A; --pg-border: rgba(255,255,255,0.07); --pg-accent: ${accent};
  --pg-accent-2: ${accent2}; --pg-avatar-a: ${avatarA}; --pg-avatar-b: ${accent};
  --pg-focus: ${accent}; --pg-chip-border: rgba(255,255,255,0.14);
  --pg-shadow: 0 8px 24px -12px rgba(0,0,0,0.6);
  --pg-shadow-hover: 0 14px 34px -10px rgba(0,0,0,0.72);
}
.pg-${ID} * { box-sizing: border-box; }
.pg-${ID} .deck-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
@media (min-width: 641px) { .pg-${ID} .deck-grid { grid-template-columns: repeat(2,1fr); } }
@media (min-width: 901px) { .pg-${ID} .deck-grid { grid-template-columns: repeat(4,1fr); } }
.pg-${ID} .tile {
  position: relative; display: flex; flex-direction: column; border-radius: 24px;
  background: var(--pg-surface); border: 1px solid var(--pg-border);
  box-shadow: var(--pg-shadow); padding: 24px; min-height: 112px; text-decoration: none; color: inherit;
}
.pg-${ID} a.tile { transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease; }
.pg-${ID} a.tile:hover { transform: translateY(-2px); box-shadow: var(--pg-shadow-hover); }
.pg-${ID} a.tile:focus-visible { outline: 2px solid var(--pg-focus); outline-offset: 3px; }
.pg-${ID} .micro {
  font-size: 0.6875rem; letter-spacing: 0.08em; text-transform: uppercase;
  font-weight: 600; color: var(--pg-microlabel); margin: 0 0 6px;
}
.pg-${ID} .tile--hero { grid-column: 1 / -1; justify-content: flex-end; gap: 18px; }
@media (min-width: 901px) { .pg-${ID} .tile--hero { grid-column: span 2; grid-row: span 2; } }
.pg-${ID} .avatar {
  width: 64px; height: 64px; border-radius: 50%;
  background: radial-gradient(circle at 32% 30%, var(--pg-avatar-a), var(--pg-avatar-b));
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700; font-size: 1.375rem; letter-spacing: 0.02em; text-transform: uppercase;
  box-shadow: 0 6px 18px -6px rgba(79,70,229,0.55); flex: none; overflow: hidden;
}
.pg-${ID} .avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; }
.pg-${ID} .hero-name { font-size: 1.75rem; font-weight: 700; line-height: 1.12; margin: 0; letter-spacing: -0.02em; }
.pg-${ID} .hero-tagline { font-size: 0.95rem; color: var(--pg-muted); margin: 8px 0 0; line-height: 1.45; }
.pg-${ID} .hero-bio { font-size: 0.875rem; color: var(--pg-muted); margin: 14px 0 0; line-height: 1.55; max-width: 34ch; }
.pg-${ID} .hero-handle {
  display: inline-flex; align-items: center; gap: 7px; margin-top: 16px;
  padding: 5px 12px; border-radius: 999px; border: 1px solid var(--pg-chip-border);
  font-size: 0.75rem; font-weight: 600; letter-spacing: 0.01em;
  color: var(--pg-muted); text-decoration: none; align-self: flex-start;
  transition: border-color 180ms ease, color 180ms ease;
}
.pg-${ID} .hero-handle:hover { border-color: var(--pg-accent); color: var(--pg-text); }
.pg-${ID} .hero-handle:focus-visible { outline: 2px solid var(--pg-focus); outline-offset: 3px; }
.pg-${ID} .hero-handle .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--pg-accent); flex: none; }
.pg-${ID} .ar-tag {
  display: inline-block; margin-left: 7px; font-size: 0.625rem; font-weight: 600;
  letter-spacing: 0.04em; color: var(--pg-accent); vertical-align: middle;
}
.pg-${ID} .tile--accent {
  grid-column: 1 / -1;
  background: linear-gradient(135deg, var(--pg-accent), var(--pg-accent-2));
  border-color: transparent; color: #fff; justify-content: space-between; min-height: 132px;
}
@media (min-width: 901px) { .pg-${ID} .tile--accent { grid-column: span 2; } }
.pg-${ID} .tile--accent .micro { color: rgba(255,255,255,0.72); }
.pg-${ID} .tile--accent .tile-label { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.01em; line-height: 1.2; }
.pg-${ID} .tile--accent .ar-tag { color: rgba(255,255,255,0.85); }
.pg-${ID} .tile-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-top: 16px; }
.pg-${ID} .arrow { font-size: 1.375rem; line-height: 1; flex: none; transition: transform 200ms ease; }
.pg-${ID} a.tile--accent:hover .arrow { transform: translateX(4px); }
.pg-${ID} .tile--link { grid-column: 1 / -1; justify-content: space-between; }
@media (min-width: 641px) { .pg-${ID} .tile--link { grid-column: span 1; } }
@media (min-width: 901px) { .pg-${ID} .tile--link.span-2 { grid-column: span 2; } }
.pg-${ID} .tile--link .tile-label { font-size: 1.0625rem; font-weight: 650; line-height: 1.25; letter-spacing: -0.01em; }
.pg-${ID} .tile--link .arrow { color: var(--pg-muted); font-size: 1.125rem; }
.pg-${ID} a.tile--link:hover .arrow { transform: translateX(4px); }
.pg-${ID} .tile--note { grid-column: 1 / -1; }
.pg-${ID} .tile--note .note-text { margin: 8px 0 0; font-size: 0.9375rem; color: var(--pg-muted); line-height: 1.55; }
.pg-${ID} .tile--figure { grid-column: 1 / -1; padding: 0; overflow: hidden; }
@media (min-width: 901px) { .pg-${ID} .tile--figure { grid-column: span 2; } }
.pg-${ID} .tile--figure img { display: block; width: 100%; height: 100%; object-fit: cover; }
.pg-${ID} .tile--social { grid-column: 1 / -1; min-height: auto; justify-content: center; }
@media (min-width: 901px) { .pg-${ID} .tile--social { grid-column: span 2; } }
.pg-${ID} .chips { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
.pg-${ID} .chip {
  width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--pg-chip-border);
  display: flex; align-items: center; justify-content: center;
  color: var(--pg-text); text-decoration: none; font-size: 0.8125rem; font-weight: 700;
  transition: transform 180ms ease, border-color 180ms ease, background-color 180ms ease;
}
.pg-${ID} .chip:hover { transform: translateY(-2px); border-color: var(--pg-accent); }
.pg-${ID} .chip:focus-visible { outline: 2px solid var(--pg-focus); outline-offset: 3px; }
.pg-${ID} .deck-rule { grid-column: 1 / -1; height: 1px; margin: 4px 0; background: var(--pg-border); border: 0; }
.pg-${ID} .tile--footer {
  grid-column: 1 / -1; min-height: auto; background: transparent; border: none; box-shadow: none; padding: 20px 24px;
}
.pg-${ID} .tile--footer p { margin: 0; font-size: 0.8125rem; color: var(--pg-muted); line-height: 1.5; }
.pg-${ID} .verify {
  display: inline-flex; align-items: center; gap: 6px; color: var(--pg-muted);
  text-decoration: none; border-bottom: 1px solid transparent;
  transition: color 180ms ease, border-color 180ms ease;
}
.pg-${ID} .verify:hover { color: var(--pg-text); border-bottom-color: var(--pg-chip-border); }
.pg-${ID} .verify:focus-visible { outline: 2px solid var(--pg-focus); outline-offset: 3px; }
.pg-${ID} .verify svg { width: 12px; height: 12px; flex: none; color: var(--pg-accent); }
@media (prefers-reduced-motion: reduce) {
  .pg-${ID} a.tile, .pg-${ID} .chip, .pg-${ID} .arrow { transition: none; }
  .pg-${ID} a.tile:hover, .pg-${ID} .chip:hover { transform: none; }
  .pg-${ID} a.tile:hover { box-shadow: var(--pg-shadow-hover); }
  .pg-${ID} a.tile--accent:hover .arrow, .pg-${ID} a.tile--link:hover .arrow { transform: none; }
}
`.trim();
}

const VERIFY_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="5" y="11" width="14" height="10" rx="2"></rect>' +
  '<path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>';

/** Curated two-glyph chip labels for well-known platforms; else derived initials. */
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
  twitch: 'Tw',
  mastodon: 'Ma',
  bluesky: 'Bs',
  threads: 'Th',
  tiktok: 'Tk',
  discord: 'Dc',
  telegram: 'Tg',
  medium: 'Md',
  substack: 'Sb',
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

/** Turn a link `icon` keyword into a micro-label; fall back to a generic label. */
function microLabel(icon: string | undefined, fallback: string): string {
  const s = (icon || '').trim();
  if (!s) return fallback;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface LinkFlags {
  accent: boolean;
  span2: boolean;
}

function renderHero(def: PageDef, ctx: RenderCtx): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  const inner: string[] = [
    `<p class="micro">Profile</p>`,
    `<h1 class="hero-name">${escapeHtml(p.displayName)}</h1>`,
  ];
  if (p.tagline) inner.push(`<p class="hero-tagline">${escapeHtml(p.tagline)}</p>`);
  if (p.bio) inner.push(`<p class="hero-bio">${escapeHtml(p.bio)}</p>`);
  if (handle) {
    inner.push(
      `<a class="hero-handle" href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)} ` +
        `aria-label="${escapeAttr(`My ar.io address: ${handle.text}`)}">` +
        `<span class="dot" aria-hidden="true"></span>${escapeHtml(handle.text)}</a>`,
    );
  }
  const avatarSrc = p.avatar ? safeImgSrc(p.avatar, ctx) : '';
  const avatarInner = avatarSrc
    ? `<img src="${escapeAttr(avatarSrc)}" alt="${escapeAttr(p.displayName)}" loading="lazy" />`
    : escapeHtml(avatarInitials(def));
  return (
    `<section class="tile tile--hero" aria-label="Profile">` +
    `<div class="avatar" aria-hidden="true">${avatarInner}</div>` +
    `<div>${inner.join('')}</div>` +
    `</section>`
  );
}

function renderLinkTile(link: LinkBlock, flags: LinkFlags, ctx: RenderCtx): string {
  const t = linkTarget(link.url, ctx);
  const arTag = t.isAr ? ` <span class="ar-tag" aria-hidden="true">ar://</span>` : '';
  const label = `${escapeHtml(link.label)}${arTag}`;
  if (flags.accent) {
    return (
      `<a class="tile tile--accent" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
      `<p class="micro">${escapeHtml(microLabel(link.icon, 'Featured'))}</p>` +
      `<div class="tile-row"><span class="tile-label">${label}</span>` +
      `<span class="arrow" aria-hidden="true">&rarr;</span></div>` +
      `</a>`
    );
  }
  const span = flags.span2 ? ' span-2' : '';
  return (
    `<a class="tile tile--link${span}" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    `<p class="micro">${escapeHtml(microLabel(link.icon, 'Link'))}</p>` +
    `<div class="tile-row"><span class="tile-label">${label}</span>` +
    `<span class="arrow" aria-hidden="true">&rarr;</span></div>` +
    `</a>`
  );
}

function renderSocialTile(block: SocialBlock, ctx: RenderCtx): string {
  const chips = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      return (
        `<a class="chip" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)} ` +
        `aria-label="${escapeAttr(item.platform)}">` +
        `<span aria-hidden="true">${escapeHtml(platformGlyph(item.platform))}</span></a>`
      );
    })
    .join('');
  return (
    `<section class="tile tile--social" aria-label="Social links">` +
    `<p class="micro">Elsewhere</p><div class="chips">${chips}</div></section>`
  );
}

function renderFooter(
  def: PageDef,
  footerText: TextBlock | undefined,
  verify: VerifyBlock | undefined,
  ctx: RenderCtx,
): string {
  const v = verifyTarget(verify, ctx);
  const lead = footerText
    ? multiline(footerText.text)
    : `&copy; ${escapeHtml(def.profile.displayName)}`;
  let link = '';
  if (v) {
    const label = verify && verify.label ? verify.label : 'Permanent on Arweave';
    link =
      `<a class="verify" href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)} ` +
      `aria-label="${escapeAttr('Verify this page: permanent on Arweave')}">` +
      `${VERIFY_SVG} ${escapeHtml(label)}</a>`;
  } else if (verify && verify.label) {
    link = escapeHtml(verify.label);
  }
  const sep = lead && link ? ' &middot; ' : '';
  return `<div class="tile tile--footer"><p>${lead}${sep}${link}</p></div>`;
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const blocks = def.blocks;

  // Pull the permalink footer out of the main flow: the first verify block and,
  // when present, the trailing text block that reads as the page's colophon.
  let verifyBlock: VerifyBlock | undefined;
  for (const b of blocks) {
    if (b.type === 'verify') {
      verifyBlock = b;
      break;
    }
  }
  let footerText: TextBlock | undefined;
  if (verifyBlock) {
    for (let j = blocks.length - 1; j >= 0; j--) {
      const b = blocks[j];
      if (b.type === 'text') {
        footerText = b;
        break;
      }
    }
  }
  const consumed = new Set<Block>();
  if (verifyBlock) consumed.add(verifyBlock);
  if (footerText) consumed.add(footerText);

  // Flags per link block: first link is the featured (accent) tile; the last of
  // the remaining links spans two columns when their count is odd, to fill the
  // trailing grid row cleanly.
  const linkBlocks = blocks.filter((b): b is LinkBlock => b.type === 'link');
  const flags = new Map<LinkBlock, LinkFlags>();
  linkBlocks.forEach((lb, idx) => {
    flags.set(lb, { accent: idx === 0, span2: false });
  });
  const rest = linkBlocks.slice(1);
  if (rest.length > 0 && rest.length % 2 === 1) {
    flags.set(rest[rest.length - 1], { accent: false, span2: true });
  }

  const tiles: string[] = [renderHero(def, ctx)];
  for (const block of blocks) {
    if (consumed.has(block)) continue;
    switch (block.type) {
      case 'link':
        tiles.push(renderLinkTile(block, flags.get(block) || { accent: false, span2: false }, ctx));
        break;
      case 'social':
        tiles.push(renderSocialTile(block, ctx));
        break;
      case 'divider':
        tiles.push(`<hr class="deck-rule" />`);
        break;
      case 'heading':
        tiles.push(
          `<section class="tile tile--note"><p class="micro">Section</p>` +
            `<p class="hero-name" style="font-size:1.25rem">${escapeHtml(block.text)}</p></section>`,
        );
        break;
      case 'text':
        tiles.push(
          `<section class="tile tile--note"><p class="note-text">${multiline(block.text)}</p></section>`,
        );
        break;
      case 'image': {
        const src = safeImgSrc(block.src, ctx);
        if (src) {
          tiles.push(
            `<figure class="tile tile--figure">` +
              `<img src="${escapeAttr(src)}" alt="${escapeAttr(block.alt || '')}" loading="lazy" /></figure>`,
          );
        }
        break;
      }
      case 'embed': {
        const t = linkTarget(block.arweave, ctx);
        tiles.push(
          `<a class="tile tile--link" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
            `<p class="micro">Embed</p><div class="tile-row">` +
            `<span class="tile-label">${escapeHtml(block.arweave)} <span class="ar-tag" aria-hidden="true">ar://</span></span>` +
            `<span class="arrow" aria-hidden="true">&rarr;</span></div></a>`,
        );
        break;
      }
      case 'verify':
        // Rendered in the footer (pre-scanned). A second verify block is ignored.
        break;
    }
  }

  if (verifyBlock || footerText) {
    tiles.push(renderFooter(def, footerText, verifyBlock, ctx));
  }

  return `<main class="deck-grid">${tiles.join('')}</main>`;
}

export const bentoDeckTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Bento Deck',
    family: 'modern',
    description: 'A tactile grid of rounded tiles — profile hero, gradient feature, tidy links.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default bentoDeckTemplate;
