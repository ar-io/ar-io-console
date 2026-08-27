/**
 * Grid System — Swiss poster math, one disciplined red accent.
 * Reproduces docs/pages-templates/grid-system.html as a block-driven module.
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

const ID = 'grid-system';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-grid-system',
  template: 'grid-system',
  title: 'elena voss — grid systems',
  arnsName: 'elenavoss',
  profile: {
    avatar: 'ev',
    displayName: 'elena voss',
    tagline: 'graphic designer working in type, grid systems & editorial identity — zürich',
    bio: 'Twelve years setting information in order. I build modular grids for publications, wayfinding and screen. Less noise, more signal.',
    handle: 'elenavoss.ar.io',
  },
  blocks: [
    { type: 'heading', text: '01 — work & links' },
    { type: 'link', label: 'selected work & portfolio', url: '#portfolio', icon: 'square' },
    { type: 'link', label: 'studio voss — commissions', url: '#studio', icon: 'square' },
    { type: 'link', label: 'notes on grids — journal', url: '#journal', icon: 'square' },
    { type: 'link', label: 'akkurat grotesk — type release', url: 'ar://akkurat', icon: 'square' },
    { type: 'link', label: 'contact & availability', url: '#contact', icon: 'square' },
    { type: 'heading', text: '02 — elsewhere' },
    {
      type: 'social',
      items: [
        { platform: 'instagram', url: '#instagram' },
        { platform: 'are.na', url: '#are.na' },
        { platform: 'linkedin', url: '#linkedin' },
        { platform: 'mail', url: '#mail' },
      ],
    },
    { type: 'divider' },
    {
      type: 'text',
      text: 'Every layout on this page sits on an 8-point baseline grid. The single red square is the only accent — used once as an identity mark, once per active row, nowhere else.',
    },
    {
      type: 'verify',
      label: 'permanent on arweave',
      url: 'ar://a34Zp9Kd1QmXv7Ns2Rt5Lb8Yz3Fc6Hg0Jw4Ue1Oi9Pq',
    },
  ],
  theme: {
    colors: { bg: '#FFFFFF', surface: '#F2F2F2', text: '#0A0A0A', accent: '#E30613' },
    font: '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", "Nimbus Sans", system-ui, sans-serif',
    buttonShape: 'square',
    background: 'baseline-grid',
  },
  layout: { headerAlign: 'left', linkStyle: 'button', width: 'standard' },
};

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const bg = cssColor(c.bg, '#FFFFFF');
  const surface = cssColor(c.surface, '#F2F2F2');
  const text = cssColor(c.text, '#0A0A0A');
  const accent = cssColor(c.accent, '#E30613');
  const hair = hexToRgba(c.text, 0.08);
  const muted = hexToRgba(c.text, 0.55);
  const font = cssFontFamily(def.theme.font, '"Helvetica Neue", Helvetica, Arial, sans-serif');

  return `
:root { color-scheme: light dark; }
.pg-${ID} {
  --bg: ${bg}; --surface: ${surface}; --text: ${text}; --accent: ${accent};
  --hair: ${hair}; --muted: ${muted};
  --unit: 8px; --edge: clamp(20px, 6vw, 64px);
  font-family: ${font};
  background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility; min-height: 100vh; position: relative; overflow-x: hidden;
}
:root[data-theme="light"] .pg-${ID} {
  --bg: ${bg}; --surface: ${surface}; --text: ${text}; --accent: ${accent};
  --hair: ${hair}; --muted: ${muted};
}
@media (prefers-color-scheme: dark) {
  .pg-${ID} {
    --bg: #1A1A1A; --surface: #0F0F0F; --text: #F5F5F5; --accent: ${accent};
    --hair: rgba(245, 245, 245, 0.10); --muted: rgba(245, 245, 245, 0.55);
  }
}
:root[data-theme="dark"] .pg-${ID} {
  --bg: #1A1A1A; --surface: #0F0F0F; --text: #F5F5F5; --accent: ${accent};
  --hair: rgba(245, 245, 245, 0.10); --muted: rgba(245, 245, 245, 0.55);
}
.pg-${ID} * { box-sizing: border-box; }
.pg-${ID}::before {
  content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background-image: repeating-linear-gradient(to bottom, var(--hair) 0, var(--hair) 1px, transparent 1px, transparent calc(var(--unit) * 3));
  mask-image: linear-gradient(to bottom, transparent 0, #000 8%, #000 92%, transparent 100%);
}
.pg-${ID} .pg-shell { position: relative; z-index: 1; max-width: 760px; margin: 0; padding: clamp(40px, 9vh, 96px) var(--edge) clamp(48px, 12vh, 128px); }
.pg-${ID} .pg-header { display: block; margin-bottom: calc(var(--unit) * 6); }
.pg-${ID} .pg-mark { display: flex; align-items: flex-start; gap: calc(var(--unit) * 2); margin-bottom: calc(var(--unit) * 4); }
.pg-${ID} .pg-avatar { width: 72px; height: 72px; flex: 0 0 72px; border-radius: 0; background: var(--surface); color: var(--text); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 26px; letter-spacing: -0.03em; text-transform: lowercase; box-shadow: inset 0 0 0 1px var(--hair); }
.pg-${ID} .pg-avatar--img { overflow: hidden; padding: 0; }
.pg-${ID} .pg-avatar--img img { width: 100%; height: 100%; display: block; object-fit: cover; border-radius: 0; }
.pg-${ID} .pg-redmark { width: 16px; height: 16px; flex: 0 0 16px; background: var(--accent); margin-top: 6px; }
.pg-${ID} .pg-index-label { font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); font-variant-numeric: tabular-nums; margin-bottom: 4px; }
.pg-${ID} .pg-name { font-size: clamp(34px, 9vw, 56px); font-weight: 700; line-height: 0.94; letter-spacing: -0.035em; text-transform: lowercase; margin: 0 0 calc(var(--unit) * 1.5); }
.pg-${ID} .pg-tagline { font-size: clamp(14px, 2.6vw, 17px); font-weight: 500; line-height: 1.25; letter-spacing: -0.01em; color: var(--text); margin: 0 0 calc(var(--unit) * 2); max-width: 42ch; }
.pg-${ID} .pg-bio { font-size: 14px; font-weight: 400; line-height: 1.55; color: var(--muted); max-width: 52ch; margin: 0; }
.pg-${ID} .pg-handle { display: inline-flex; align-items: center; gap: 8px; margin-top: calc(var(--unit) * 2.5); font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); text-decoration: none; font-variant-numeric: tabular-nums; transition: color 150ms ease; }
.pg-${ID} .pg-handle::before { content: ""; width: 7px; height: 7px; flex: 0 0 7px; box-shadow: inset 0 0 0 1px currentColor; }
.pg-${ID} .pg-handle:hover, .pg-${ID} .pg-handle:focus-visible { color: var(--text); }
.pg-${ID} .pg-handle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.pg-${ID} .pg-divider { height: 0; border: 0; border-top: 1px solid currentColor; opacity: 0.14; margin: calc(var(--unit) * 5) 0; }
@media (min-resolution: 2dppx) { .pg-${ID} .pg-divider { border-top-width: 0.5px; } }
.pg-${ID} .pg-heading { font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); margin: calc(var(--unit) * 5) 0 calc(var(--unit) * 2); }
.pg-${ID} .pg-text { font-size: 14px; line-height: 1.6; color: var(--muted); max-width: 54ch; margin: 0 0 calc(var(--unit) * 3); }
.pg-${ID} .pg-figure { margin: calc(var(--unit) * 3) 0; }
.pg-${ID} .pg-img { display: block; max-width: 100%; height: auto; box-shadow: inset 0 0 0 1px var(--hair); }
.pg-${ID} .pg-rows { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--hair); }
.pg-${ID} .pg-row { position: relative; display: grid; grid-template-columns: 40px 20px 1fr auto; align-items: center; gap: calc(var(--unit) * 1.5); min-height: 56px; padding: 0 4px 0 0; border-bottom: 1px solid var(--hair); color: var(--text); text-decoration: none; padding-left: 0; transition: background-color 180ms ease, padding-left 220ms cubic-bezier(0.22, 1, 0.36, 1); }
.pg-${ID} .pg-row::before { content: ""; position: absolute; left: 0; top: 50%; width: 10px; height: 10px; background: var(--accent); transform: translate(-16px, -50%); opacity: 0; transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease; }
.pg-${ID} .pg-row:hover, .pg-${ID} .pg-row:focus-visible, .pg-${ID} .pg-row:focus-within { background: var(--surface); padding-left: 22px; outline: none; }
.pg-${ID} .pg-row:hover::before, .pg-${ID} .pg-row:focus-visible::before, .pg-${ID} .pg-row:focus-within::before { transform: translate(6px, -50%); opacity: 1; }
.pg-${ID} .pg-row:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.pg-${ID} .pg-row-idx { font-size: 12px; font-weight: 700; letter-spacing: 0.04em; color: var(--muted); font-variant-numeric: tabular-nums; }
.pg-${ID} .pg-row-glyph { color: var(--muted); font-size: 13px; line-height: 1; text-align: center; }
.pg-${ID} .pg-row-label { font-size: clamp(15px, 3.4vw, 19px); font-weight: 500; letter-spacing: -0.015em; text-transform: lowercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pg-${ID} .pg-row:hover .pg-row-label, .pg-${ID} .pg-row:focus-within .pg-row-label { text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }
.pg-${ID} .pg-row-arrow { font-size: 13px; font-weight: 700; color: var(--muted); transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1), color 180ms ease; }
.pg-${ID} .pg-row:hover .pg-row-arrow, .pg-${ID} .pg-row:focus-within .pg-row-arrow { color: var(--accent); transform: translateX(3px); }
.pg-${ID} .pg-row-tag { grid-column: 3 / 4; margin-left: 10px; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); vertical-align: middle; box-shadow: inset 0 0 0 1px var(--hair); padding: 2px 5px; border-radius: 0; font-variant-numeric: tabular-nums; }
.pg-${ID} .pg-row:hover .pg-row-tag, .pg-${ID} .pg-row:focus-within .pg-row-tag { color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.pg-${ID} .pg-social { display: flex; flex-wrap: wrap; gap: 1px; margin: calc(var(--unit) * 3) 0 0; background: var(--hair); border: 1px solid var(--hair); width: fit-content; }
.pg-${ID} .pg-social a { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 16px; background: var(--bg); color: var(--text); text-decoration: none; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; transition: background-color 150ms ease, color 150ms ease; }
.pg-${ID} .pg-social a::before { content: ""; width: 7px; height: 7px; background: currentColor; opacity: 0.35; transition: opacity 150ms ease, background-color 150ms ease; }
.pg-${ID} .pg-social a:hover, .pg-${ID} .pg-social a:focus-visible { background: var(--surface); outline: none; }
.pg-${ID} .pg-social a:hover::before, .pg-${ID} .pg-social a:focus-within::before { opacity: 1; background: var(--accent); }
.pg-${ID} .pg-social a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; position: relative; z-index: 1; }
.pg-${ID} .pg-colophon { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin-top: calc(var(--unit) * 8); font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); font-variant-numeric: tabular-nums; flex-wrap: wrap; }
.pg-${ID} .pg-colophon .pg-c-red { width: 8px; height: 8px; flex: 0 0 8px; background: var(--accent); display: inline-block; }
.pg-${ID} .pg-verify { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); text-decoration: none; letter-spacing: 0.14em; text-transform: uppercase; transition: color 150ms ease; }
.pg-${ID} .pg-verify:hover, .pg-${ID} .pg-verify:focus-visible { color: var(--text); }
.pg-${ID} .pg-verify:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .pg-${ID} * { transition: none !important; animation: none !important; }
  .pg-${ID} .pg-row:hover::before, .pg-${ID} .pg-row:focus-within::before, .pg-${ID} .pg-row:focus-visible::before { transform: translate(6px, -50%); opacity: 1; }
}
`.trim();
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function renderRows(group: LinkBlock[], ctx: RenderCtx): string {
  const rows = group
    .map((link, i) => {
      const t = linkTarget(link.url, ctx);
      const tag = t.isAr ? ' <span class="pg-row-tag" aria-hidden="true">ar://</span>' : '';
      return (
        `<li><a class="pg-row" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
        `<span class="pg-row-idx">${pad2(i + 1)}</span>` +
        `<span class="pg-row-glyph" aria-hidden="true">▪</span>` +
        `<span class="pg-row-label">${escapeHtml(link.label)}${tag}</span>` +
        `<span class="pg-row-arrow" aria-hidden="true">→</span>` +
        `</a></li>`
      );
    })
    .join('');
  return `<ul class="pg-rows">${rows}</ul>`;
}

function renderSocial(block: SocialBlock, ctx: RenderCtx): string {
  const links = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      return `<a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>${escapeHtml(item.platform)}</a>`;
    })
    .join('');
  return `<nav class="pg-social" aria-label="Social links">${links}</nav>`;
}

function renderColophon(def: PageDef, block: VerifyBlock, ctx: RenderCtx): string {
  const v = verifyTarget(block, ctx);
  const link = v
    ? `<a class="pg-verify" href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)}>` +
      `<span class="pg-c-red" aria-hidden="true"></span>${escapeHtml(block.label)}</a>`
    : `<span>${escapeHtml(block.label)}</span>`;
  return (
    `<footer class="pg-colophon">` +
    `<span>${escapeHtml(def.profile.displayName)}</span>` +
    link +
    `<span>record</span>` +
    `</footer>`
  );
}

function renderHeader(def: PageDef, ctx: RenderCtx): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  const avatarSrc = p.avatar ? safeImgSrc(p.avatar, ctx) : '';
  const avatarInner = avatarSrc
    ? `<span class="pg-avatar pg-avatar--img" aria-hidden="true"><img src="${escapeAttr(avatarSrc)}" alt="${escapeAttr(p.displayName)}" loading="lazy" /></span>`
    : `<span class="pg-avatar" aria-hidden="true">${escapeHtml(avatarInitials(def))}</span>`;
  const parts: string[] = [
    `<div class="pg-mark"><span class="pg-redmark" aria-hidden="true"></span>${avatarInner}</div>`,
    `<p class="pg-index-label">00 — profile</p>`,
    `<h1 class="pg-name">${escapeHtml(p.displayName)}</h1>`,
  ];
  if (p.tagline) parts.push(`<p class="pg-tagline">${escapeHtml(p.tagline)}</p>`);
  if (p.bio) parts.push(`<p class="pg-bio">${escapeHtml(p.bio)}</p>`);
  if (handle) {
    parts.push(
      `<a class="pg-handle" href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)}>${escapeHtml(handle.text)}</a>`,
    );
  }
  return `<header class="pg-header">${parts.join('')}</header>`;
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const out: string[] = [renderHeader(def, ctx)];
  const blocks = def.blocks;
  let i = 0;
  while (i < blocks.length) {
    const block: Block = blocks[i];
    if (block.type === 'link') {
      const group: LinkBlock[] = [];
      while (i < blocks.length && blocks[i].type === 'link') {
        group.push(blocks[i] as LinkBlock);
        i++;
      }
      out.push(renderRows(group, ctx));
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
        out.push(`<hr class="pg-divider" />`);
        break;
      case 'social':
        out.push(renderSocial(block, ctx));
        break;
      case 'verify':
        out.push(renderColophon(def, block, ctx));
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
          `<p class="pg-text"><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>${escapeHtml(block.arweave)}</a></p>`,
        );
        break;
      }
    }
    i++;
  }
  return `<main class="pg-shell">${out.join('')}</main>`;
}

export const gridSystemTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Grid System',
    family: 'modern',
    description: 'Swiss poster math, one disciplined red accent.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default gridSystemTemplate;
