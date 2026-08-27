/**
 * Trading Card — a permaweb link-in-bio as a collectible holographic card:
 * a rainbow conic-gradient foil border, a framed gradient "portrait" panel with
 * an animated sheen, a type·rarity line, stats-style rows, and links rendered as
 * "ability" rows. Fully self-contained: conic/linear/repeating gradients and
 * solid fills only (no url()), system fonts.
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

const ID = 'trading-card' as unknown as import('../schema').TemplateId;

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-trading-card',
  template: ID,
  title: 'Pixel Vaughn — Trading Card',
  arnsName: 'pixel',
  profile: {
    avatar: '',
    displayName: 'Pixel Vaughn',
    tagline: 'Indie game dev & pixel artist',
    handle: 'pixel.ar.io',
    bio: 'Forged in the 64k demo scene. I build tiny worlds one sprite at a time and mint the good ones forever.',
  },
  blocks: [
    { type: 'heading', text: 'Abilities' },
    { type: 'link', label: 'Play my latest game', url: 'https://example.com/play', icon: '▶' },
    { type: 'link', label: 'Devlog & sprite drops', url: 'https://example.com/devlog', icon: '✎' },
    {
      type: 'link',
      label: 'Source card — on-chain',
      url: 'ar://mT4nP8qX2vB9kR7wZ1cJ5sD3hN6fA0gE4uL7iO2YpQx',
      icon: '◈',
    },
    { type: 'divider' },
    {
      type: 'text',
      text: 'In a market of infinite copies, be the one that is provably first.',
    },
    {
      type: 'social',
      items: [
        { platform: 'twitch', url: 'https://example.com' },
        { platform: 'youtube', url: 'https://example.com' },
        { platform: 'discord', url: 'https://example.com' },
        { platform: 'github', url: 'https://example.com' },
      ],
    },
    { type: 'verify', label: 'Permanent on Arweave', url: '#' },
  ],
  theme: {
    colors: { bg: '#14121F', surface: '#1E1B2E', text: '#F4F1FF', accent: '#8B5CF6' },
    font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    buttonShape: 'rounded',
    background: 'holographic',
  },
  layout: { headerAlign: 'center', linkStyle: 'button', width: 'standard' },
};

const MONO = 'ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const accent = cssColor(c.accent, '#8B5CF6');
  const font = cssFontFamily(
    def.theme.font,
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  );

  return `
:root { color-scheme: light dark; }
.pg-${ID} {
  --bg:#0C0A14; --panel:#181428; --panel-2:#211B36; --ink:#F4F1FF; --muted:#A79FC7;
  --line:rgba(244,241,255,.12); --accent:${accent};
  --foil: conic-gradient(from 0deg, #ff5f8f, #ffcf5f, #5fffc4, #5fb8ff, #b06aff, #ff5f8f);
  min-height: 100vh; margin: 0; padding: clamp(1.5rem,5vw,3rem) 1rem;
  display: flex; align-items: flex-start; justify-content: center;
  color: var(--ink); font-family: ${font}; -webkit-font-smoothing: antialiased;
  background:
    radial-gradient(90% 60% at 50% -10%, rgba(139,92,246,.28), transparent 60%),
    radial-gradient(70% 50% at 100% 100%, rgba(95,184,255,.18), transparent 62%),
    var(--bg);
}
.pg-${ID} * { box-sizing: border-box; }
.pg-${ID} .tc-card {
  position: relative; width: 100%; max-width: 27rem; padding: 5px; border-radius: 22px;
  background: var(--foil); background-size: 200% 200%;
  box-shadow: 0 24px 60px rgba(6,4,16,.6), 0 0 0 1px rgba(255,255,255,.08);
  isolation: isolate;
}
.pg-${ID} .tc-card::before {
  content: ""; position: absolute; inset: 0; border-radius: 22px; z-index: -1;
  background: var(--foil); filter: blur(16px) saturate(1.4); opacity: .5;
  animation: pg-foil-${ID} 8s linear infinite;
}
.pg-${ID} .tc-inner {
  position: relative; border-radius: 18px; padding: 1.35rem 1.25rem 1.4rem; overflow: hidden;
  background:
    radial-gradient(120% 60% at 50% 0%, var(--panel-2), var(--panel) 60%),
    var(--panel);
}
.pg-${ID} .tc-inner::after {
  content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 3;
  background: repeating-linear-gradient(115deg, rgba(255,255,255,.05) 0 8px, rgba(255,255,255,0) 8px 20px);
  mix-blend-mode: overlay; opacity: .5;
}
@keyframes pg-foil-${ID} { 0% { filter: blur(16px) saturate(1.4) hue-rotate(0deg); } 100% { filter: blur(16px) saturate(1.4) hue-rotate(360deg); } }
.pg-${ID} .tc-topbar {
  position: relative; z-index: 2; display: flex; align-items: center; gap: .6rem; margin: 0 0 .9rem;
}
.pg-${ID} .tc-topbar .tc-name { font-size: clamp(1.25rem,5vw,1.55rem); font-weight: 800; letter-spacing: -.01em; line-height: 1.05; }
.pg-${ID} .tc-topbar .tc-hp { margin-left: auto; font-family: ${MONO}; font-size: .72rem; font-weight: 700; letter-spacing: .06em; color: var(--muted); white-space: nowrap; }
.pg-${ID} .tc-topbar .tc-hp b { color: var(--accent); font-size: .95rem; }
.pg-${ID} .tc-portrait {
  position: relative; z-index: 2; height: 172px; border-radius: 14px; overflow: hidden; margin: 0 0 .8rem;
  border: 1px solid rgba(255,255,255,.16);
  background:
    linear-gradient(160deg, var(--accent), #5fb8ff 55%, #5fffc4);
  display: grid; place-items: center;
}
.pg-${ID} .tc-portrait::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(115deg, rgba(255,255,255,.22) 0 7px, rgba(255,255,255,0) 7px 16px);
  mix-blend-mode: overlay; animation: pg-sheen-${ID} 6s ease-in-out infinite alternate;
}
@keyframes pg-sheen-${ID} { 0% { transform: translateX(-14%); } 100% { transform: translateX(14%); } }
.pg-${ID} .tc-portrait .tc-mono {
  position: relative; z-index: 1; font-size: 3.4rem; font-weight: 800; letter-spacing: .02em;
  color: #fff; text-transform: uppercase; text-shadow: 0 3px 12px rgba(0,0,0,.35);
}
.pg-${ID} .tc-portrait img { position: relative; z-index: 1; width: 100%; height: 100%; object-fit: cover; }
.pg-${ID} .tc-typeline {
  position: relative; z-index: 2; display: flex; align-items: center; justify-content: center; gap: .5rem;
  font-family: ${MONO}; font-size: .64rem; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); margin: 0 0 .5rem;
}
.pg-${ID} .tc-typeline b { color: var(--accent); }
.pg-${ID} .tc-typeline .tc-sep { opacity: .5; }
.pg-${ID} .tc-handle {
  position: relative; z-index: 2; display: inline-flex; align-items: center; gap: .4rem; margin: 0 0 .7rem;
  padding: .26rem .65rem; border-radius: 999px; font-family: ${MONO}; font-size: .72rem; font-weight: 600;
  color: var(--ink); text-decoration: none; background: rgba(255,255,255,.05); border: 1px solid var(--line);
  transition: border-color .2s ease, color .2s ease, transform .2s ease;
}
.pg-${ID} .tc-handle .tc-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex: 0 0 auto; box-shadow: 0 0 8px var(--accent); }
.pg-${ID} .tc-handle:hover { color: var(--accent); border-color: var(--accent); transform: translateY(-1px); }
.pg-${ID} .tc-tagline { position: relative; z-index: 2; margin: 0 0 .8rem; font-size: .84rem; font-weight: 600; color: var(--accent); }
.pg-${ID} .tc-stats { position: relative; z-index: 2; display: flex; flex-direction: column; gap: .45rem; margin: 0 0 1rem; }
.pg-${ID} .tc-stat { display: flex; align-items: center; gap: .7rem; font-family: ${MONO}; font-size: .66rem; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.pg-${ID} .tc-stat .tc-slabel { flex: 0 0 5.5rem; }
.pg-${ID} .tc-stat .tc-bar { flex: 1 1 auto; height: 7px; border-radius: 4px; background: rgba(255,255,255,.08); overflow: hidden; }
.pg-${ID} .tc-stat .tc-bar i { display: block; height: 100%; border-radius: 4px; background: linear-gradient(90deg, var(--accent), #5fb8ff); }
.pg-${ID} .tc-stat .tc-sval { flex: 0 0 auto; color: var(--ink); font-weight: 700; }
.pg-${ID} .tc-flavor {
  position: relative; z-index: 2; margin: 0 0 1rem; padding: .7rem .85rem; border-radius: 10px;
  font-size: .85rem; line-height: 1.5; font-style: italic; color: var(--muted);
  background: rgba(255,255,255,.04); border: 1px solid var(--line); border-left: 3px solid var(--accent);
}
.pg-${ID} .tc-section { position: relative; z-index: 2; font-family: ${MONO}; font-size: .62rem; letter-spacing: .2em; text-transform: uppercase; color: var(--muted); margin: 1.1rem 0 .5rem; }
.pg-${ID} .tc-text { position: relative; z-index: 2; margin: .8rem 0; font-size: .88rem; line-height: 1.55; color: var(--muted); }
.pg-${ID} .tc-links { position: relative; z-index: 2; display: flex; flex-direction: column; gap: .55rem; margin: .8rem 0 0; }
.pg-${ID} .tc-ability {
  display: flex; align-items: center; gap: .75rem; min-height: 50px; padding: .55rem .8rem;
  border-radius: 12px; text-decoration: none; color: var(--ink); font-weight: 600; font-size: .95rem;
  background: rgba(255,255,255,.04); border: 1px solid var(--line);
  transition: transform .18s ease, border-color .2s ease, box-shadow .2s ease, background .2s ease;
}
.pg-${ID} .tc-ability .tc-cost {
  flex: 0 0 auto; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 8px;
  background: linear-gradient(160deg, var(--accent), #5fb8ff); color: #fff; font-size: 1rem;
}
.pg-${ID} .tc-ability .tc-aname { flex: 1 1 auto; }
.pg-${ID} .tc-ability .tc-dmg { flex: 0 0 auto; font-family: ${MONO}; font-size: .58rem; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); border: 1px solid var(--line); border-radius: 6px; padding: .16rem .4rem; }
.pg-${ID} .tc-ability:hover { transform: translateY(-2px); border-color: var(--accent); background: rgba(139,92,246,.12); box-shadow: 0 8px 22px rgba(6,4,16,.5); }
.pg-${ID} .tc-ability:hover .tc-dmg { color: var(--accent); border-color: var(--accent); }
.pg-${ID} .tc-figure { position: relative; z-index: 2; margin: .9rem 0 0; }
.pg-${ID} .tc-figure img { display: block; width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--line); }
.pg-${ID} .tc-rule { position: relative; z-index: 2; height: 1px; border: 0; margin: 1.1rem 0; background: repeating-linear-gradient(90deg, var(--line) 0 6px, transparent 6px 12px); }
.pg-${ID} .tc-social { position: relative; z-index: 2; display: flex; flex-wrap: wrap; justify-content: center; gap: .55rem; margin: 1rem 0 0; list-style: none; padding: 0; }
.pg-${ID} .tc-social a {
  width: 42px; height: 42px; display: grid; place-items: center; border-radius: 11px;
  color: var(--ink); text-decoration: none; font-family: ${MONO}; font-weight: 700; font-size: .82rem;
  background: rgba(255,255,255,.05); border: 1px solid var(--line);
  transition: transform .18s ease, border-color .2s ease, color .2s ease;
}
.pg-${ID} .tc-social a:hover { transform: translateY(-2px); color: var(--accent); border-color: var(--accent); }
.pg-${ID} .tc-footer { position: relative; z-index: 2; margin: 1.3rem 0 0; text-align: center; }
.pg-${ID} .tc-verify {
  display: inline-flex; align-items: center; gap: .45rem; text-decoration: none;
  font-family: ${MONO}; font-size: .62rem; letter-spacing: .14em; text-transform: uppercase; color: var(--muted);
  transition: color .2s ease;
}
.pg-${ID} .tc-verify .tc-lock { position: relative; display: inline-block; width: 11px; height: 8px; margin-top: 5px; border-radius: 2px; background: currentColor; }
.pg-${ID} .tc-verify .tc-lock::before { content: ""; position: absolute; left: 50%; top: -6px; transform: translateX(-50%); width: 7px; height: 8px; border: 1.5px solid currentColor; border-bottom: none; border-radius: 6px 6px 0 0; }
.pg-${ID} .tc-verify:hover { color: var(--accent); }
.pg-${ID} .tc-holostamp {
  position: relative; z-index: 2; display: block; margin: .7rem auto 0; width: 2.6rem; height: 2.6rem; border-radius: 50%;
  background: var(--foil); background-size: 180% 180%; opacity: .85;
  box-shadow: inset 0 0 0 2px rgba(255,255,255,.4);
}
.pg-${ID} a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 10px; }
@media (prefers-color-scheme: light) {
  .pg-${ID} { --bg:#EEE9FB; background: radial-gradient(90% 60% at 50% -10%, rgba(139,92,246,.22), transparent 60%), var(--bg); }
}
:root[data-theme="light"] .pg-${ID} { --bg:#EEE9FB; background: radial-gradient(90% 60% at 50% -10%, rgba(139,92,246,.22), transparent 60%), var(--bg); }
@media (prefers-reduced-motion: reduce) {
  .pg-${ID} .tc-card::before, .pg-${ID} .tc-portrait::after { animation: none; }
  .pg-${ID} .tc-ability, .pg-${ID} .tc-social a, .pg-${ID} .tc-handle { transition: none; }
  .pg-${ID} .tc-ability:hover, .pg-${ID} .tc-social a:hover, .pg-${ID} .tc-handle:hover { transform: none; }
}
`.trim();
}

/** Up-to-two-letter uppercase initials for a social platform (falls back to a dot). */
function socialGlyph(platform: string): string {
  const letters = platform.trim().replace(/[^A-Za-z0-9]/g, '');
  if (!letters) return '·';
  const first = letters[0].toUpperCase();
  const second = letters.length > 1 ? letters[1].toLowerCase() : '';
  return `${first}${second}`;
}

const TYPELINE =
  '<p class="tc-typeline" aria-hidden="true">' +
  '<b>Creator Type</b><span class="tc-sep">·</span><span>✦ Holo Rare</span>' +
  '<span class="tc-sep">·</span><span>1 / 1</span></p>';

const STATS =
  '<div class="tc-stats" aria-hidden="true">' +
  '<div class="tc-stat"><span class="tc-slabel">Craft</span><span class="tc-bar"><i style="width:92%"></i></span><span class="tc-sval">92</span></div>' +
  '<div class="tc-stat"><span class="tc-slabel">Output</span><span class="tc-bar"><i style="width:78%"></i></span><span class="tc-sval">78</span></div>' +
  '<div class="tc-stat"><span class="tc-slabel">Permanence</span><span class="tc-bar"><i style="width:100%"></i></span><span class="tc-sval">∞</span></div>' +
  '</div>';

function renderHeader(def: PageDef, ctx: RenderCtx): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  const avatarSrc = p.avatar ? safeImgSrc(p.avatar, ctx) : '';
  const portraitInner = avatarSrc
    ? `<img src="${escapeAttr(avatarSrc)}" alt="${escapeAttr(p.displayName)}" loading="lazy" />`
    : `<span class="tc-mono" aria-hidden="true">${escapeHtml(avatarInitials(def))}</span>`;

  const parts: string[] = [
    '<div class="tc-topbar">' +
      `<span class="tc-name">${escapeHtml(p.displayName)}</span>` +
      '<span class="tc-hp" aria-hidden="true">LV <b>∞</b></span></div>',
    `<div class="tc-portrait" aria-hidden="${avatarSrc ? 'false' : 'true'}">${portraitInner}</div>`,
    TYPELINE,
  ];
  if (handle) {
    parts.push(
      `<a class="tc-handle" href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)} ` +
        `aria-label="${escapeAttr(`ArNS handle: ${handle.text}`)}">` +
        `<span class="tc-dot" aria-hidden="true"></span>${escapeHtml(handle.text)}</a>`,
    );
  }
  if (p.tagline) parts.push(`<p class="tc-tagline">${escapeHtml(p.tagline)}</p>`);
  parts.push(STATS);
  if (p.bio) parts.push(`<p class="tc-flavor">${escapeHtml(p.bio)}</p>`);
  return `<header>${parts.join('')}</header>`;
}

function renderAbility(link: LinkBlock, ctx: RenderCtx): string {
  const t = linkTarget(link.url, ctx);
  const cost = `<span class="tc-cost" aria-hidden="true">${escapeHtml(link.icon || '◆')}</span>`;
  const dmg = t.isAr ? 'ar://' : '→';
  return (
    `<a class="tc-ability" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    cost +
    `<span class="tc-aname">${escapeHtml(link.label)}</span>` +
    `<span class="tc-dmg" aria-hidden="true">${dmg}</span></a>`
  );
}

function renderLinks(group: LinkBlock[], ctx: RenderCtx): string {
  return `<nav class="tc-links" aria-label="Links">${group.map((l) => renderAbility(l, ctx)).join('')}</nav>`;
}

function renderSocial(block: SocialBlock, ctx: RenderCtx): string {
  const items = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      const label = item.platform ? escapeAttr(item.platform) : 'Social link';
      return (
        `<li><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)} aria-label="${label}">` +
        `<span aria-hidden="true">${escapeHtml(socialGlyph(item.platform))}</span></a></li>`
      );
    })
    .join('');
  return `<ul class="tc-social" aria-label="Social links">${items}</ul>`;
}

function renderEmbed(arweave: string, ctx: RenderCtx): string {
  const raw = arweave.trim();
  const url = raw.toLowerCase().startsWith('ar://') ? raw : `ar://${raw}`;
  const t = linkTarget(url, ctx);
  return (
    `<nav class="tc-links" aria-label="Embedded resource">` +
    `<a class="tc-ability" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    `<span class="tc-cost" aria-hidden="true">◈</span>` +
    `<span class="tc-aname">${escapeHtml(raw)}</span>` +
    `<span class="tc-dmg" aria-hidden="true">ar://</span></a></nav>`
  );
}

function renderFooter(verifyBlock: VerifyBlock | undefined, ctx: RenderCtx): string {
  const v = verifyTarget(verifyBlock, ctx);
  const label = verifyBlock && verifyBlock.label ? verifyBlock.label : 'Permanent on Arweave';
  const verify = v
    ? `<a class="tc-verify" href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)}>` +
      `<span class="tc-lock" aria-hidden="true"></span>${escapeHtml(label)}</a>`
    : `<span class="tc-verify"><span class="tc-lock" aria-hidden="true"></span>${escapeHtml(label)}</span>`;
  return `<footer class="tc-footer">${verify}<span class="tc-holostamp" aria-hidden="true"></span></footer>`;
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
        out.push(`<p class="tc-section">${escapeHtml(block.text)}</p>`);
        break;
      case 'text':
        out.push(`<p class="tc-text">${multiline(block.text)}</p>`);
        break;
      case 'divider':
        out.push('<hr class="tc-rule" aria-hidden="true" />');
        break;
      case 'social':
        out.push(renderSocial(block, ctx));
        break;
      case 'image': {
        const src = safeImgSrc(block.src, ctx);
        if (src) {
          out.push(
            `<figure class="tc-figure"><img src="${escapeAttr(src)}" alt="${escapeAttr(block.alt || '')}" loading="lazy" /></figure>`,
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
  return `<main class="tc-card"><div class="tc-inner">${out.join('')}</div></main>`;
}

export const tradingCardTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Trading Card',
    family: 'wildcard',
    description: 'A holographic collectible card — foil border, portrait panel, stats, and abilities as links.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default tradingCardTemplate;
