/**
 * Spotlight — a minimal, high-conversion profile on deep charcoal. A soft radial
 * spotlight glow pools behind a large circular avatar at top-center; a big bold
 * name and a tight one-line bio sit above clean full-width buttons whose fill
 * slides in from the left on hover. Generous whitespace, refined typography.
 *
 * Fully self-contained: CSS-gradient lighting only, deterministic output. The
 * warm accent glow is driven by `theme.colors.accent` and the type by `theme.font`,
 * so the brand color + font are tunable while the rest of the look stays fixed.
 */

import type {
  Block,
  LinkBlock,
  PageDef,
  SocialBlock,
  TemplateId,
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

const ID = 'spotlight';
/** Provenance id. Cast because this template is authored ahead of its schema entry. */
const TEMPLATE = ID as unknown as TemplateId;

const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, system-ui, sans-serif';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-spotlight',
  template: TEMPLATE,
  title: 'Avery Cole — Founder & Maker',
  arnsName: 'avery',
  profile: {
    avatar: 'av',
    displayName: 'Avery Cole',
    tagline: 'Founder of Lumen. Building calm software for focused people.',
    bio: 'I write about product, craft, and the quiet discipline of shipping — and occasionally make things that outlive the hype.',
    handle: 'avery.ar.io',
  },
  blocks: [
    { type: 'link', label: 'Join the waitlist', url: 'https://example.com/waitlist', icon: '✦' },
    { type: 'link', label: 'Read the manifesto', url: 'https://example.com/manifesto', icon: '❖' },
    { type: 'link', label: 'Book a 15-min intro call', url: 'https://example.com/call', icon: '◷' },
    { type: 'heading', text: 'Featured' },
    {
      type: 'text',
      text: 'My latest essay on building durable products — stored permanently on the permaweb.',
    },
    {
      type: 'link',
      label: 'The Long Now of Software',
      url: 'ar://mT4nP8qX2vB9kR7wZ1cJ5sD3hN6fA0gE4uL7iO2YpQx',
      icon: '✧',
    },
    { type: 'divider' },
    {
      type: 'social',
      items: [
        { platform: 'x', url: 'https://example.com' },
        { platform: 'github', url: 'https://example.com' },
        { platform: 'linkedin', url: 'https://example.com' },
      ],
    },
    { type: 'verify', label: 'Permanent on Arweave', url: '#' },
  ],
  theme: {
    colors: { bg: '#0d0d11', surface: '#18181f', text: '#f4f4f6', accent: '#ffe9c9' },
    font: FONT,
    buttonShape: 'rounded',
    background: 'spotlight',
  },
  layout: { headerAlign: 'center', linkStyle: 'button', width: 'standard' },
};

const VERIFY_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="5" y="11" width="14" height="10" rx="2"></rect>' +
  '<path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>';

/** Escaped 1–2 letter initials for a social platform (self-contained, no icon fonts). */
function socialInitials(platform: string): string {
  const letters = platform.trim().replace(/[^A-Za-z0-9]/g, '');
  if (letters) return escapeHtml(letters.slice(0, 2));
  const first = platform.trim()[0];
  return first ? escapeHtml(first) : '·';
}

function buildStyle(def: PageDef): string {
  const accent = cssColor(def.theme?.colors?.accent ?? '', '#ffe9c9');
  const font = cssFontFamily(def.theme?.font ?? '', FONT);
  // hexToRgba only parses #rgb/#rrggbb; cssColor also allows rgb()/named/8-digit,
  // for which hexToRgba would yield rgba(0,0,0,α) and turn the glows black. Fall
  // back to the template's warm tone for any non-simple-hex accent.
  const glowHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(accent) ? accent : '#ffe9c9';
  const glow = (a: number) => hexToRgba(glowHex, a);
  return `
.pg-${ID} {
  --bg: #0d0d11; --text: #f4f4f6; --muted: #9a9aa6;
  --line: rgba(255,255,255,0.12); --btn: rgba(255,255,255,0.045);
  --accent: ${accent}; --spot: ${glow(0.9)};
  position: relative; min-height: 100vh; color: var(--text); background: var(--bg);
  font-family: ${font}; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  overflow-x: hidden; isolation: isolate; color-scheme: dark;
}
.pg-${ID} * { box-sizing: border-box; }
.pg-${ID}::before {
  content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none;
  background: radial-gradient(78% 55% at 50% -8%, #191921 0%, #0d0d11 58%);
}
.pg-${ID} .pg-wrap {
  position: relative; width: 100%; max-width: 34rem; margin: 0 auto;
  padding: clamp(3rem, 9vw, 5rem) clamp(1.25rem, 5vw, 1.75rem) 3.5rem;
}
.pg-${ID} .pg-hero { position: relative; text-align: center; margin-bottom: 2.25rem; }
.pg-${ID} .pg-hero::before {
  content: ""; position: absolute; top: -14%; left: 50%; transform: translateX(-50%);
  width: min(30rem, 130%); aspect-ratio: 1 / 1; border-radius: 50%;
  background: radial-gradient(circle, ${glow(0.22)}, ${glow(0.05)} 40%, transparent 68%);
  filter: blur(4px); z-index: -1; pointer-events: none;
}
.pg-${ID} .pg-avatar {
  width: 132px; height: 132px; margin: 0 auto 1.4rem; border-radius: 50%;
  display: grid; place-items: center; overflow: hidden;
  background: linear-gradient(160deg, #26262e, #131318);
  color: #fff; font-size: 2.7rem; font-weight: 700; letter-spacing: 0.01em; text-transform: uppercase;
  border: 1px solid rgba(255,255,255,0.16);
  box-shadow: 0 0 0 6px rgba(255,255,255,0.02), 0 20px 50px -18px rgba(0,0,0,0.9), 0 0 64px -14px ${glow(0.28)};
}
.pg-${ID} .pg-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }
.pg-${ID} .pg-name {
  margin: 0 0 0.5rem; font-size: clamp(1.9rem, 6.5vw, 2.5rem); font-weight: 800;
  letter-spacing: -0.02em; line-height: 1.05;
}
.pg-${ID} .pg-tagline { margin: 0 auto; max-width: 26rem; color: var(--muted); font-size: 1rem; line-height: 1.5; }
.pg-${ID} .pg-handle {
  display: inline-flex; align-items: center; gap: 0.45rem; margin-top: 1.1rem;
  padding: 0.34rem 0.8rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600;
  color: var(--text); text-decoration: none; background: rgba(255,255,255,0.05);
  border: 1px solid var(--line); transition: border-color 0.3s ease, transform 0.3s ease;
}
.pg-${ID} .pg-handle .pg-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px ${glow(0.75)}; flex: 0 0 auto;
}
.pg-${ID} .pg-handle:hover { border-color: ${glow(0.5)}; transform: translateY(-1px); }
.pg-${ID} .pg-bio {
  margin: 1.15rem auto 0; max-width: 28rem; color: var(--muted); font-size: 0.95rem; line-height: 1.6; text-align: center;
}
.pg-${ID} .pg-links { display: flex; flex-direction: column; gap: 0.85rem; margin-top: 2rem; }
.pg-${ID} .pg-btn {
  position: relative; display: flex; align-items: center; gap: 0.8rem; overflow: hidden;
  min-height: 56px; padding: 1rem 1.35rem; border-radius: 14px; text-decoration: none;
  color: var(--text); font-weight: 600; font-size: 1rem;
  background: var(--btn); border: 1px solid var(--line);
  transition: border-color 0.35s ease, transform 0.35s ease;
}
.pg-${ID} .pg-btn::before {
  content: ""; position: absolute; inset: 0; z-index: 0; background: #f4f4f6;
  transform: translateX(-101%); transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}
.pg-${ID} .pg-btn:hover { border-color: transparent; transform: translateY(-1px); }
.pg-${ID} .pg-btn:hover::before { transform: translateX(0); }
.pg-${ID} .pg-btn > * { position: relative; z-index: 1; transition: color 0.3s ease; }
.pg-${ID} .pg-btn:hover .pg-btn-label,
.pg-${ID} .pg-btn:hover .pg-btn-ico,
.pg-${ID} .pg-btn:hover .pg-btn-arrow { color: #0d0d11; }
.pg-${ID} .pg-btn-ico { flex: 0 0 auto; font-size: 1.05rem; line-height: 1; }
.pg-${ID} .pg-btn-label { flex: 1 1 auto; }
.pg-${ID} .pg-btn-arrow { flex: 0 0 auto; color: var(--muted); transition: transform 0.35s ease, color 0.3s ease; }
.pg-${ID} .pg-btn:hover .pg-btn-arrow { transform: translateX(3px); }
.pg-${ID} .pg-btn--ar .pg-btn-arrow { font-size: 0.66rem; font-weight: 700; letter-spacing: 0.06em; }
.pg-${ID} .pg-heading {
  margin: 2.25rem 0 0.25rem; text-align: center; font-size: 0.72rem; font-weight: 700;
  letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted);
}
.pg-${ID} .pg-text {
  margin: 0.5rem auto 0; max-width: 28rem; text-align: center; color: var(--muted); font-size: 0.95rem; line-height: 1.65;
}
.pg-${ID} .pg-divider {
  height: 1px; border: 0; margin: 2rem auto; width: 40%;
  background: linear-gradient(90deg, transparent, var(--line), transparent);
}
.pg-${ID} .pg-social {
  display: flex; justify-content: center; flex-wrap: wrap; gap: 0.6rem; margin: 1.75rem 0 0; padding: 0; list-style: none;
}
.pg-${ID} .pg-social a {
  width: 46px; height: 46px; display: grid; place-items: center; border-radius: 50%;
  color: var(--text); text-decoration: none; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase;
  background: rgba(255,255,255,0.05); border: 1px solid var(--line);
  transition: border-color 0.3s ease, transform 0.3s ease, background 0.3s ease, color 0.3s ease;
}
.pg-${ID} .pg-social a:hover {
  transform: translateY(-2px); border-color: ${glow(0.5)}; background: ${glow(0.1)};
}
.pg-${ID} .pg-figure { margin: 1.75rem 0 0; }
.pg-${ID} .pg-img { display: block; width: 100%; height: auto; border-radius: 16px; border: 1px solid var(--line); }
.pg-${ID} .pg-footer { margin-top: 2.75rem; text-align: center; }
.pg-${ID} .pg-verify {
  display: inline-flex; align-items: center; gap: 0.42rem; color: var(--muted); text-decoration: none;
  font-size: 0.8rem; padding: 0.35rem 0.7rem; border-radius: 999px; border: 1px solid transparent;
  transition: color 0.3s ease, border-color 0.3s ease;
}
.pg-${ID} .pg-verify svg { width: 13px; height: 13px; display: block; }
.pg-${ID} .pg-verify:hover { color: var(--text); border-color: var(--line); }
.pg-${ID} .pg-made {
  display: block; margin-top: 0.7rem; font-size: 0.72rem; color: rgba(255,255,255,0.28); letter-spacing: 0.04em;
}
.pg-${ID} a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 12px; }
.pg-${ID} .pg-social a:focus-visible,
.pg-${ID} .pg-handle:focus-visible,
.pg-${ID} .pg-verify:focus-visible { border-radius: 999px; }
@media (prefers-reduced-motion: reduce) {
  .pg-${ID} .pg-btn::before { transition: none; }
  .pg-${ID} .pg-btn,
  .pg-${ID} .pg-social a,
  .pg-${ID} .pg-handle,
  .pg-${ID} .pg-verify,
  .pg-${ID} .pg-btn-arrow { transition: color 0.01s, border-color 0.01s; }
  .pg-${ID} .pg-btn:hover,
  .pg-${ID} .pg-social a:hover,
  .pg-${ID} .pg-handle:hover { transform: none; }
  .pg-${ID} .pg-btn:hover .pg-btn-arrow { transform: none; }
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
    `<div class="pg-avatar" aria-hidden="true">${inner}</div>`,
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
  return `<header class="pg-hero">${parts.join('')}</header>`;
}

function renderButton(link: LinkBlock, ctx: RenderCtx): string {
  const t = linkTarget(link.url, ctx);
  const ico = link.icon
    ? `<span class="pg-btn-ico" aria-hidden="true">${escapeHtml(link.icon)}</span>`
    : '';
  const cls = t.isAr ? 'pg-btn pg-btn--ar' : 'pg-btn';
  const arrow = t.isAr ? 'ar://' : '→';
  return (
    `<a class="${cls}" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    ico +
    `<span class="pg-btn-label">${escapeHtml(link.label)}</span>` +
    `<span class="pg-btn-arrow" aria-hidden="true">${arrow}</span></a>`
  );
}

function renderLinks(group: LinkBlock[], ctx: RenderCtx): string {
  return `<nav class="pg-links" aria-label="Links">${group.map((l) => renderButton(l, ctx)).join('')}</nav>`;
}

function renderSocial(block: SocialBlock, ctx: RenderCtx): string {
  const items = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      const label = item.platform ? escapeAttr(item.platform) : 'Social link';
      return (
        `<li><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)} aria-label="${label}">` +
        `<span aria-hidden="true">${socialInitials(item.platform)}</span></a></li>`
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
    `<span class="pg-btn-ico" aria-hidden="true">✦</span>` +
    `<span class="pg-btn-label">${escapeHtml(raw)}</span>` +
    `<span class="pg-btn-arrow" aria-hidden="true">ar://</span></a></nav>`
  );
}

function renderFooter(verifyBlock: VerifyBlock | undefined, ctx: RenderCtx): string {
  const v = verifyTarget(verifyBlock, ctx);
  const parts: string[] = [];
  if (v) {
    const label = verifyBlock && verifyBlock.label ? verifyBlock.label : 'Permanent on Arweave';
    parts.push(
      `<a class="pg-verify" href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)}>` +
        `${VERIFY_SVG} ${escapeHtml(label)}</a>`,
    );
  }
  parts.push(`<span class="pg-made">Made with Spotlight</span>`);
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

export const spotlightTemplate: PagesTemplate = {
  id: TEMPLATE,
  meta: {
    name: 'Spotlight',
    family: 'modern',
    description: 'Minimal, high-conversion profile — a soft spotlight glow over full-width buttons.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: buildStyle(def) };
  },
};

export default spotlightTemplate;
