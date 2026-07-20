/**
 * Business Card — a clean, corporate digital business card: a rounded, softly
 * shadowed physical-card surface with a brand accent edge. Name, role and a
 * compact contact block sit beside a monogram, laid out as a landscape card on
 * desktop that stacks to a single column on mobile. Generous whitespace, no
 * external assets, fully self-contained.
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

const ID = 'business-card' as unknown as import('../schema').TemplateId;

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-business-card',
  template: ID,
  title: 'Daniel Okafor — Product Designer',
  arnsName: 'daniel',
  profile: {
    avatar: 'DO',
    displayName: 'Daniel Okafor',
    tagline: 'Product Designer · Meridian Studio',
    handle: 'daniel.ar.io',
    bio: 'Designing calm, considered products for teams who care about the details. Available for select freelance and advisory work.',
  },
  blocks: [
    { type: 'heading', text: 'Contact' },
    { type: 'link', label: 'daniel@meridian.studio', url: 'mailto:daniel@meridian.studio', icon: '@' },
    { type: 'link', label: '+1 (415) 555-0148', url: 'tel:+14155550148', icon: 'tel' },
    { type: 'link', label: 'meridian.studio', url: 'https://meridian.studio', icon: 'web' },
    { type: 'link', label: 'Portfolio — on the permaweb', url: 'ar://danielokafor', icon: 'pf' },
    { type: 'divider' },
    { type: 'heading', text: 'Elsewhere' },
    {
      type: 'social',
      items: [
        { platform: 'LinkedIn', url: 'https://linkedin.com/' },
        { platform: 'Dribbble', url: 'https://dribbble.com/' },
        { platform: 'GitHub', url: 'https://github.com/' },
        { platform: 'x', url: 'https://x.com/' },
      ],
    },
    { type: 'verify', label: 'Permanent on Arweave', url: '#' },
  ],
  theme: {
    colors: { bg: '#EDEFF4', surface: '#FFFFFF', text: '#1E2233', accent: '#4F46E5' },
    font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    buttonShape: 'rounded',
    background: 'soft neutral desk with a single brand-accent card edge',
  },
  layout: { headerAlign: 'left', linkStyle: 'card', width: 'standard' },
};

const SVG_LOCK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
  'stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10" rx="2.5"/>' +
  '<path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>';

/** One-or-two-letter uppercase chip glyph for a social platform (escaped at call site). */
function socialInitial(platform: string): string {
  const p = platform.trim();
  if (!p) return '•';
  return p.slice(0, 2).toUpperCase();
}

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const bg = cssColor(c.bg, '#EDEFF4');
  const surface = cssColor(c.surface, '#FFFFFF');
  const text = cssColor(c.text, '#1E2233');
  const accent = cssColor(c.accent, '#4F46E5');
  const accentSoft = hexToRgba(c.accent, 0.12);
  const accentEdge = hexToRgba(c.accent, 0.4);
  const font = cssFontFamily(
    def.theme.font,
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  );

  const lightVars =
    `--bg:${bg}; --surface:${surface}; --text:${text}; --accent:${accent}; ` +
    `--accent-soft:${accentSoft}; --accent-edge:${accentEdge}; ` +
    `--muted:rgba(30,34,51,0.62); --hair:rgba(30,34,51,0.12); ` +
    `--chip:rgba(30,34,51,0.05); --shadow:rgba(24,28,48,0.14);`;
  const darkVars =
    `--bg:#0C0E16; --surface:#14161F; --text:#EAECF5; --accent:${accent}; ` +
    `--accent-soft:rgba(255,255,255,0.06); --accent-edge:${accentEdge}; ` +
    `--muted:rgba(234,236,245,0.6); --hair:rgba(255,255,255,0.1); ` +
    `--chip:rgba(255,255,255,0.06); --shadow:rgba(0,0,0,0.5);`;

  return `
.pg-${ID} { ${lightVars} }
.pg-${ID} * { box-sizing: border-box; }
.pg-${ID} {
  font-family: ${font}; color: var(--text); background: var(--bg);
  min-height: 100vh; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
@media (prefers-color-scheme: dark) { .pg-${ID} { ${darkVars} } }
.pg-${ID} .pg-card-wrap {
  width: 100%; max-width: 44rem; margin: 0 auto;
  padding: clamp(1.5rem, 6vw, 3.5rem) clamp(1rem, 4vw, 1.75rem);
  display: flex; align-items: center; min-height: 100vh;
}
.pg-${ID} .pg-card {
  position: relative; width: 100%; overflow: hidden;
  background: var(--surface); border: 1px solid var(--hair); border-radius: 20px;
  box-shadow: 0 1px 2px var(--shadow), 0 22px 48px -22px var(--shadow);
}
.pg-${ID} .pg-edge {
  position: absolute; inset: 0 auto 0 0; width: 6px;
  background: linear-gradient(180deg, var(--accent), var(--accent-edge));
}
.pg-${ID} .pg-inner {
  display: grid; grid-template-columns: 1fr; gap: clamp(1.25rem, 4vw, 2rem);
  padding: clamp(1.5rem, 5vw, 2.5rem) clamp(1.35rem, 5vw, 2.5rem) clamp(1.5rem, 5vw, 2.25rem);
  padding-left: clamp(1.6rem, 5vw, 2.75rem);
}
.pg-${ID} .pg-id { display: flex; align-items: center; gap: 1rem; }
.pg-${ID} .pg-avatar {
  flex: 0 0 auto; width: 68px; height: 68px; border-radius: 16px; display: grid; place-items: center;
  font-size: 1.5rem; font-weight: 700; letter-spacing: .02em; text-transform: uppercase;
  color: var(--accent); background: var(--accent-soft); border: 1px solid var(--hair); overflow: hidden;
}
.pg-${ID} .pg-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 16px; }
.pg-${ID} .pg-idtext { min-width: 0; }
.pg-${ID} .pg-name {
  margin: 0; font-size: clamp(1.4rem, 4.6vw, 1.7rem); font-weight: 700; letter-spacing: -.01em; line-height: 1.15;
}
.pg-${ID} .pg-role { margin: .28rem 0 0; font-size: .95rem; font-weight: 600; color: var(--accent); }
.pg-${ID} .pg-handle {
  display: inline-flex; align-items: center; gap: .4rem; margin-top: .55rem;
  padding: .24rem .6rem; border-radius: 999px; font-size: .76rem; font-weight: 600;
  color: var(--text); text-decoration: none; background: var(--chip); border: 1px solid var(--hair);
  transition: border-color .2s ease, color .2s ease;
}
.pg-${ID} .pg-handle .pg-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex: 0 0 auto;
}
.pg-${ID} .pg-handle:hover, .pg-${ID} .pg-handle:focus-visible { color: var(--accent); border-color: var(--accent-edge); }
.pg-${ID} .pg-details { min-width: 0; }
.pg-${ID} .pg-about {
  margin: 0 0 1.25rem; font-size: .95rem; line-height: 1.6; color: var(--muted);
}
.pg-${ID} .pg-label {
  margin: 1.25rem 0 .6rem; font-size: .72rem; font-weight: 700; letter-spacing: .12em;
  text-transform: uppercase; color: var(--muted);
}
.pg-${ID} .pg-label:first-child { margin-top: 0; }
.pg-${ID} .pg-contacts { display: flex; flex-direction: column; gap: .5rem; margin: 0 0 .5rem; }
.pg-${ID} .pg-contact {
  display: flex; align-items: center; gap: .75rem; min-height: 44px; padding: .55rem .75rem;
  border-radius: 12px; text-decoration: none; color: var(--text); font-size: .95rem; font-weight: 500;
  background: var(--chip); border: 1px solid var(--hair);
  transition: border-color .2s ease, background .2s ease, transform .2s ease;
}
.pg-${ID} .pg-contact:hover, .pg-${ID} .pg-contact:focus-visible {
  border-color: var(--accent-edge); transform: translateY(-1px);
}
.pg-${ID} .pg-contact .pg-ci {
  flex: 0 0 auto; width: 26px; height: 26px; display: grid; place-items: center; border-radius: 8px;
  font-size: .62rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
  color: var(--accent); background: var(--accent-soft);
}
.pg-${ID} .pg-contact .pg-cl { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
.pg-${ID} .pg-contact .pg-arrow { flex: 0 0 auto; color: var(--muted); font-size: .8rem; font-weight: 700; }
.pg-${ID} .pg-contact.pg-ar .pg-arrow { letter-spacing: .04em; }
.pg-${ID} .pg-text { margin: .75rem 0; font-size: .95rem; line-height: 1.6; color: var(--muted); }
.pg-${ID} .pg-divider { height: 1px; border: 0; margin: 1.35rem 0; background: var(--hair); }
.pg-${ID} .pg-figure { margin: 1rem 0; }
.pg-${ID} .pg-img { display: block; width: 100%; height: auto; border-radius: 14px; border: 1px solid var(--hair); }
.pg-${ID} .pg-socials { display: flex; flex-wrap: wrap; gap: .55rem; margin: .25rem 0 0; padding: 0; list-style: none; }
.pg-${ID} .pg-socials a {
  display: inline-flex; align-items: center; justify-content: center; min-width: 44px; height: 44px;
  padding: 0 .55rem; border-radius: 12px; color: var(--text); text-decoration: none;
  font-size: .82rem; font-weight: 700; letter-spacing: .03em;
  background: var(--chip); border: 1px solid var(--hair);
  transition: border-color .2s ease, color .2s ease, transform .2s ease;
}
.pg-${ID} .pg-socials a:hover, .pg-${ID} .pg-socials a:focus-visible {
  color: var(--accent); border-color: var(--accent-edge); transform: translateY(-1px);
}
.pg-${ID} .pg-foot { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--hair); }
.pg-${ID} .pg-verify {
  display: inline-flex; align-items: center; gap: .45rem; color: var(--muted); text-decoration: none;
  font-size: .78rem; font-weight: 600; transition: color .2s ease;
}
.pg-${ID} .pg-verify svg { width: 13px; height: 13px; display: block; }
.pg-${ID} .pg-verify:hover, .pg-${ID} .pg-verify:focus-visible { color: var(--accent); }
.pg-${ID} a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (min-width: 40rem) {
  .pg-${ID} .pg-inner { grid-template-columns: 15rem 1fr; align-items: start; gap: 2.25rem; }
  .pg-${ID} .pg-id { flex-direction: column; align-items: flex-start; text-align: left; gap: 1rem; padding-right: 1.5rem; border-right: 1px solid var(--hair); }
  .pg-${ID} .pg-avatar { width: 76px; height: 76px; }
}
@media (prefers-reduced-motion: reduce) {
  .pg-${ID} .pg-contact, .pg-${ID} .pg-socials a, .pg-${ID} .pg-handle { transition: none; }
  .pg-${ID} .pg-contact:hover, .pg-${ID} .pg-socials a:hover { transform: none; }
}
`.trim();
}

function renderId(def: PageDef, ctx: RenderCtx): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  const avatarSrc = p.avatar ? safeImgSrc(p.avatar, ctx) : '';
  const inner = avatarSrc
    ? `<img src="${escapeAttr(avatarSrc)}" alt="${escapeAttr(p.displayName)}" loading="lazy" />`
    : escapeHtml(avatarInitials(def));

  const parts: string[] = [
    `<div class="pg-avatar" aria-hidden="${avatarSrc ? 'false' : 'true'}">${inner}</div>`,
    '<div class="pg-idtext">',
    `<h1 class="pg-name">${escapeHtml(p.displayName)}</h1>`,
  ];
  if (p.tagline) parts.push(`<p class="pg-role">${escapeHtml(p.tagline)}</p>`);
  if (handle) {
    parts.push(
      `<a class="pg-handle" href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)}>` +
        `<span class="pg-dot" aria-hidden="true"></span>${escapeHtml(handle.text)}</a>`,
    );
  }
  parts.push('</div>');
  return `<header class="pg-id">${parts.join('')}</header>`;
}

function renderContacts(group: LinkBlock[], ctx: RenderCtx): string {
  const rows = group
    .map((link) => {
      const t = linkTarget(link.url, ctx);
      const glyph = (link.icon || '').trim();
      const ci = glyph
        ? `<span class="pg-ci" aria-hidden="true">${escapeHtml(glyph.slice(0, 3))}</span>`
        : `<span class="pg-ci" aria-hidden="true">${escapeHtml(socialInitial(link.label || 'link'))}</span>`;
      const arrow = t.isAr ? 'ar://' : '→';
      const cls = t.isAr ? 'pg-contact pg-ar' : 'pg-contact';
      return (
        `<a class="${cls}" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
        ci +
        `<span class="pg-cl">${escapeHtml(link.label)}</span>` +
        `<span class="pg-arrow" aria-hidden="true">${arrow}</span></a>`
      );
    })
    .join('');
  return `<div class="pg-contacts">${rows}</div>`;
}

function renderSocial(block: SocialBlock, ctx: RenderCtx): string {
  const items = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      const label = item.platform ? escapeAttr(item.platform) : 'Social link';
      return (
        `<li><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)} aria-label="${label}">` +
        `${escapeHtml(socialInitial(item.platform))}</a></li>`
      );
    })
    .join('');
  return `<ul class="pg-socials" aria-label="Social links">${items}</ul>`;
}

function renderEmbed(arweave: string, ctx: RenderCtx): string {
  const raw = arweave.trim();
  const url = raw.toLowerCase().startsWith('ar://') ? raw : `ar://${raw}`;
  const t = linkTarget(url, ctx);
  return (
    `<div class="pg-contacts"><a class="pg-contact pg-ar" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    `<span class="pg-ci" aria-hidden="true">AR</span>` +
    `<span class="pg-cl">${escapeHtml(raw)}</span>` +
    `<span class="pg-arrow" aria-hidden="true">ar://</span></a></div>`
  );
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

function renderFoot(verifyBlock: VerifyBlock | undefined, ctx: RenderCtx): string {
  const v = verifyTarget(verifyBlock, ctx);
  if (!v) return '';
  const label = verifyBlock && verifyBlock.label ? verifyBlock.label : 'Permanent on Arweave';
  return (
    `<footer class="pg-foot"><a class="pg-verify" href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)}>` +
    `${SVG_LOCK}${escapeHtml(label)}</a></footer>`
  );
}

function renderDetails(def: PageDef, ctx: RenderCtx): string {
  const blocks = def.blocks;

  let verifyBlock: VerifyBlock | undefined;
  for (const b of blocks) {
    if (b.type === 'verify' && !verifyBlock) verifyBlock = b;
  }

  const out: string[] = [];
  if (def.profile.bio) out.push(`<p class="pg-about">${escapeHtml(def.profile.bio)}</p>`);

  let i = 0;
  while (i < blocks.length) {
    const block: Block = blocks[i];
    if (block.type === 'link') {
      const group: LinkBlock[] = [];
      while (i < blocks.length && blocks[i].type === 'link') {
        group.push(blocks[i] as LinkBlock);
        i++;
      }
      out.push(renderContacts(group, ctx));
      continue;
    }
    switch (block.type) {
      case 'heading':
        out.push(`<h2 class="pg-label">${escapeHtml(block.text)}</h2>`);
        break;
      case 'text':
        out.push(`<p class="pg-text">${multiline(block.text)}</p>`);
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
      case 'verify':
        // Rendered in the footer via the pre-scan above.
        break;
    }
    i++;
  }

  out.push(renderFoot(verifyBlock, ctx));
  return `<div class="pg-details">${out.join('')}</div>`;
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  return (
    `<main class="pg-card-wrap"><article class="pg-card">` +
    `<span class="pg-edge" aria-hidden="true"></span>` +
    `<div class="pg-inner">${renderId(def, ctx)}${renderDetails(def, ctx)}</div>` +
    `</article></main>`
  );
}

export const businessCardTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Business Card',
    family: 'pro',
    description: 'A corporate-clean digital business card with a brand accent edge.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default businessCardTemplate;
