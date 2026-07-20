/**
 * Link Classic — the timeless, universal link-in-bio. A centered round avatar,
 * name, short bio, and a calm vertical stack of evenly-spaced rounded buttons,
 * with a small social row beneath. Nothing flashy — just clean and polished.
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

const ID = 'link-classic';

const CLASSIC_IMG =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NDAiIGhlaWdodD0iMzIwIiB2aWV3Qm94PSIwIDAgNjQwIDMyMCI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjRUVGMUZGIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjRjdFREZGIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjY0MCIgaGVpZ2h0PSIzMjAiIHJ4PSIyNCIgZmlsbD0idXJsKCNnKSIvPjxjaXJjbGUgY3g9IjE3NiIgY3k9IjE2MCIgcj0iNzIiIGZpbGw9IiNDN0I4RkYiLz48Y2lyY2xlIGN4PSIxNzYiIGN5PSIxNDAiIHI9IjI2IiBmaWxsPSIjRUZFQUZGIi8+PHBhdGggZD0iTTEzMiAxOTYgcTQ0IC00NCA4OCAwIiBmaWxsPSIjRUZFQUZGIi8+PHJlY3QgeD0iMzAwIiB5PSIxMTgiIHdpZHRoPSIyNDgiIGhlaWdodD0iMjIiIHJ4PSIxMSIgZmlsbD0iI0Q3RENFQyIvPjxyZWN0IHg9IjMwMCIgeT0iMTU4IiB3aWR0aD0iMTk2IiBoZWlnaHQ9IjE2IiByeD0iOCIgZmlsbD0iI0UzRTdGMyIvPjxyZWN0IHg9IjMwMCIgeT0iMTg4IiB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE2IiByeD0iOCIgZmlsbD0iI0U5RUNGNiIvPjwvc3ZnPg==';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-link-classic',
  template: 'link-classic',
  title: 'Sam Rivera — Links',
  arnsName: 'sam',
  profile: {
    avatar: 'SR',
    displayName: 'Sam Rivera',
    handle: 'sam.ar.io',
    tagline: 'Writer, maker & occasional podcaster',
    bio: 'Sharing notes on creativity, small businesses, and building in public. Everything I make lives here — permanently.',
  },
  blocks: [
    { type: 'link', label: 'Read the latest newsletter', url: 'https://example.com/newsletter', icon: '✉' },
    { type: 'link', label: 'Listen to the podcast', url: 'https://example.com/podcast', icon: '▶' },
    { type: 'link', label: 'Shop my favorite gear', url: 'https://example.com/shop', icon: '★' },
    {
      type: 'link',
      label: 'My archive — stored on the permaweb',
      url: 'ar://nP8qX2vB9kR7wZ1cJ5sD3hN6fA0gE4uL7iO2YpQxkT4',
      icon: '❖',
    },
    { type: 'divider' },
    { type: 'heading', text: 'Featured' },
    {
      type: 'text',
      text: 'This month: a short guide on turning a weekend project into a real thing people use.',
    },
    { type: 'image', src: CLASSIC_IMG, alt: 'Featured guide cover' },
    { type: 'embed', arweave: 'ar://samguide' },
    {
      type: 'social',
      items: [
        { platform: 'instagram', url: 'https://example.com' },
        { platform: 'youtube', url: 'https://example.com' },
        { platform: 'x', url: 'https://example.com' },
        { platform: 'tiktok', url: 'https://example.com' },
      ],
    },
    { type: 'verify', label: 'Permanent on Arweave', url: '#' },
  ],
  theme: {
    colors: { bg: '#F6F7FB', surface: '#FFFFFF', text: '#1F2330', accent: '#5B57F0' },
    font: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    buttonShape: 'rounded',
    background: 'calm neutral with a very subtle top gradient',
  },
  layout: { headerAlign: 'center', linkStyle: 'button', width: 'standard' },
};

const SVG_LOCK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>';

/** First 1–2 letters of a platform name, escaped; a neutral dot when empty. */
function socialInitials(platform: string): string {
  const letters = platform.trim().replace(/[^\p{L}\p{N}]/gu, '');
  const s = letters.slice(0, 2) || '•';
  return escapeHtml(s.toUpperCase());
}

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const bg = cssColor(c.bg, '#F6F7FB');
  const surface = cssColor(c.surface, '#FFFFFF');
  const text = cssColor(c.text, '#1F2330');
  const accent = cssColor(c.accent, '#5B57F0');
  const font = cssFontFamily(
    def.theme.font,
    'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  );

  const lightVars =
    `--bg:${bg}; --surface:${surface}; --text:${text}; --accent:${accent}; ` +
    `--muted:#6b7180; --border:rgba(31,35,48,0.12); --border-strong:rgba(31,35,48,0.24); ` +
    `--hover:rgba(31,35,48,0.03); --shadow:rgba(31,35,48,0.07); --tint:rgba(91,87,240,0.10);`;

  // A calm dark counterpart — same restraint, just inverted.
  const darkVars =
    `--bg:#0F1116; --surface:#181B22; --text:#EDEFF5; --accent:#9E9BFF; ` +
    `--muted:#9aa0af; --border:rgba(255,255,255,0.12); --border-strong:rgba(255,255,255,0.26); ` +
    `--hover:rgba(255,255,255,0.05); --shadow:rgba(0,0,0,0.4); --tint:rgba(158,155,255,0.14);`;

  const s = `.pg-${ID}`;
  return `
${s} { ${lightVars}
  color-scheme: light dark;
  min-height: 100vh; color: var(--text);
  background-color: var(--bg);
  background-image: radial-gradient(120% 60% at 50% -10%, var(--tint), transparent 60%);
  font-family: ${font}; -webkit-font-smoothing: antialiased;
  padding: clamp(2rem, 6vw, 3.5rem) clamp(1rem, 5vw, 1.5rem) 3rem;
}
${s} * { box-sizing: border-box; }
@media (prefers-color-scheme: dark) { ${s} { ${darkVars} } }
:root[data-theme="light"] ${s} { ${lightVars} }
:root[data-theme="dark"] ${s} { ${darkVars} }

${s} .pg-wrap { width: 100%; max-width: 34rem; margin: 0 auto; }
${s} .pg-header { text-align: center; margin-bottom: 1.75rem; }
${s} .pg-avatar {
  width: 96px; height: 96px; margin: 0 auto 1.1rem; border-radius: 50%; display: grid; place-items: center;
  background: var(--surface); color: var(--accent); overflow: hidden;
  font-size: 2rem; font-weight: 700; text-transform: uppercase; letter-spacing: .01em;
  border: 1px solid var(--border); box-shadow: 0 6px 20px var(--shadow);
}
${s} .pg-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 50%; }
${s} .pg-name { margin: 0 0 .3rem; font-size: clamp(1.35rem, 5vw, 1.6rem); font-weight: 700; letter-spacing: -.01em; word-break: break-word; }
${s} .pg-handle {
  display: inline-flex; align-items: center; gap: .4rem; margin: 0 0 .75rem; padding: .2rem .6rem;
  font-size: .8rem; font-weight: 600; text-decoration: none; color: var(--accent);
  background: var(--tint); border-radius: 999px;
  transition: background .2s ease;
}
${s} .pg-handle .pg-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex: 0 0 auto; }
${s} .pg-handle:hover { background: var(--border); }
${s} .pg-bio { max-width: 26rem; margin: 0 auto; font-size: .95rem; line-height: 1.55; color: var(--muted); }

${s} .pg-links { display: flex; flex-direction: column; gap: .8rem; margin-top: 1.5rem; }
${s} .pg-btn {
  display: flex; align-items: center; gap: .75rem; width: 100%; min-height: 54px;
  padding: .9rem 1.1rem; text-decoration: none; color: var(--text); font-weight: 600; font-size: 1rem;
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 2px 8px var(--shadow);
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background .18s ease;
}
${s} .pg-btn .pg-ico {
  flex: 0 0 auto; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 9px;
  background: var(--tint); color: var(--accent); font-size: 1rem;
}
${s} .pg-btn .pg-txt { flex: 1 1 auto; min-width: 0; text-align: center; word-break: break-word; }
${s} .pg-btn .pg-ico + .pg-txt { text-align: left; }
${s} .pg-btn .pg-go { flex: 0 0 auto; color: var(--muted); font-weight: 700; transition: transform .18s ease, color .18s ease; }
${s} .pg-btn.pg-btn--ar .pg-go { font-size: .78rem; }
${s} .pg-btn:hover {
  transform: translateY(-2px); border-color: var(--border-strong); background: var(--hover);
  box-shadow: 0 8px 20px var(--shadow);
}
${s} .pg-btn:hover .pg-go { transform: translateX(2px); color: var(--accent); }

${s} .pg-heading { margin: 1.75rem 0 .35rem; font-size: .76rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; text-align: center; color: var(--muted); }
${s} .pg-text { margin: 0 auto 1rem; max-width: 28rem; text-align: center; font-size: .92rem; line-height: 1.55; color: var(--muted); }

${s} .pg-figure { margin: 1.25rem 0; }
${s} .pg-img { display: block; width: 100%; height: auto; border-radius: 16px; border: 1px solid var(--border); box-shadow: 0 4px 16px var(--shadow); }

${s} .pg-divider { height: 0; margin: 1.5rem auto; width: 60%; border: 0; border-top: 1px solid var(--border); }

${s} .pg-social { display: flex; justify-content: center; flex-wrap: wrap; gap: .6rem; margin: 1.5rem 0 0; padding: 0; list-style: none; }
${s} .pg-social a {
  width: 42px; height: 42px; display: grid; place-items: center; text-decoration: none;
  font-size: .9rem; font-weight: 700; color: var(--text); background: var(--surface);
  border: 1px solid var(--border); border-radius: 50%; box-shadow: 0 2px 8px var(--shadow);
  transition: transform .18s ease, color .18s ease, border-color .18s ease;
}
${s} .pg-social a:hover { transform: translateY(-2px); color: var(--accent); border-color: var(--border-strong); }

${s} .pg-footer { margin-top: 2.25rem; text-align: center; }
${s} .pg-verify {
  display: inline-flex; align-items: center; gap: .4rem; padding: .3rem .7rem; text-decoration: none;
  font-size: .78rem; font-weight: 600; color: var(--muted); border-radius: 999px; border: 1px solid transparent;
  transition: color .2s ease, border-color .2s ease, background .2s ease;
}
${s} .pg-verify svg { width: 13px; height: 13px; display: block; opacity: .9; }
${s} .pg-verify:hover { color: var(--accent); border-color: var(--border); background: var(--hover); }
${s} .pg-made { display: block; margin-top: .75rem; font-size: .72rem; color: var(--muted); opacity: .8; }

${s} a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 12px; }
${s} .pg-social a:focus-visible, ${s} .pg-handle:focus-visible, ${s} .pg-verify:focus-visible { border-radius: 999px; }

@media (prefers-reduced-motion: reduce) {
  ${s} .pg-btn, ${s} .pg-social a, ${s} .pg-handle, ${s} .pg-verify, ${s} .pg-btn .pg-go { transition: none; }
  ${s} .pg-btn:hover, ${s} .pg-social a:hover, ${s} .pg-btn:hover .pg-go { transform: none; }
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
  if (handle) {
    parts.push(
      `<a class="pg-handle" href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)}>` +
        `<span class="pg-dot" aria-hidden="true"></span>${escapeHtml(handle.text)}</a>`,
    );
  }
  if (p.tagline) parts.push(`<p class="pg-bio">${escapeHtml(p.tagline)}</p>`);
  if (p.bio) parts.push(`<p class="pg-bio">${escapeHtml(p.bio)}</p>`);
  return `<header class="pg-header">${parts.join('')}</header>`;
}

function renderButton(link: LinkBlock, ctx: RenderCtx): string {
  const t = linkTarget(link.url, ctx);
  const ico = link.icon ? `<span class="pg-ico" aria-hidden="true">${escapeHtml(link.icon)}</span>` : '';
  const cls = t.isAr ? 'pg-btn pg-btn--ar' : 'pg-btn';
  const go = t.isAr ? 'ar://' : '→';
  return (
    `<a class="${cls}" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
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

function renderEmbed(arweave: string, ctx: RenderCtx): string {
  const raw = arweave.trim();
  const url = raw.toLowerCase().startsWith('ar://') ? raw : `ar://${raw}`;
  const t = linkTarget(url, ctx);
  return (
    `<nav class="pg-links" aria-label="Links">` +
    `<a class="pg-btn pg-btn--ar" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    `<span class="pg-ico" aria-hidden="true">❖</span>` +
    `<span class="pg-txt">${escapeHtml(raw)}</span>` +
    `<span class="pg-go" aria-hidden="true">ar://</span></a></nav>`
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
  parts.push(`<span class="pg-made">Made with Link Classic</span>`);
  return `<footer class="pg-footer">${parts.join('')}</footer>`;
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const blocks = def.blocks;

  let verifyBlock: VerifyBlock | undefined;
  for (const b of blocks) {
    if (b.type === 'verify' && !verifyBlock) verifyBlock = b;
  }

  const out: string[] = [renderHeader(def, ctx)];

  let i = 0;
  while (i < blocks.length) {
    const block: Block = blocks[i];
    if (block.type === 'link') {
      const buttons: string[] = [];
      while (i < blocks.length && blocks[i].type === 'link') {
        buttons.push(renderButton(blocks[i] as LinkBlock, ctx));
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

export const linkClassicTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Link Classic',
    family: 'creator',
    description: 'The timeless link-in-bio: round avatar, short bio, and a clean stack of rounded buttons.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default linkClassicTemplate;
