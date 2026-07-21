/**
 * Resume — a one-page CV rendered as a clean printable sheet: a serif name
 * header, a short summary, then sections driven by `heading` blocks (Experience,
 * Links, Contact…) with their following text and link blocks grouped beneath
 * each label. Single column, restrained accent, fully self-contained.
 */

import type {
  Block,
  HeadingBlock,
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

const ID = 'resume' as unknown as import('../schema').TemplateId;

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-resume',
  template: ID,
  title: 'Ava Reyes — Senior Frontend Engineer',
  arnsName: 'ava',
  profile: {
    avatar: 'AR',
    displayName: 'Ava Reyes',
    tagline: 'Senior Frontend Engineer',
    handle: 'ava.ar.io',
    bio: 'Frontend engineer with a decade of experience building design systems and high-traffic web apps. I care about accessibility, performance, and shipping calm, maintainable interfaces.',
  },
  blocks: [
    { type: 'heading', text: 'Experience' },
    {
      type: 'text',
      text: 'Senior Frontend Engineer — Northwind (2021–present)\nLed the design-system rebuild and shipped the checkout redesign that lifted conversion 18%.',
    },
    {
      type: 'text',
      text: 'Frontend Engineer — Loomstate (2018–2021)\nBuilt the component library and owned the migration to a typed, fully tested React codebase.',
    },
    { type: 'divider' },
    { type: 'heading', text: 'Selected Work' },
    { type: 'link', label: 'Northwind Design System — case study', url: 'https://example.com/design-system', icon: 'Case study' },
    { type: 'link', label: 'Checkout redesign — write-up', url: 'https://example.com/checkout', icon: 'Article' },
    { type: 'link', label: 'Résumé archived on the permaweb', url: 'ar://avareyes', icon: 'Permaweb' },
    { type: 'heading', text: 'Contact' },
    {
      type: 'social',
      items: [
        { platform: 'Email', url: 'mailto:ava@example.com' },
        { platform: 'GitHub', url: 'https://github.com/' },
        { platform: 'LinkedIn', url: 'https://linkedin.com/' },
      ],
    },
    { type: 'verify', label: 'Permanent on Arweave', url: '#' },
  ],
  theme: {
    colors: { bg: '#F4F3EF', surface: '#FFFFFF', text: '#1B1D24', accent: '#3B4A8C' },
    font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    buttonShape: 'square',
    background: 'off-white paper sheet with a thin border and restrained navy accent',
  },
  layout: { headerAlign: 'left', linkStyle: 'card', width: 'standard' },
};

const SERIF =
  "Georgia, 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Palatino, 'Times New Roman', serif";

const SVG_LOCK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
  'stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10" rx="2.5"/>' +
  '<path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>';

interface Section {
  heading?: HeadingBlock;
  items: Block[];
}

/** Split blocks into heading-led sections; blocks before the first heading form an intro. */
function toSections(blocks: Block[]): Section[] {
  const sections: Section[] = [];
  let current: Section = { items: [] };
  for (const block of blocks) {
    if (block.type === 'heading') {
      if (current.heading || current.items.length) sections.push(current);
      current = { heading: block, items: [] };
    } else {
      current.items.push(block);
    }
  }
  if (current.heading || current.items.length) sections.push(current);
  return sections;
}

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const bg = cssColor(c.bg, '#F4F3EF');
  const surface = cssColor(c.surface, '#FFFFFF');
  const text = cssColor(c.text, '#1B1D24');
  const accent = cssColor(c.accent, '#3B4A8C');
  const font = cssFontFamily(
    def.theme.font,
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  );

  const lightVars =
    `--bg:${bg}; --surface:${surface}; --text:${text}; --accent:${accent}; ` +
    `--muted:rgba(27,29,36,0.62); --hair:rgba(27,29,36,0.13); ` +
    `--rule:rgba(27,29,36,0.85); --chip:rgba(27,29,36,0.05); --shadow:rgba(20,22,34,0.12);`;
  const darkVars =
    `--bg:#0D0E13; --surface:#15161D; --text:#E9EAF1; --accent:#96A2E8; ` +
    `--muted:rgba(233,234,241,0.62); --hair:rgba(255,255,255,0.11); ` +
    `--rule:rgba(233,234,241,0.85); --chip:rgba(255,255,255,0.06); --shadow:rgba(0,0,0,0.5);`;

  return `
.pg-${ID} { ${lightVars} }
.pg-${ID} * { box-sizing: border-box; }
.pg-${ID} {
  font-family: ${font}; color: var(--text); background: var(--bg);
  min-height: 100vh; line-height: 1.55; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
@media (prefers-color-scheme: dark) { .pg-${ID} { ${darkVars} } }
.pg-${ID} .pg-sheet-wrap { width: 100%; max-width: 46rem; margin: 0 auto; padding: clamp(1.25rem, 5vw, 3rem) clamp(1rem, 4vw, 1.5rem); }
.pg-${ID} .pg-sheet {
  background: var(--surface); border: 1px solid var(--hair); border-radius: 14px;
  padding: clamp(1.5rem, 5vw, 3rem) clamp(1.35rem, 5vw, 3rem) clamp(1.75rem, 5vw, 2.75rem);
  box-shadow: 0 1px 2px var(--shadow), 0 20px 44px -26px var(--shadow);
}
.pg-${ID} .pg-head { display: flex; align-items: center; gap: 1.1rem; padding-bottom: 1.1rem; border-bottom: 2px solid var(--rule); }
.pg-${ID} .pg-avatar {
  flex: 0 0 auto; width: 60px; height: 60px; border-radius: 12px; display: grid; place-items: center;
  font-family: ${SERIF}; font-size: 1.35rem; font-weight: 700; text-transform: uppercase; letter-spacing: .02em;
  color: var(--accent); background: var(--chip); border: 1px solid var(--hair); overflow: hidden;
}
.pg-${ID} .pg-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 12px; }
.pg-${ID} .pg-headtext { min-width: 0; flex: 1 1 auto; }
.pg-${ID} .pg-name {
  margin: 0; font-family: ${SERIF}; font-size: clamp(1.65rem, 5.5vw, 2.4rem); font-weight: 700;
  letter-spacing: -.01em; line-height: 1.1;
}
.pg-${ID} .pg-title { margin: .3rem 0 0; font-size: 1rem; font-weight: 600; color: var(--accent); letter-spacing: .01em; }
.pg-${ID} .pg-meta { margin-top: .6rem; }
.pg-${ID} .pg-handle {
  display: inline-flex; align-items: center; gap: .4rem; padding: .2rem .55rem; border-radius: 6px;
  font-size: .76rem; font-weight: 600; color: var(--text); text-decoration: none;
  background: var(--chip); border: 1px solid var(--hair); transition: border-color .2s ease, color .2s ease;
}
.pg-${ID} .pg-handle .pg-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex: 0 0 auto; }
.pg-${ID} .pg-handle:hover, .pg-${ID} .pg-handle:focus-visible { color: var(--accent); border-color: var(--accent); }
.pg-${ID} .pg-summary { margin: 1.25rem 0 0; font-size: 1rem; line-height: 1.65; color: var(--muted); }
.pg-${ID} .pg-section { margin-top: 1.75rem; }
.pg-${ID} .pg-sec {
  margin: 0 0 .85rem; font-family: ${SERIF}; font-size: .82rem; font-weight: 700; letter-spacing: .14em;
  text-transform: uppercase; color: var(--text); padding-bottom: .35rem; border-bottom: 1px solid var(--hair);
  display: flex; align-items: center; gap: .6rem;
}
.pg-${ID} .pg-sec::before { content: ""; width: .5rem; height: .5rem; background: var(--accent); border-radius: 2px; flex: 0 0 auto; }
.pg-${ID} .pg-note { margin: 0 0 .9rem; font-size: .96rem; line-height: 1.6; color: var(--text); }
.pg-${ID} .pg-note:last-child { margin-bottom: 0; }
.pg-${ID} .pg-entries { list-style: none; margin: 0; padding: 0; }
.pg-${ID} .pg-entries li { border-bottom: 1px solid var(--hair); }
.pg-${ID} .pg-entries li:last-child { border-bottom: 0; }
.pg-${ID} .pg-entry {
  display: flex; align-items: baseline; gap: .75rem; min-height: 44px; padding: .55rem .1rem;
  text-decoration: none; color: var(--text); transition: color .18s ease;
}
.pg-${ID} .pg-entry .pg-el { flex: 1 1 auto; min-width: 0; font-size: .98rem; overflow-wrap: anywhere; }
.pg-${ID} .pg-entry .pg-ek { display: block; font-size: .7rem; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin-top: .1rem; }
.pg-${ID} .pg-entry .pg-ek .pg-ar { color: var(--accent); text-transform: none; letter-spacing: .02em; }
.pg-${ID} .pg-entry .pg-arrow { flex: 0 0 auto; color: var(--accent); font-size: .95rem; transition: transform .18s ease; }
.pg-${ID} .pg-entry:hover .pg-el, .pg-${ID} .pg-entry:focus-visible .pg-el { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }
.pg-${ID} .pg-entry:hover .pg-arrow, .pg-${ID} .pg-entry:focus-visible .pg-arrow { transform: translateX(3px); }
.pg-${ID} .pg-inline-socials { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: .4rem .9rem; }
.pg-${ID} .pg-inline-socials a {
  display: inline-flex; align-items: center; min-height: 44px; color: var(--text); text-decoration: none;
  font-size: .9rem; font-weight: 600; border-bottom: 1px solid transparent; transition: color .18s ease, border-color .18s ease;
}
.pg-${ID} .pg-inline-socials a:hover, .pg-${ID} .pg-inline-socials a:focus-visible { color: var(--accent); border-bottom-color: var(--accent); }
.pg-${ID} .pg-divider { height: 1px; border: 0; margin: 1.35rem 0; background: var(--hair); }
.pg-${ID} .pg-figure { margin: 1rem 0; }
.pg-${ID} .pg-img { display: block; max-width: 100%; height: auto; border-radius: 10px; border: 1px solid var(--hair); }
.pg-${ID} .pg-colophon { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--hair); text-align: center; }
.pg-${ID} .pg-verify {
  display: inline-flex; align-items: center; gap: .45rem; color: var(--muted); text-decoration: none;
  font-size: .78rem; font-weight: 600; transition: color .18s ease;
}
.pg-${ID} .pg-verify svg { width: 13px; height: 13px; display: block; }
.pg-${ID} .pg-verify:hover, .pg-${ID} .pg-verify:focus-visible { color: var(--accent); }
.pg-${ID} a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .pg-${ID} .pg-entry, .pg-${ID} .pg-entry .pg-arrow, .pg-${ID} .pg-handle, .pg-${ID} .pg-inline-socials a { transition: none; }
  .pg-${ID} .pg-entry:hover .pg-arrow { transform: none; }
}
`.trim();
}

function renderHead(def: PageDef, ctx: RenderCtx): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  const avatarSrc = p.avatar ? safeImgSrc(p.avatar, ctx) : '';
  const inner = avatarSrc
    ? `<img src="${escapeAttr(avatarSrc)}" alt="${escapeAttr(p.displayName)}" loading="lazy" />`
    : escapeHtml(avatarInitials(def));

  const textParts: string[] = [`<h1 class="pg-name">${escapeHtml(p.displayName)}</h1>`];
  if (p.tagline) textParts.push(`<p class="pg-title">${escapeHtml(p.tagline)}</p>`);
  if (handle) {
    textParts.push(
      `<p class="pg-meta"><a class="pg-handle" href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)}>` +
        `<span class="pg-dot" aria-hidden="true"></span>${escapeHtml(handle.text)}</a></p>`,
    );
  }
  return (
    `<header class="pg-head">` +
    `<div class="pg-avatar" aria-hidden="${avatarSrc ? 'false' : 'true'}">${inner}</div>` +
    `<div class="pg-headtext">${textParts.join('')}</div>` +
    `</header>`
  );
}

function renderEntries(group: LinkBlock[], ctx: RenderCtx): string {
  const rows = group
    .map((link) => {
      const t = linkTarget(link.url, ctx);
      const kickParts: string[] = [];
      const icon = (link.icon || '').trim();
      if (icon) kickParts.push(escapeHtml(icon));
      if (t.isAr && t.dataAr) kickParts.push(`<span class="pg-ar">${escapeHtml(t.dataAr)}</span>`);
      const kick = kickParts.length ? `<span class="pg-ek">${kickParts.join(' · ')}</span>` : '';
      return (
        `<li><a class="pg-entry" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
        `<span class="pg-el">${escapeHtml(link.label)}${kick}</span>` +
        `<span class="pg-arrow" aria-hidden="true">${t.isAr ? 'ar://' : '→'}</span></a></li>`
      );
    })
    .join('');
  return `<ul class="pg-entries">${rows}</ul>`;
}

function renderSocial(block: SocialBlock, ctx: RenderCtx): string {
  const items = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      const label = item.platform ? escapeHtml(item.platform) : 'Link';
      return `<li><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>${label}</a></li>`;
    })
    .join('');
  return `<ul class="pg-inline-socials" aria-label="Contact links">${items}</ul>`;
}

function renderImage(src: string, alt: string, link: string | undefined, ctx: RenderCtx): string {
  const safe = safeImgSrc(src, ctx);
  if (!safe) return '';
  const img = `<img class="pg-img" src="${escapeAttr(safe)}" alt="${escapeAttr(alt)}" loading="lazy" />`;
  if (link) {
    const t = linkTarget(link, ctx);
    return `<figure class="pg-figure"><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>${img}</a></figure>`;
  }
  return `<figure class="pg-figure">${img}</figure>`;
}

function renderEmbed(arweave: string, ctx: RenderCtx): string {
  const raw = arweave.trim();
  const url = raw.toLowerCase().startsWith('ar://') ? raw : `ar://${raw}`;
  const t = linkTarget(url, ctx);
  return (
    `<ul class="pg-entries"><li><a class="pg-entry" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    `<span class="pg-el">${escapeHtml(raw)}<span class="pg-ek"><span class="pg-ar">ar://</span></span></span>` +
    `<span class="pg-arrow" aria-hidden="true">ar://</span></a></li></ul>`
  );
}

/** Render a section's non-heading items, grouping consecutive links into one list. */
function renderItems(items: Block[], ctx: RenderCtx): string {
  const out: string[] = [];
  let i = 0;
  while (i < items.length) {
    const block = items[i];
    if (block.type === 'link') {
      const group: LinkBlock[] = [];
      while (i < items.length && items[i].type === 'link') {
        group.push(items[i] as LinkBlock);
        i++;
      }
      out.push(renderEntries(group, ctx));
      continue;
    }
    switch (block.type) {
      case 'text':
        out.push(`<p class="pg-note">${multiline(block.text)}</p>`);
        break;
      case 'divider':
        out.push('<hr class="pg-divider" aria-hidden="true" />');
        break;
      case 'social':
        out.push(renderSocial(block, ctx));
        break;
      case 'image':
        out.push(renderImage(block.src, block.alt || '', block.link, ctx));
        break;
      case 'embed':
        out.push(renderEmbed(block.arweave, ctx));
        break;
      case 'heading':
      case 'verify':
        // headings never reach here; verify is rendered in the colophon.
        break;
    }
    i++;
  }
  return out.join('');
}

function renderColophon(verifyBlock: VerifyBlock | undefined, ctx: RenderCtx): string {
  const v = verifyTarget(verifyBlock, ctx);
  if (!v) return '';
  const label = verifyBlock && verifyBlock.label ? verifyBlock.label : 'Permanent on Arweave';
  return (
    `<footer class="pg-colophon"><a class="pg-verify" href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)}>` +
    `${SVG_LOCK}${escapeHtml(label)}</a></footer>`
  );
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  let verifyBlock: VerifyBlock | undefined;
  for (const b of def.blocks) {
    if (b.type === 'verify' && !verifyBlock) verifyBlock = b;
  }

  const out: string[] = [renderHead(def, ctx)];
  if (def.profile.bio) out.push(`<p class="pg-summary">${escapeHtml(def.profile.bio)}</p>`);

  for (const section of toSections(def.blocks)) {
    const inner = renderItems(section.items, ctx);
    const heading = section.heading
      ? `<h2 class="pg-sec">${escapeHtml(section.heading.text)}</h2>`
      : '';
    if (!heading && !inner) continue;
    out.push(`<section class="pg-section">${heading}${inner}</section>`);
  }

  out.push(renderColophon(verifyBlock, ctx));
  return `<main class="pg-sheet-wrap"><article class="pg-sheet">${out.join('')}</article></main>`;
}

export const resumeTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Resume',
    family: 'pro',
    description: 'A clean one-page CV sheet with heading-driven sections.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default resumeTemplate;
