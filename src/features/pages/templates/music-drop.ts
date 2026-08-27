/**
 * Music Drop — a dark, moody artist release page. A large square "cover art"
 * panel is built entirely from CSS (gradient + grain + sheen) with the release
 * title set large across it, followed by the artist name, release notes,
 * streaming-style full-width link rows, a social row and a permalink footer.
 *
 * No external assets: the cover is faux artwork rendered from CSS only.
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
  hexToRgba,
  linkTarget,
  multiline,
  resolveHandle,
  safeImgSrc,
  verifyTarget,
} from './shared';

const ID = 'music-drop';

const DEFAULT_FONT =
  '"Space Grotesk", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, system-ui, sans-serif';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-music-drop',
  template: 'music-drop',
  title: 'Kestrel — Nightglass',
  arnsName: 'kestrel',
  profile: {
    avatar: '',
    displayName: 'Kestrel',
    tagline: 'New single · out everywhere now',
    bio: 'Recorded live to tape in a room with no clocks. Three minutes of dusk. Turn it up.',
    handle: 'kestrel.ar.io',
  },
  blocks: [
    { type: 'heading', text: 'Nightglass' },
    { type: 'text', text: 'Single · 2026 · produced by Kestrel & The Long Room' },
    { type: 'link', label: 'Spotify', url: 'https://example.com/spotify', icon: '♪' },
    { type: 'link', label: 'Apple Music', url: 'https://example.com/apple', icon: '' },
    { type: 'link', label: 'Bandcamp', url: 'https://example.com/bandcamp', icon: '' },
    { type: 'link', label: 'Master on the permaweb', url: 'ar://mT4nP8qX2vB9kR7wZ1cJ5sD3hN6fA0gE4uL7iO2YpQx', icon: '✧' },
    { type: 'heading', text: 'More' },
    { type: 'link', label: 'Tour dates', url: 'https://example.com/tour', icon: '◈' },
    { type: 'divider' },
    {
      type: 'social',
      items: [
        { platform: 'spotify', url: 'https://example.com' },
        { platform: 'instagram', url: 'https://example.com' },
        { platform: 'youtube', url: 'https://example.com' },
        { platform: 'bandcamp', url: 'https://example.com' },
      ],
    },
    { type: 'verify', label: 'Permanent on Arweave', url: '#' },
  ],
  theme: {
    colors: { bg: '#0B0910', surface: '#15111C', text: '#F4EEF7', accent: '#FF4D6D' },
    font: DEFAULT_FONT,
    buttonShape: 'rounded',
    background: 'poster',
  },
  layout: { headerAlign: 'center', linkStyle: 'button', width: 'standard' },
};

// --- Inline social glyphs (static, trusted markup) -----------------------------

const SVG_X =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-7.5 8.6L23.3 22h-6.8l-5.3-6.9L5.1 22H2l8-9.2L1.5 2h7l4.8 6.3L18.9 2Zm-1.2 18h1.9L7.4 4H5.4l12.3 16Z"/></svg>';
const SVG_INSTAGRAM =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>';
const SVG_YOUTUBE =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 12s0-3.4-.4-5a2.5 2.5 0 0 0-1.8-1.8C19.2 4.8 12 4.8 12 4.8s-7.2 0-8.8.4A2.5 2.5 0 0 0 1.4 7C1 8.6 1 12 1 12s0 3.4.4 5a2.5 2.5 0 0 0 1.8 1.8c1.6.4 8.8.4 8.8.4s7.2 0 8.8-.4A2.5 2.5 0 0 0 22.6 17c.4-1.6.4-5 .4-5ZM9.8 15.3V8.7l6.2 3.3-6.2 3.3Z"/></svg>';
const SVG_SPOTIFY =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.4a.75.75 0 0 1-1 .25c-2.8-1.7-6.3-2.1-10.4-1.16a.75.75 0 1 1-.33-1.46c4.5-1 8.4-.55 11.5 1.35.35.22.46.68.23 1.02Zm1.23-2.74a.94.94 0 0 1-1.29.31c-3.2-1.97-8.08-2.54-11.86-1.39a.94.94 0 1 1-.55-1.8c4.32-1.3 9.7-.66 13.38 1.6.44.27.58.85.32 1.28Zm.1-2.85C14.2 8.5 7.98 8.29 4.5 9.35a1.12 1.12 0 1 1-.65-2.15c4-1.22 10.86-.98 15.14 1.57a1.12 1.12 0 1 1-1.15 1.92Z"/></svg>';
const SVG_BANDCAMP =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2 6h16l-4 12H-2z" transform="translate(4 0)"/></svg>';
const SVG_TICK_NOTE =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 17.5a2.5 2.5 0 1 1-2.5-2.5c.55 0 1.06.18 1.5.47V4l10-2v11.5a2.5 2.5 0 1 1-2-2.45V6.3L9 7.8v9.7Z"/></svg>';
const SVG_LOCK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>';
const SVG_PLAY =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>';

function socialGlyph(platform: string): string {
  switch (platform.trim().toLowerCase()) {
    case 'spotify':
      return SVG_SPOTIFY;
    case 'bandcamp':
      return SVG_BANDCAMP;
    case 'x':
    case 'twitter':
      return SVG_X;
    case 'instagram':
    case 'ig':
      return SVG_INSTAGRAM;
    case 'youtube':
    case 'yt':
      return SVG_YOUTUBE;
    default: {
      const ch = (platform.trim()[0] || '•').toUpperCase();
      return `<span class="pg-soc-txt" aria-hidden="true">${escapeHtml(ch)}</span>`;
    }
  }
}

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const accent = cssColor(c.accent, '#FF4D6D');
  const glow = hexToRgba(c.accent, 0.4);
  const wash = hexToRgba(c.accent, 0.16);
  const font = cssFontFamily(def.theme.font, DEFAULT_FONT);

  const darkVars =
    `--accent:${accent}; --glow:${glow}; --wash:${wash}; ` +
    `--bg:#0B0910; --panel:#15111C; --raise:#1D1728; --text:#F4EEF7; --muted:#9E96AC; ` +
    `--border:rgba(255,255,255,.10); --hair:rgba(255,255,255,.07);`;

  const lightVars =
    `--accent:${accent}; --glow:${glow}; --wash:${wash}; ` +
    `--bg:#EFEAF2; --panel:#FFFFFF; --raise:#FBF8FD; --text:#171320; --muted:#5C5568; ` +
    `--border:rgba(23,19,32,.12); --hair:rgba(23,19,32,.08);`;

  return `
:root { color-scheme: light dark; }
.pg-${ID} {
  ${darkVars}
  min-height: 100vh; background:
    radial-gradient(120% 80% at 50% -10%, var(--wash), transparent 60%), var(--bg);
  color: var(--text); font-family: ${font}; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
.pg-${ID} * { box-sizing: border-box; }
:root[data-theme="dark"] .pg-${ID} { ${darkVars} }
@media (prefers-color-scheme: light) { .pg-${ID} { ${lightVars} } }
:root[data-theme="light"] .pg-${ID} { ${lightVars} }
.pg-${ID} .pg-wrap { width: 100%; max-width: 34rem; margin: 0 auto; padding: clamp(1.5rem,5vw,3rem) clamp(1rem,4vw,1.5rem) 3rem; }
.pg-${ID} .pg-cover {
  position: relative; width: 100%; aspect-ratio: 1 / 1; border-radius: 20px; overflow: hidden;
  padding: clamp(1rem,4vw,1.5rem); display: flex; flex-direction: column; justify-content: flex-end;
  border: 1px solid rgba(255,255,255,.08); box-shadow: 0 30px 70px -30px var(--glow), 0 10px 30px -12px rgba(0,0,0,.7);
  background:
    radial-gradient(90% 70% at 78% 12%, var(--accent), transparent 58%),
    radial-gradient(80% 80% at 12% 96%, #2A1550, transparent 60%),
    linear-gradient(155deg, #1a0f2e 0%, #0a0712 70%);
  color: #F7F2FA;
}
.pg-${ID} .pg-cover::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background-image: radial-gradient(rgba(255,255,255,.10) 1px, transparent 1px);
  background-size: 4px 4px; opacity: .5; mix-blend-mode: overlay;
}
.pg-${ID} .pg-cover::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(115deg, rgba(255,255,255,.14) 0%, transparent 34%, transparent 66%, rgba(0,0,0,.28) 100%);
}
.pg-${ID} .pg-badge {
  position: absolute; top: clamp(1rem,4vw,1.5rem); left: clamp(1rem,4vw,1.5rem); z-index: 2;
  display: inline-flex; align-items: center; gap: .4rem; padding: .28rem .6rem; border-radius: 999px;
  font-size: .62rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase;
  color: #fff; background: rgba(0,0,0,.32); border: 1px solid rgba(255,255,255,.24); backdrop-filter: blur(6px);
}
.pg-${ID} .pg-badge .pg-bdot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px var(--accent); }
.pg-${ID} .pg-eq { position: absolute; top: clamp(1rem,4vw,1.5rem); right: clamp(1rem,4vw,1.5rem); z-index: 2; display: flex; align-items: flex-end; gap: 3px; height: 22px; }
.pg-${ID} .pg-eq i { width: 3px; height: 100%; border-radius: 2px; background: var(--accent); transform-origin: bottom; animation: pg-eq-${ID} 1.1s ease-in-out infinite; }
.pg-${ID} .pg-eq i:nth-child(1) { animation-delay: -.9s; }
.pg-${ID} .pg-eq i:nth-child(2) { animation-delay: -.5s; }
.pg-${ID} .pg-eq i:nth-child(3) { animation-delay: -.2s; }
.pg-${ID} .pg-eq i:nth-child(4) { animation-delay: -.7s; }
.pg-${ID} .pg-eq i:nth-child(5) { animation-delay: -.35s; }
@keyframes pg-eq-${ID} { 0%,100% { transform: scaleY(.28); } 50% { transform: scaleY(1); } }
.pg-${ID} .pg-cover-title {
  position: relative; z-index: 2; margin: 0; font-size: clamp(2rem,10vw,3.4rem); font-weight: 800;
  line-height: .98; letter-spacing: -.03em; text-transform: uppercase; word-break: break-word;
  text-shadow: 0 2px 24px rgba(0,0,0,.4);
}
.pg-${ID} .pg-cover-sub { position: relative; z-index: 2; margin: .55rem 0 0; font-size: .8rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.78); }
.pg-${ID} .pg-meta { text-align: center; margin: 1.4rem 0 0; }
.pg-${ID} .pg-artist { display: inline-flex; align-items: center; gap: .5rem; margin: 0; font-size: clamp(1.25rem,4vw,1.6rem); font-weight: 800; letter-spacing: -.01em; }
.pg-${ID} .pg-artist .pg-note-ico { color: var(--accent); display: inline-grid; place-items: center; }
.pg-${ID} .pg-artist .pg-note-ico svg { width: 18px; height: 18px; display: block; }
.pg-${ID} .pg-avatar { width: 44px; height: 44px; border-radius: 50%; overflow: hidden; display: inline-grid; place-items: center; background: var(--raise); color: var(--text); font-weight: 800; font-size: 1rem; text-transform: uppercase; border: 1px solid var(--border); vertical-align: middle; margin-right: .1rem; }
.pg-${ID} .pg-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pg-${ID} .pg-tagline { margin: .55rem auto 0; font-size: .9rem; font-weight: 600; color: var(--accent); }
.pg-${ID} .pg-handle {
  display: inline-flex; align-items: center; gap: .4rem; margin: .8rem auto 0;
  padding: .3rem .8rem; border-radius: 999px; font-size: .76rem; font-weight: 700; color: var(--text);
  text-decoration: none; background: var(--panel); border: 1px solid var(--border);
  transition: border-color .2s ease, color .2s ease, transform .2s ease;
}
.pg-${ID} .pg-handle .pg-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px var(--glow); flex: 0 0 auto; }
.pg-${ID} .pg-handle:hover { transform: translateY(-2px); border-color: var(--accent); color: var(--accent); }
.pg-${ID} .pg-bio { margin: .9rem auto 0; max-width: 30rem; text-align: center; font-size: .92rem; line-height: 1.6; color: var(--muted); }
.pg-${ID} .pg-tracks { display: flex; flex-direction: column; gap: .6rem; margin-top: 1.6rem; }
.pg-${ID} .pg-track {
  position: relative; display: flex; align-items: center; gap: .85rem; min-height: 58px;
  padding: .8rem 1rem; border-radius: 14px; text-decoration: none; color: var(--text); font-weight: 700; font-size: 1rem;
  background: var(--panel); border: 1px solid var(--border);
  transition: transform .2s ease, border-color .2s ease, background .2s ease, box-shadow .2s ease;
}
.pg-${ID} .pg-track:hover { transform: translateY(-2px); border-color: var(--accent); background: var(--raise); box-shadow: 0 12px 30px -18px var(--glow); }
.pg-${ID} .pg-track .pg-play {
  flex: 0 0 auto; width: 38px; height: 38px; display: grid; place-items: center; border-radius: 10px;
  background: var(--wash); color: var(--accent); font-size: 1.05rem;
}
.pg-${ID} .pg-track .pg-play svg { width: 16px; height: 16px; display: block; }
.pg-${ID} .pg-track .pg-tlabel { flex: 1 1 auto; min-width: 0; word-break: break-word; }
.pg-${ID} .pg-track .pg-go { flex: 0 0 auto; color: var(--muted); font-weight: 700; transition: transform .2s ease, color .2s ease; }
.pg-${ID} .pg-track:hover .pg-go { transform: translateX(3px); color: var(--accent); }
.pg-${ID} .pg-track.pg-ar .pg-go { font-size: .68rem; letter-spacing: .05em; }
.pg-${ID} .pg-section {
  display: flex; align-items: center; gap: .7rem; margin: 1.9rem 0 .2rem;
  font-size: .72rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: var(--muted);
}
.pg-${ID} .pg-section::before { content: ""; width: 16px; height: 3px; border-radius: 3px; background: var(--accent); flex: 0 0 auto; box-shadow: 0 0 10px var(--glow); }
.pg-${ID} .pg-section::after { content: ""; flex: 1 1 auto; height: 1px; background: var(--hair); }
.pg-${ID} .pg-note { margin: 1rem auto; max-width: 30rem; text-align: center; font-size: .92rem; line-height: 1.6; color: var(--muted); }
.pg-${ID} .pg-figure { margin: 1.4rem 0 0; }
.pg-${ID} .pg-img { display: block; width: 100%; height: auto; border-radius: 16px; border: 1px solid var(--border); }
.pg-${ID} .pg-divider { height: 1px; border: 0; margin: 1.7rem 0; background: var(--hair); }
.pg-${ID} .pg-social { display: flex; justify-content: center; flex-wrap: wrap; gap: .6rem; margin: 1.4rem 0 0; list-style: none; padding: 0; }
.pg-${ID} .pg-social a {
  width: 46px; height: 46px; display: grid; place-items: center; border-radius: 12px; color: var(--text);
  text-decoration: none; background: var(--panel); border: 1px solid var(--border);
  transition: transform .2s ease, color .2s ease, border-color .2s ease;
}
.pg-${ID} .pg-social a svg { width: 20px; height: 20px; display: block; }
.pg-${ID} .pg-social a .pg-soc-txt { font-size: 1rem; font-weight: 800; line-height: 1; }
.pg-${ID} .pg-social a:hover { transform: translateY(-3px); color: var(--accent); border-color: var(--accent); }
.pg-${ID} .pg-footer { margin-top: 2.25rem; text-align: center; font-size: .78rem; color: var(--muted); }
.pg-${ID} .pg-verify {
  display: inline-flex; align-items: center; gap: .4rem; color: var(--muted); text-decoration: none;
  padding: .3rem .7rem; border-radius: 999px; border: 1px solid transparent; transition: color .2s ease, border-color .2s ease;
}
.pg-${ID} .pg-verify svg { width: 13px; height: 13px; display: block; }
.pg-${ID} .pg-verify:hover { color: var(--accent); border-color: var(--border); }
.pg-${ID} .pg-made { display: block; opacity: .7; margin-top: .55rem; }
.pg-${ID} a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 12px; }
.pg-${ID} .pg-social a:focus-visible, .pg-${ID} .pg-handle:focus-visible, .pg-${ID} .pg-verify:focus-visible { border-radius: 999px; }
@media (prefers-reduced-motion: reduce) {
  .pg-${ID} .pg-eq i { animation: none; transform: scaleY(.6); }
  .pg-${ID} .pg-track, .pg-${ID} .pg-social a, .pg-${ID} .pg-handle, .pg-${ID} .pg-track .pg-go { transition: none; }
  .pg-${ID} .pg-track:hover, .pg-${ID} .pg-social a:hover, .pg-${ID} .pg-handle:hover { transform: none; }
  .pg-${ID} .pg-track:hover .pg-go { transform: none; }
}
`.trim();
}

function renderCover(title: string, subtitle: string): string {
  const sub = subtitle ? `<p class="pg-cover-sub">${escapeHtml(subtitle)}</p>` : '';
  return (
    `<section class="pg-cover" aria-label="Cover art">` +
    `<span class="pg-badge"><span class="pg-bdot" aria-hidden="true"></span>New release</span>` +
    `<div class="pg-eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>` +
    `<h1 class="pg-cover-title">${escapeHtml(title)}</h1>${sub}</section>`
  );
}

function renderMeta(def: PageDef, ctx: RenderCtx): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  const avatarSrc = p.avatar ? safeImgSrc(p.avatar, ctx) : '';
  const avatar = avatarSrc
    ? `<span class="pg-avatar"><img src="${escapeAttr(avatarSrc)}" alt="${escapeAttr(p.displayName)}" loading="lazy" /></span>`
    : `<span class="pg-note-ico" aria-hidden="true">${SVG_TICK_NOTE}</span>`;

  const parts: string[] = [
    `<h2 class="pg-artist">${avatar}${escapeHtml(p.displayName)}</h2>`,
  ];
  if (p.tagline) parts.push(`<p class="pg-tagline">${escapeHtml(p.tagline)}</p>`);
  if (p.bio) parts.push(`<p class="pg-bio">${escapeHtml(p.bio)}</p>`);
  if (handle) {
    parts.push(
      `<div><a class="pg-handle" href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)}>` +
        `<span class="pg-dot" aria-hidden="true"></span>${escapeHtml(handle.text)}</a></div>`,
    );
  }
  return `<div class="pg-meta">${parts.join('')}</div>`;
}

function renderTrack(link: LinkBlock, ctx: RenderCtx): string {
  const t = linkTarget(link.url, ctx);
  const icon = link.icon && link.icon.trim()
    ? `<span aria-hidden="true">${escapeHtml(link.icon)}</span>`
    : SVG_PLAY;
  const cls = t.isAr ? 'pg-track pg-ar' : 'pg-track';
  const go = t.isAr ? 'ar://' : '↗';
  return (
    `<a class="${cls}" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    `<span class="pg-play">${icon}</span>` +
    `<span class="pg-tlabel">${escapeHtml(link.label)}</span>` +
    `<span class="pg-go" aria-hidden="true">${go}</span></a>`
  );
}

function renderTracks(group: LinkBlock[], ctx: RenderCtx): string {
  const rows = group.map((l) => renderTrack(l, ctx)).join('');
  return `<nav class="pg-tracks" aria-label="Listen">${rows}</nav>`;
}

function renderSocial(block: SocialBlock, ctx: RenderCtx): string {
  const items = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      const label = item.platform ? escapeAttr(item.platform) : 'Social link';
      return (
        `<li><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)} aria-label="${label}">` +
        `${socialGlyph(item.platform)}</a></li>`
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
    `<nav class="pg-tracks" aria-label="Listen">` +
    `<a class="pg-track pg-ar" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    `<span class="pg-play"><span aria-hidden="true">✧</span></span>` +
    `<span class="pg-tlabel">${escapeHtml(raw)}</span>` +
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
        `${SVG_LOCK} ${escapeHtml(label)}</a>`,
    );
  }
  parts.push(`<span class="pg-made">Made with Music Drop</span>`);
  return `<p class="pg-footer">${parts.join('')}</p>`;
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const blocks = def.blocks;

  // Pre-scan: the first verify block is the footer; the first heading becomes the
  // release title printed across the cover art. Both are pulled from the flow.
  let verifyBlock: VerifyBlock | undefined;
  let coverHeading: HeadingBlock | undefined;
  for (const b of blocks) {
    if (b.type === 'verify' && !verifyBlock) verifyBlock = b;
    if (b.type === 'heading' && !coverHeading) coverHeading = b;
  }

  const coverTitle =
    (coverHeading && coverHeading.text.trim()) ||
    def.title.trim() ||
    def.profile.displayName.trim() ||
    avatarInitials(def).toUpperCase();

  const out: string[] = [renderCover(coverTitle, ''), renderMeta(def, ctx)];

  let i = 0;
  while (i < blocks.length) {
    const block: Block = blocks[i];
    if (block.type === 'link') {
      const group: LinkBlock[] = [];
      while (i < blocks.length && blocks[i].type === 'link') {
        group.push(blocks[i] as LinkBlock);
        i++;
      }
      out.push(renderTracks(group, ctx));
      continue;
    }
    switch (block.type) {
      case 'heading':
        // The first heading is consumed by the cover; later headings are labels.
        if (block !== coverHeading) {
          out.push(`<h2 class="pg-section">${escapeHtml(block.text)}</h2>`);
        }
        break;
      case 'text':
        out.push(`<p class="pg-note">${multiline(block.text)}</p>`);
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

export const musicDropTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Music Drop',
    family: 'creator',
    description: 'A dark, moody release page — CSS cover art, streaming rows, poster energy.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default musicDropTemplate;
