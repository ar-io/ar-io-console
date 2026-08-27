/**
 * Neo-Brutalist — bright flat paper, thick black outlines, and hard offset
 * drop-shadows. Blocky saturated buttons "press" into their shadow on hover.
 * A loud, playful, high-contrast take on the link-in-bio.
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

const ID = 'neo-brutalist';

const NEO_IMG =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NDAiIGhlaWdodD0iMzYwIiB2aWV3Qm94PSIwIDAgNjQwIDM2MCI+PHJlY3Qgd2lkdGg9IjY0MCIgaGVpZ2h0PSIzNjAiIGZpbGw9IiNGRkQyM0YiLz48Y2lyY2xlIGN4PSIxOTYiIGN5PSIxODIiIHI9IjEwNCIgZmlsbD0iI0ZGNUM4QSIgc3Ryb2tlPSIjMTExMTExIiBzdHJva2Utd2lkdGg9IjgiLz48cmVjdCB4PSIzMDAiIHk9IjExOCIgd2lkdGg9IjI4NCIgaGVpZ2h0PSIxMjgiIGZpbGw9IiM0Q0M5RjAiIHN0cm9rZT0iIzExMTExMSIgc3Ryb2tlLXdpZHRoPSI4Ii8+PHJlY3QgeD0iMzAwIiB5PSIxMTgiIHdpZHRoPSIyODQiIGhlaWdodD0iMTI4IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTMzMCAyNTAgTDM2MCAyMDAgTDM5MCAyNTAgWiIgZmlsbD0iI0M1RjA0QyIgc3Ryb2tlPSIjMTExMTExIiBzdHJva2Utd2lkdGg9IjgiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48cmVjdCB4PSIxNCIgeT0iMTQiIHdpZHRoPSI2MTIiIGhlaWdodD0iMzMyIiBmaWxsPSJub25lIiBzdHJva2U9IiMxMTExMTEiIHN0cm9rZS13aWR0aD0iMTIiLz48L3N2Zz4=';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-neo-brutalist',
  template: 'neo-brutalist',
  title: 'Rex Vellum — Neo-Brutalist',
  arnsName: 'rex',
  profile: {
    avatar: 'RX',
    displayName: 'Rex Vellum',
    handle: 'rex.ar.io',
    tagline: 'Creative technologist & generative artist',
    bio: 'I build loud little web toys, generative type experiments, and tools that make the browser feel handmade. Currently obsessed with plotters, shaders, and permanent publishing.',
  },
  blocks: [
    { type: 'heading', text: 'Latest drops' },
    { type: 'link', label: 'Portfolio & case studies', url: 'https://example.com/work', icon: '★' },
    { type: 'link', label: 'Generative sketch archive', url: 'https://example.com/sketches', icon: '✳' },
    {
      type: 'link',
      label: 'Read my dev log — on the permaweb',
      url: 'ar://kT4nP8qX2vB9kR7wZ1cJ5sD3hN6fA0gE4uL7iO2YpQx',
      icon: '◈',
    },
    { type: 'link', label: 'Book a studio call', url: 'https://example.com/call', icon: '☎' },
    { type: 'divider' },
    { type: 'heading', text: 'Now showing' },
    {
      type: 'text',
      text: 'Fresh off the plotter: a 200-piece generative poster series. Each print is minted permanently and ships worldwide.',
    },
    { type: 'image', src: NEO_IMG, alt: 'Bold poster from the generative series' },
    { type: 'embed', arweave: 'ar://rexgallery' },
    { type: 'divider' },
    {
      type: 'social',
      items: [
        { platform: 'github', url: 'https://example.com' },
        { platform: 'x', url: 'https://example.com' },
        { platform: 'dribbble', url: 'https://example.com' },
        { platform: 'youtube', url: 'https://example.com' },
      ],
    },
    { type: 'verify', label: 'Permanent on Arweave', url: '#' },
  ],
  theme: {
    colors: { bg: '#FFD23F', surface: '#FFFFFF', text: '#111111', accent: '#FF5C8A' },
    font: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    buttonShape: 'square',
    background: 'flat warm yellow paper with thick black offset frames',
  },
  layout: { headerAlign: 'center', linkStyle: 'button', width: 'standard' },
};

// Rotating saturated button fills — black text reads on every one of them.
const CARD_COLORS = ['#FF5C8A', '#4CC9F0', '#C5F04C', '#B892FF', '#FF9F1C', '#2EE6C6'];

const SVG_LOCK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10" rx="1.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>';

/** First 1–2 letters of a platform name, escaped; a neutral dot when empty. */
function socialInitials(platform: string): string {
  const letters = platform.trim().replace(/[^\p{L}\p{N}]/gu, '');
  const s = letters.slice(0, 2) || '•';
  return escapeHtml(s.toUpperCase());
}

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const paper = cssColor(c.bg, '#FFD23F');
  const card = cssColor(c.surface, '#FFFFFF');
  const ink = cssColor(c.text, '#111111');
  const accent = cssColor(c.accent, '#FF5C8A');
  const font = cssFontFamily(
    def.theme.font,
    'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  );

  const lightVars =
    `--paper:${paper}; --card:${card}; --ink:${ink}; --accent:${accent}; ` +
    `--label:#111111; --muted:#37373b; --shadow:#111111; --frame:#111111;`;

  // Dark mode keeps the brutalist DNA (thick frames, hard offsets) but flips the
  // page to near-black with light frames so the saturated stickers pop.
  const darkVars =
    `--paper:#15151B; --card:#20202A; --ink:#F4F4EC; --accent:#FF5C8A; ` +
    `--label:#111111; --muted:#B9B9C4; --shadow:#000000; --frame:#F4F4EC;`;

  const s = `.pg-${ID}`;
  return `
${s} { ${lightVars}
  color-scheme: light dark;
  min-height: 100vh; color: var(--ink); background-color: var(--paper);
  font-family: ${font}; -webkit-font-smoothing: antialiased;
  padding: clamp(1.25rem, 4vw, 2.5rem) clamp(0.9rem, 4vw, 1.5rem) 3.5rem;
  background-image:
    linear-gradient(0deg, rgba(0,0,0,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px);
  background-size: 28px 28px, 28px 28px;
}
${s} * { box-sizing: border-box; }
@media (prefers-color-scheme: dark) { ${s} { ${darkVars} } }
:root[data-theme="light"] ${s} { ${lightVars} }
:root[data-theme="dark"] ${s} { ${darkVars} }

${s} .pg-wrap { width: 100%; max-width: 40rem; margin: 0 auto; }
${s} .pg-header { text-align: center; margin-bottom: 1.75rem; }
${s} .pg-avatar {
  width: 108px; height: 108px; margin: 0 auto 1.1rem; display: grid; place-items: center;
  background: var(--accent); color: #111111; border: 3px solid var(--frame);
  box-shadow: 6px 6px 0 var(--shadow); overflow: hidden;
  font-size: 2.4rem; font-weight: 800; text-transform: uppercase; letter-spacing: .02em;
}
${s} .pg-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
${s} .pg-name {
  margin: 0 0 .4rem; font-size: clamp(1.8rem, 7vw, 2.6rem); font-weight: 800;
  line-height: 1.02; letter-spacing: -.02em; text-transform: uppercase; word-break: break-word;
}
${s} .pg-tagline {
  display: inline-block; margin: 0 0 .8rem; padding: .18rem .55rem; font-size: .9rem; font-weight: 700;
  background: var(--accent); color: #111111; border: 3px solid var(--frame); box-shadow: 3px 3px 0 var(--shadow);
}
${s} .pg-handle {
  display: inline-flex; align-items: center; gap: .45rem; margin: 0 0 1rem; padding: .3rem .7rem;
  font-size: .82rem; font-weight: 800; letter-spacing: .01em; text-decoration: none;
  color: var(--ink); background: var(--card); border: 3px solid var(--frame); box-shadow: 3px 3px 0 var(--shadow);
  transition: transform .12s ease, box-shadow .12s ease;
}
${s} .pg-handle .pg-dot { width: 9px; height: 9px; background: var(--accent); border: 2px solid var(--frame); flex: 0 0 auto; }
${s} .pg-handle:hover { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--shadow); }
${s} .pg-bio {
  max-width: 32rem; margin: 0 auto; font-size: 1rem; line-height: 1.55; font-weight: 500; color: var(--ink);
}

${s} .pg-links { display: flex; flex-direction: column; gap: 1rem; margin-top: 1.75rem; }
${s} .pg-btn {
  --btn: var(--accent);
  display: flex; align-items: center; gap: .85rem; width: 100%; min-height: 58px;
  padding: 1rem 1.15rem; text-decoration: none; color: var(--label); font-weight: 800; font-size: 1.05rem;
  background: var(--btn); border: 3px solid var(--frame); box-shadow: 6px 6px 0 var(--shadow);
  transition: transform .12s ease, box-shadow .12s ease;
}
${s} .pg-btn .pg-ico {
  flex: 0 0 auto; width: 34px; height: 34px; display: grid; place-items: center; font-size: 1.1rem;
  background: #FFFFFF; color: #111111; border: 3px solid #111111;
}
${s} .pg-btn .pg-txt { flex: 1 1 auto; min-width: 0; word-break: break-word; }
${s} .pg-btn .pg-go { flex: 0 0 auto; font-weight: 900; letter-spacing: .02em; }
${s} .pg-btn.pg-btn--ar .pg-go { font-size: .8rem; }
${s} .pg-btn:hover { transform: translate(3px, 3px); box-shadow: 3px 3px 0 var(--shadow); }
${s} .pg-btn:active { transform: translate(6px, 6px); box-shadow: 0 0 0 var(--shadow); }

${s} .pg-heading {
  display: inline-block; margin: 2rem 0 .25rem; padding: .1rem .1rem; font-size: 1.3rem; font-weight: 800;
  text-transform: uppercase; letter-spacing: -.01em; line-height: 1.1;
  background: linear-gradient(180deg, transparent 62%, var(--accent) 62% 92%, transparent 92%);
  box-decoration-break: clone; -webkit-box-decoration-break: clone;
}
${s} .pg-text { margin: .5rem 0 1rem; font-size: 1rem; line-height: 1.6; font-weight: 500; color: var(--ink); }

${s} .pg-figure { margin: 1.5rem 0; }
${s} .pg-img { display: block; width: 100%; height: auto; border: 3px solid var(--frame); box-shadow: 6px 6px 0 var(--shadow); }

${s} .pg-divider { height: 0; margin: 1.75rem 0; border: 0; border-top: 5px solid var(--frame); }

${s} .pg-social { display: flex; flex-wrap: wrap; gap: .8rem; margin: 1.5rem 0 0; padding: 0; list-style: none; }
${s} .pg-social a {
  width: 52px; height: 52px; display: grid; place-items: center; text-decoration: none;
  font-size: 1.1rem; font-weight: 900; color: var(--ink); background: var(--card);
  border: 3px solid var(--frame); box-shadow: 4px 4px 0 var(--shadow);
  transition: transform .12s ease, box-shadow .12s ease;
}
${s} .pg-social a:hover { transform: translate(2px, 2px); box-shadow: 2px 2px 0 var(--shadow); }

${s} .pg-footer { margin-top: 2.5rem; text-align: center; }
${s} .pg-verify {
  display: inline-flex; align-items: center; gap: .5rem; padding: .5rem .9rem; text-decoration: none;
  font-size: .82rem; font-weight: 800; text-transform: uppercase; letter-spacing: .04em;
  color: #111111; background: #C5F04C; border: 3px solid var(--frame); box-shadow: 4px 4px 0 var(--shadow);
  transition: transform .12s ease, box-shadow .12s ease;
}
${s} .pg-verify svg { width: 15px; height: 15px; display: block; }
${s} .pg-verify:hover { transform: translate(2px, 2px); box-shadow: 2px 2px 0 var(--shadow); }
${s} .pg-made { display: block; margin-top: .9rem; font-size: .72rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }

${s} a:focus-visible { outline: 3px solid var(--frame); outline-offset: 3px; }

@media (prefers-reduced-motion: reduce) {
  ${s} .pg-btn, ${s} .pg-handle, ${s} .pg-social a, ${s} .pg-verify { transition: none; }
  ${s} .pg-btn:hover, ${s} .pg-btn:active, ${s} .pg-handle:hover, ${s} .pg-social a:hover, ${s} .pg-verify:hover { transform: none; }
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
  return `<header class="pg-header">${parts.join('')}</header>`;
}

function renderButton(link: LinkBlock, ctx: RenderCtx, colorIndex: number): string {
  const t = linkTarget(link.url, ctx);
  const color = CARD_COLORS[colorIndex % CARD_COLORS.length];
  const ico = link.icon ? `<span class="pg-ico" aria-hidden="true">${escapeHtml(link.icon)}</span>` : '';
  const cls = t.isAr ? 'pg-btn pg-btn--ar' : 'pg-btn';
  const go = t.isAr ? 'ar://' : '→';
  return (
    `<a class="${cls}" style="--btn:${color}" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    ico +
    `<span class="pg-txt">${escapeHtml(link.label)}</span>` +
    `<span class="pg-go" aria-hidden="true">${go}</span></a>`
  );
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

function renderEmbed(arweave: string, ctx: RenderCtx, colorIndex: number): string {
  const raw = arweave.trim();
  const url = raw.toLowerCase().startsWith('ar://') ? raw : `ar://${raw}`;
  const t = linkTarget(url, ctx);
  const color = CARD_COLORS[colorIndex % CARD_COLORS.length];
  return (
    `<div class="pg-links"><a class="pg-btn pg-btn--ar" style="--btn:${color}" ` +
    `href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    `<span class="pg-ico" aria-hidden="true">◈</span>` +
    `<span class="pg-txt">${escapeHtml(raw)}</span>` +
    `<span class="pg-go" aria-hidden="true">ar://</span></a></div>`
  );
}

function renderFooter(verifyBlock: VerifyBlock | undefined, ctx: RenderCtx): string {
  const v = verifyTarget(verifyBlock, ctx);
  const parts: string[] = [];
  if (v) {
    const label = verifyBlock && verifyBlock.label ? verifyBlock.label : 'Permanent on Arweave';
    parts.push(
      `<a class="pg-verify" href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)}>` +
        `${SVG_LOCK}${escapeHtml(label)}</a>`,
    );
  }
  parts.push(`<span class="pg-made">Built with Neo-Brutalist</span>`);
  return `<footer class="pg-footer">${parts.join('')}</footer>`;
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const blocks = def.blocks;

  let verifyBlock: VerifyBlock | undefined;
  for (const b of blocks) {
    if (b.type === 'verify' && !verifyBlock) verifyBlock = b;
  }

  const out: string[] = [renderHeader(def, ctx)];
  let color = 0; // rotates through CARD_COLORS across every button/embed

  let i = 0;
  while (i < blocks.length) {
    const block: Block = blocks[i];
    if (block.type === 'link') {
      const buttons: string[] = [];
      while (i < blocks.length && blocks[i].type === 'link') {
        buttons.push(renderButton(blocks[i] as LinkBlock, ctx, color));
        color++;
        i++;
      }
      out.push(`<nav class="pg-links" aria-label="Links">${buttons.join('')}</nav>`);
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
        out.push(renderEmbed(block.arweave, ctx, color));
        color++;
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

export const neoBrutalistTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Neo-Brutalist',
    family: 'modern',
    description: 'Bright flat paper, thick black frames, and hard offset shadows that press on hover.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default neoBrutalistTemplate;
