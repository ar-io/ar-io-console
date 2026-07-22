/**
 * Pastel Pop — a playful, Gen-Z link-in-bio on a soft mint→peach→lavender
 * gradient. Everything is big and rounded: chunky friendly cards, pillowy social
 * chips, and buttons with a gentle bouncy lift (translateY + scale) on hover.
 * Link `icon`s render as big emoji accents. Approachable and fun.
 *
 * Fully self-contained: CSS-gradient backdrop only, deterministic output. The
 * primary accent (`--purple`) is driven by `theme.colors.accent` and the type by
 * `theme.font`, so the brand color + font are tunable while the playful pastel
 * backdrop and pink secondary stay fixed.
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

const ID = 'pastel-pop';
/** Provenance id. Cast because this template is authored ahead of its schema entry. */
const TEMPLATE = ID as unknown as TemplateId;

const FONT =
  'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-pastel-pop',
  template: TEMPLATE,
  title: 'Poppy Rivera — Illustrator',
  arnsName: 'poppy',
  profile: {
    avatar: 'po',
    displayName: 'Poppy Rivera',
    tagline: 'Illustrator drawing happy little creatures 🌿',
    bio: 'Freelance illustrator & sticker maker turning feelings into color. Open for commissions and cozy collabs!',
    handle: 'poppy.ar.io',
  },
  blocks: [
    { type: 'link', label: 'Shop my sticker packs', url: 'https://example.com/shop', icon: '🛍️' },
    { type: 'link', label: 'Commission me', url: 'https://example.com/commissions', icon: '✏️' },
    { type: 'link', label: 'My permaweb print gallery', url: 'ar://poppy-prints', icon: '🖼️' },
    { type: 'heading', text: 'Latest drop' },
    { type: 'text', text: 'New spring creature pack is live — 20 hand-drawn friends 🌸' },
    { type: 'embed', arweave: 'sQ7wZ1cJ5sD3hN6fA0gE4uL7iO2YpQxmT4nP8qX2vB' },
    { type: 'divider' },
    {
      type: 'social',
      items: [
        { platform: 'instagram', url: 'https://example.com' },
        { platform: 'tiktok', url: 'https://example.com' },
        { platform: 'x', url: 'https://example.com' },
      ],
    },
    { type: 'verify', label: 'Permanent on Arweave', url: '#' },
  ],
  theme: {
    colors: { bg: '#f3ecff', surface: '#ffffff', text: '#4a3b63', accent: '#b98cff' },
    font: FONT,
    buttonShape: 'rounded',
    background: 'pastel',
  },
  layout: { headerAlign: 'center', linkStyle: 'button', width: 'standard' },
};

const VERIFY_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="5" y="11" width="14" height="10" rx="3"></rect>' +
  '<path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>';

/** Escaped 1–2 letter initials for a social platform (self-contained, no icon fonts). */
function socialInitials(platform: string): string {
  const letters = platform.trim().replace(/[^A-Za-z0-9]/g, '');
  if (letters) return escapeHtml(letters.slice(0, 2));
  const first = platform.trim()[0];
  return first ? escapeHtml(first) : '·';
}

function buildStyle(def: PageDef): string {
  const accent = cssColor(def.theme?.colors?.accent ?? '', '#b98cff');
  const font = cssFontFamily(def.theme?.font ?? '', FONT);
  // hexToRgba only parses #rgb/#rrggbb; cssColor also allows rgb()/named/8-digit,
  // for which hexToRgba would yield rgba(0,0,0,α) and turn the shadows black. Fall
  // back to the template's purple for any non-simple-hex accent.
  const glowHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(accent) ? accent : '#b98cff';
  const glow = (a: number) => hexToRgba(glowHex, a);
  return `
.pg-${ID} {
  --ink: #4a3b63; --ink-soft: #7c6f92; --card: #ffffff;
  --pink: #ff8fb1; --purple: ${accent};
  position: relative; min-height: 100vh; color: var(--ink); background: #f3ecff;
  font-family: ${font}; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  overflow-x: hidden; isolation: isolate; color-scheme: light;
}
.pg-${ID} * { box-sizing: border-box; }
.pg-${ID}::before {
  content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none;
  background:
    radial-gradient(38% 30% at 15% 12%, rgba(143,227,196,0.85), transparent 60%),
    radial-gradient(42% 34% at 85% 18%, rgba(255,195,160,0.85), transparent 62%),
    radial-gradient(52% 42% at 50% 102%, rgba(185,140,255,0.75), transparent 66%),
    linear-gradient(162deg, #e8fff6 0%, #fff2ea 46%, #f3ecff 100%);
}
.pg-${ID} .pg-wrap {
  position: relative; width: 100%; max-width: 33rem; margin: 0 auto;
  padding: clamp(2.5rem, 8vw, 4rem) clamp(1.25rem, 5vw, 1.75rem) 3.5rem;
}
.pg-${ID} .pg-hero { text-align: center; margin-bottom: 1.75rem; }
.pg-${ID} .pg-avatar {
  width: 120px; height: 120px; margin: 0 auto 1.25rem; border-radius: 50%;
  display: grid; place-items: center; overflow: hidden;
  background: linear-gradient(140deg, #ff8fb1, var(--purple));
  color: #fff; font-size: 2.6rem; font-weight: 800; text-transform: uppercase;
  border: 5px solid #fff; box-shadow: 0 14px 30px -10px ${glow(0.6)};
}
.pg-${ID} .pg-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }
.pg-${ID} .pg-name {
  margin: 0 0 0.4rem; font-size: clamp(1.8rem, 6vw, 2.4rem); font-weight: 800; letter-spacing: -0.01em; line-height: 1.1;
}
.pg-${ID} .pg-tagline { margin: 0 auto; max-width: 24rem; color: var(--ink-soft); font-weight: 600; font-size: 1rem; line-height: 1.45; }
.pg-${ID} .pg-handle {
  display: inline-flex; align-items: center; gap: 0.4rem; margin-top: 1rem;
  padding: 0.4rem 0.9rem; border-radius: 999px; font-size: 0.82rem; font-weight: 700;
  color: var(--ink); text-decoration: none; background: #fff; border: 2px solid #fff;
  box-shadow: 0 6px 16px -8px rgba(74,59,99,0.35);
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
}
.pg-${ID} .pg-handle .pg-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--pink); flex: 0 0 auto; }
.pg-${ID} .pg-handle:hover { transform: translateY(-3px) scale(1.03); box-shadow: 0 12px 22px -10px rgba(74,59,99,0.4); }
.pg-${ID} .pg-bio { margin: 1.1rem auto 0; max-width: 26rem; text-align: center; color: var(--ink-soft); font-weight: 500; font-size: 0.95rem; line-height: 1.6; }
.pg-${ID} .pg-links { display: flex; flex-direction: column; gap: 1rem; margin-top: 1.75rem; }
.pg-${ID} .pg-btn {
  display: flex; align-items: center; gap: 0.9rem; min-height: 62px; padding: 1rem 1.4rem;
  border-radius: 26px; text-decoration: none; color: var(--ink); font-weight: 700; font-size: 1.05rem;
  background: #fff; border: 3px solid #fff; box-shadow: 0 10px 22px -12px rgba(74,59,99,0.45);
  transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.28s ease, border-color 0.28s ease;
}
.pg-${ID} .pg-btn:hover {
  transform: translateY(-4px) scale(1.02); border-color: var(--purple); box-shadow: 0 18px 30px -14px ${glow(0.6)};
}
.pg-${ID} .pg-btn-ico {
  flex: 0 0 auto; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 16px;
  font-size: 1.5rem; line-height: 1; background: linear-gradient(140deg, #ffe0ec, #ede0ff);
}
.pg-${ID} .pg-btn-label { flex: 1 1 auto; }
.pg-${ID} .pg-btn-arrow { flex: 0 0 auto; font-size: 1.2rem; color: var(--purple); transition: transform 0.28s ease; }
.pg-${ID} .pg-btn:hover .pg-btn-arrow { transform: translateX(4px); }
.pg-${ID} .pg-btn--ar .pg-btn-arrow { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.05em; }
.pg-${ID} .pg-heading { margin: 2rem 0 0.25rem; text-align: center; font-size: 1.15rem; font-weight: 800; color: var(--ink); }
.pg-${ID} .pg-heading::after {
  content: ""; display: block; width: 44px; height: 5px; border-radius: 999px; margin: 0.55rem auto 0;
  background: linear-gradient(90deg, var(--pink), var(--purple));
}
.pg-${ID} .pg-text { margin: 0.6rem auto 0; max-width: 26rem; text-align: center; color: var(--ink-soft); font-weight: 500; font-size: 0.95rem; line-height: 1.65; }
.pg-${ID} .pg-divider { border: 0; height: 0; margin: 1.6rem auto; width: 60%; border-top: 3px dotted rgba(74,59,99,0.22); }
.pg-${ID} .pg-social { display: flex; justify-content: center; flex-wrap: wrap; gap: 0.7rem; margin: 1.6rem 0 0; padding: 0; list-style: none; }
.pg-${ID} .pg-social a {
  width: 50px; height: 50px; display: grid; place-items: center; border-radius: 18px;
  color: var(--ink); text-decoration: none; font-size: 0.82rem; font-weight: 800; text-transform: uppercase;
  background: #fff; border: 3px solid #fff; box-shadow: 0 8px 18px -10px rgba(74,59,99,0.4);
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.25s ease;
}
.pg-${ID} .pg-social a:hover { transform: translateY(-3px) scale(1.05) rotate(-3deg); border-color: var(--pink); }
.pg-${ID} .pg-figure { margin: 1.6rem 0 0; }
.pg-${ID} .pg-img { display: block; width: 100%; height: auto; border-radius: 24px; border: 4px solid #fff; box-shadow: 0 12px 26px -14px rgba(74,59,99,0.5); }
.pg-${ID} .pg-footer { margin-top: 2.5rem; text-align: center; }
.pg-${ID} .pg-verify {
  display: inline-flex; align-items: center; gap: 0.45rem; color: var(--ink); text-decoration: none;
  font-size: 0.82rem; font-weight: 700; padding: 0.5rem 1rem; border-radius: 999px;
  background: #fff; border: 2px solid #fff; box-shadow: 0 6px 16px -8px rgba(74,59,99,0.35);
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.pg-${ID} .pg-verify svg { width: 14px; height: 14px; display: block; }
.pg-${ID} .pg-verify:hover { transform: translateY(-3px) scale(1.03); }
.pg-${ID} .pg-made { display: block; margin-top: 0.8rem; font-size: 0.75rem; font-weight: 600; color: var(--ink-soft); }
.pg-${ID} a:focus-visible { outline: 3px solid var(--purple); outline-offset: 3px; border-radius: 16px; }
.pg-${ID} .pg-social a:focus-visible,
.pg-${ID} .pg-handle:focus-visible,
.pg-${ID} .pg-verify:focus-visible { border-radius: 999px; }
@media (prefers-reduced-motion: reduce) {
  .pg-${ID} .pg-btn,
  .pg-${ID} .pg-social a,
  .pg-${ID} .pg-handle,
  .pg-${ID} .pg-verify,
  .pg-${ID} .pg-btn-arrow { transition: none; }
  .pg-${ID} .pg-btn:hover,
  .pg-${ID} .pg-social a:hover,
  .pg-${ID} .pg-handle:hover,
  .pg-${ID} .pg-verify:hover { transform: none; }
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
    `<span class="pg-btn-ico" aria-hidden="true">📦</span>` +
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
  parts.push(`<span class="pg-made">Made with Pastel Pop</span>`);
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

export const pastelPopTemplate: PagesTemplate = {
  id: TEMPLATE,
  meta: {
    name: 'Pastel Pop',
    family: 'modern',
    description: 'Playful pastel gradient with big rounded cards and bouncy, emoji-friendly buttons.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: buildStyle(def) };
  },
};

export default pastelPopTemplate;
