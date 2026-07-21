/**
 * Side A — a C-90 mixtape cassette: reels in motion, a printed label plate, and
 * a numbered tracklist for links. Reproduces docs/pages-templates/side-a.html as
 * a block-driven module.
 */

import type {
  Block,
  EmbedBlock,
  ImageBlock,
  LinkBlock,
  PageDef,
  SocialBlock,
  TextBlock,
  VerifyBlock,
} from '../schema';
import type { PagesTemplate, RenderCtx, RenderOutput } from '../render/renderPageHtml';
import { safeHref } from '../render/escape';
import {
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

const ID = 'side-a';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-side-a',
  template: 'side-a',
  title: 'Juno Grey — Side A',
  arnsName: 'junogrey',
  profile: {
    avatar: '',
    displayName: 'Juno Grey',
    tagline: 'Lo-fi soul & midnight tape loops',
    bio: 'Handpicked cuts for the drive home — pressed one dub at a time. Flip the tape when you reach the sea.',
  },
  blocks: [
    { type: 'heading', text: 'Tracklist · Side A' },
    { type: 'link', label: 'Amber — New Single', url: 'https://example.com/listen', icon: 'A1' },
    { type: 'link', label: 'Tour Dates — Fall Run', url: 'https://example.com/tour', icon: 'A2' },
    { type: 'link', label: 'Merch — Cassettes & Tees', url: 'https://example.com/merch', icon: 'A3' },
    { type: 'link', label: 'Full Discography — Permaweb Archive', url: 'ar://junodubs', icon: 'A4' },
    { type: 'link', label: 'Booking & Contact', url: 'https://example.com/contact', icon: 'A5' },
    {
      type: 'social',
      items: [
        { platform: 'Bandcamp', url: 'https://bandcamp.com/junogrey' },
        { platform: 'SoundCloud', url: 'https://soundcloud.com/junogrey' },
        { platform: 'Instagram', url: 'https://instagram.com/junogrey' },
        { platform: 'YouTube', url: 'https://youtube.com/@junogrey' },
      ],
    },
    { type: 'divider' },
    {
      type: 'text',
      text: 'Dolby B NR · Recorded with love in a bedroom studio. No noise reduction on the feelings. © 1986–2026',
    },
    {
      type: 'verify',
      label: 'Permanent on Arweave · verify master',
      url: 'ar://7mNqX2vY8pLkR4tZ0cWb3fH6jD1sA9eUgV5oiByTdMx',
    },
  ],
  theme: {
    colors: { bg: '#241F1C', surface: '#F5E9D0', text: '#F2EAE0', accent: '#E85A3B' },
    font: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Times New Roman", serif',
    buttonShape: 'rounded',
    background: 'cassette-shell',
  },
  layout: { headerAlign: 'center', linkStyle: 'card', width: 'standard' },
};

/** Lighten (amount > 0, toward white) or darken (amount < 0, toward black) a hex. */
function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(String(hex).trim());
  if (!m) return hex;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  let r = parseInt(h.slice(0, 2), 16);
  let g = parseInt(h.slice(2, 4), 16);
  let b = parseInt(h.slice(4, 6), 16);
  if (amount >= 0) {
    r += (255 - r) * amount;
    g += (255 - g) * amount;
    b += (255 - b) * amount;
  } else {
    const k = 1 + amount;
    r *= k;
    g *= k;
    b *= k;
  }
  const cl = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `rgb(${cl(r)}, ${cl(g)}, ${cl(b)})`;
}

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const bg = cssColor(c.bg, '#241F1C');
  const surface = cssColor(c.surface, '#F5E9D0');
  const text = cssColor(c.text, '#F2EAE0');
  const accent = cssColor(c.accent, '#E85A3B');
  const font = cssFontFamily(
    def.theme.font,
    '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
  );

  const shellHi = shade(bg, 0.1);
  const shellLo = shade(bg, -0.18);
  const tapeWin = shade(bg, 0.14);
  const labelStripe = shade(surface, -0.12);
  const ink = shade(surface, -0.72);
  const inkMuted = shade(surface, -0.45);
  const accentDeep = shade(accent, -0.24);
  const page = shade(bg, -0.42);

  return `
:root { color-scheme: light dark; }
.pg-${ID} {
  --shell: ${bg}; --shell-hi: ${shellHi}; --shell-lo: ${shellLo};
  --tape-win: ${tapeWin}; --label: ${surface}; --label-stripe: ${labelStripe};
  --ink: ${ink}; --ink-muted: ${inkMuted}; --text: ${text};
  --accent: ${accent}; --accent-deep: ${accentDeep};
  --page: ${page}; --shell-drop: 0 12px 34px rgba(0, 0, 0, 0.6);
  font-family: ${font};
  background: var(--page); color: var(--text); min-height: 100vh;
  display: flex; justify-content: center; align-items: flex-start;
  padding: 26px 16px 56px; -webkit-font-smoothing: antialiased; line-height: 1.4;
}
.pg-${ID} * { box-sizing: border-box; }
@media (prefers-color-scheme: light) {
  .pg-${ID} { --page: ${surface}; --shell-drop: 0 20px 50px rgba(36, 31, 28, 0.35); }
}
:root[data-theme="dark"] .pg-${ID} { --page: ${page}; --shell-drop: 0 12px 34px rgba(0, 0, 0, 0.6); }
:root[data-theme="light"] .pg-${ID} { --page: ${surface}; --shell-drop: 0 20px 50px rgba(36, 31, 28, 0.35); }
.pg-${ID} .cassette {
  position: relative; width: 100%; max-width: 520px; padding: 18px;
  border-radius: 20px; border: 1px solid rgba(0, 0, 0, 0.45);
  background: linear-gradient(160deg, var(--shell-hi), var(--shell) 14%, var(--shell) 86%, var(--shell-lo));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 -3px 8px rgba(0, 0, 0, 0.55), var(--shell-drop);
}
.pg-${ID} .screw {
  position: absolute; width: 9px; height: 9px; border-radius: 50%;
  background: radial-gradient(circle at 38% 32%, #453b34, #120e0c 75%);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.55), 0 1px 1px rgba(255, 255, 255, 0.04);
}
.pg-${ID} .screw.tl { top: 9px; left: 9px; } .pg-${ID} .screw.tr { top: 9px; right: 9px; }
.pg-${ID} .screw.bl { bottom: 9px; left: 9px; } .pg-${ID} .screw.br { bottom: 9px; right: 9px; }
.pg-${ID} .reels {
  position: relative; display: flex; align-items: center; justify-content: space-between; gap: 14px;
  padding: 18px 22px; margin-bottom: 16px; border-radius: 14px;
  background: radial-gradient(120% 140% at 50% 0%, var(--tape-win), var(--shell-lo));
  box-shadow: inset 0 2px 9px rgba(0, 0, 0, 0.65), inset 0 0 0 1px rgba(0, 0, 0, 0.4);
}
.pg-${ID} .reel {
  flex: none; width: 80px; height: 80px; border-radius: 50%; display: grid; place-items: center;
  background: radial-gradient(circle at 50% 50%, var(--shell-hi) 0 30%, var(--shell) 30% 47%, var(--shell-lo) 47% 100%);
  box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.5), inset 0 2px 7px rgba(0, 0, 0, 0.6);
}
.pg-${ID} .hub {
  width: 44px; height: 44px; border-radius: 50%;
  background: radial-gradient(circle, var(--tape-win) 0 32%, rgba(0, 0, 0, 0) 33%),
    repeating-conic-gradient(var(--label) 0 30deg, var(--label-stripe) 30deg 60deg);
  box-shadow: inset 0 0 0 3px var(--shell-lo), 0 1px 2px rgba(0, 0, 0, 0.5);
  animation: pg-spin-${ID} 3.4s linear infinite;
}
.pg-${ID} .reel.right .hub { animation-duration: 5.1s; }
.pg-${ID} .tape {
  flex: 1; height: 22px; align-self: center; border-radius: 5px;
  background: linear-gradient(180deg, var(--shell-hi), var(--tape-win) 60%, var(--shell-lo));
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.65), inset 0 0 0 1px rgba(0, 0, 0, 0.4);
}
.pg-${ID} .plate {
  position: relative; overflow: hidden; text-align: center; padding: 26px 20px 22px;
  border-radius: 10px; border: 1px solid var(--label-stripe); color: var(--ink);
  background: linear-gradient(180deg, var(--label), var(--label) 55%, var(--label-stripe));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 2px 9px rgba(0, 0, 0, 0.4);
}
.pg-${ID} .plate::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 9px; background: var(--accent-deep); }
.pg-${ID} .plate::after {
  content: ""; position: absolute; left: 0; right: 0; top: 52%; height: 24px; pointer-events: none;
  background: repeating-linear-gradient(180deg, rgba(0, 0, 0, 0) 0 10px, rgba(74, 64, 58, 0.14) 10px 11px);
}
.pg-${ID} .sidetab {
  position: absolute; top: 14px; right: 0; background: var(--accent-deep); color: var(--label);
  font-size: 0.62rem; font-weight: 700; letter-spacing: 0.22em; padding: 4px 12px 4px 14px; border-radius: 20px 0 0 20px;
}
.pg-${ID} .badge {
  display: inline-block; margin-top: 6px; font-size: 0.64rem; font-weight: 700;
  letter-spacing: 0.24em; text-transform: uppercase; color: var(--accent-deep);
}
.pg-${ID} .avatar {
  position: relative; z-index: 1; width: 84px; height: 84px; margin: 0.35em auto 0.1em;
  border-radius: 50%; overflow: hidden; background: var(--label-stripe);
  border: 3px solid var(--accent-deep);
  box-shadow: inset 0 0 0 2px var(--label), 0 2px 9px rgba(0, 0, 0, 0.4);
}
.pg-${ID} .avatar img { display: block; width: 100%; height: 100%; object-fit: cover; }
.pg-${ID} .plate h1 { margin: 0.28em 0 0.12em; font-size: 2rem; font-weight: 700; letter-spacing: 0.01em; color: var(--ink); line-height: 1.1; }
.pg-${ID} .tagline { margin: 0.1em 0 0; font-size: 1.2rem; font-style: italic; color: var(--ink-muted); }
.pg-${ID} .handle {
  position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 0.35em;
  margin: 0.85em 0 0; padding: 4px 12px; border-radius: 20px;
  border: 1px solid var(--label-stripe); background: linear-gradient(180deg, var(--label), var(--label-stripe));
  font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; color: var(--ink);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6); text-decoration: none;
}
.pg-${ID} .handle:hover, .pg-${ID} .handle:focus-visible { border-color: var(--accent-deep); }
.pg-${ID} .handle:focus-visible { outline: 2.5px solid var(--accent-deep); outline-offset: 2px; }
.pg-${ID} .handle .ar-mark { color: var(--accent-deep); letter-spacing: 0.02em; }
.pg-${ID} .bio { position: relative; z-index: 1; margin: 0.9em auto 0; max-width: 34ch; font-size: 0.86rem; color: var(--ink); }
.pg-${ID} .tl-head {
  display: flex; align-items: center; gap: 12px; margin: 22px 4px 12px;
  font-size: 0.72rem; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text);
}
.pg-${ID} .tl-head::after { content: ""; flex: 1; height: 1px; background: var(--text); opacity: 0.22; }
.pg-${ID} ul.tracks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.pg-${ID} .track {
  display: flex; align-items: center; gap: 14px; min-height: 54px; padding: 9px 14px;
  border-radius: 11px; border: 1px solid var(--label-stripe); border-left: 4px solid transparent;
  text-decoration: none; color: var(--ink);
  background: linear-gradient(180deg, var(--label), var(--label-stripe));
  transition: transform 0.13s ease, border-color 0.13s ease, box-shadow 0.13s ease;
}
.pg-${ID} .track:hover { transform: translateX(4px); border-left-color: var(--accent-deep); box-shadow: 0 5px 14px rgba(0, 0, 0, 0.4); }
.pg-${ID} .track:focus-visible { outline: 2.5px solid var(--accent-deep); outline-offset: 2px; border-left-color: var(--accent-deep); }
.pg-${ID} .tnum { flex: none; width: 34px; text-align: center; font-weight: 700; font-size: 0.82rem; letter-spacing: 0.03em; color: var(--accent-deep); }
.pg-${ID} .tbody { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.pg-${ID} .tlabel { font-weight: 600; font-size: 1rem; color: var(--ink); }
.pg-${ID} .tmeta { font-size: 0.78rem; font-style: italic; color: var(--ink); opacity: 0.82; }
.pg-${ID} .tmeta .ar-tag { font-style: normal; font-weight: 700; letter-spacing: 0.04em; color: var(--accent-deep); opacity: 1; }
.pg-${ID} .tdur { flex: none; font-size: 0.8rem; font-variant-numeric: tabular-nums; color: var(--ink); letter-spacing: 0.02em; opacity: 0.75; }
.pg-${ID} .figure { margin: 16px 0 0; }
.pg-${ID} .img { display: block; max-width: 100%; height: auto; border-radius: 11px; border: 1px solid var(--label-stripe); }
.pg-${ID} .rule { border: 0; height: 1px; margin: 16px 8px; background: var(--text); opacity: 0.16; }
.pg-${ID} .socials { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 20px; }
.pg-${ID} .soc {
  width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center;
  text-decoration: none; color: var(--text); font-size: 0.66rem; font-weight: 700; letter-spacing: 0.04em;
  background: radial-gradient(circle at 50% 30%, var(--shell-hi), var(--shell-lo));
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 2px 5px rgba(0, 0, 0, 0.4);
  transition: background 0.13s ease, color 0.13s ease, transform 0.13s ease;
}
.pg-${ID} .soc:hover { background: var(--accent); color: var(--shell); transform: translateY(-2px); }
.pg-${ID} .soc:focus-visible { outline: 2.5px solid var(--accent); outline-offset: 2px; }
.pg-${ID} .liner { margin-top: 24px; text-align: center; color: var(--text); font-size: 0.76rem; line-height: 1.7; }
.pg-${ID} .liner-body { opacity: 0.72; }
.pg-${ID} .dolby { display: inline-flex; align-items: center; gap: 5px; letter-spacing: 0.16em; text-transform: uppercase; font-size: 0.66rem; opacity: 0.72; }
.pg-${ID} .dd { font-weight: 700; letter-spacing: -0.28em; padding-right: 0.28em; color: var(--accent); }
.pg-${ID} .liner hr { border: 0; height: 1px; margin: 12px auto; width: 64px; background: var(--text); opacity: 0.2; }
.pg-${ID} .verify {
  display: inline-flex; align-items: center; gap: 7px; margin-bottom: 8px;
  text-decoration: none; color: var(--text); opacity: 0.78;
  letter-spacing: 0.14em; text-transform: uppercase; font-size: 0.62rem; font-weight: 700;
  border-bottom: 1px dotted var(--text); padding-bottom: 2px;
  transition: color 0.13s ease, border-color 0.13s ease, opacity 0.13s ease;
}
.pg-${ID} .verify:hover, .pg-${ID} .verify:focus-visible { color: var(--accent); border-color: var(--accent); opacity: 1; }
.pg-${ID} .verify:focus-visible { outline: 2.5px solid var(--accent); outline-offset: 3px; }
.pg-${ID} .lock { position: relative; width: 9px; height: 8px; margin-top: 3px; border-radius: 1.5px; background: currentColor; }
.pg-${ID} .lock::before {
  content: ""; position: absolute; left: 1.5px; top: -4.5px; width: 6px; height: 5.5px;
  border: 1.5px solid currentColor; border-bottom: 0; border-radius: 4px 4px 0 0;
}
@keyframes pg-spin-${ID} { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .pg-${ID} * { transition: none !important; animation: none !important; }
  .pg-${ID} .hub { animation: none !important; }
}
`.trim();
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Deterministic decorative run-time for a track, derived from its label. */
function trackDuration(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) {
    h = (h * 31 + label.charCodeAt(i)) >>> 0;
  }
  const min = 2 + (h % 4);
  const sec = h % 60;
  return `${min}:${pad2(sec)}`;
}

/** Two-letter monogram for a social platform (initials of capitalised words, else first two letters). */
function socialMonogram(platform: string): string {
  const caps = platform.replace(/[^A-Za-z]/g, '').match(/[A-Z]/g);
  if (caps && caps.length >= 2) return (caps[0] + caps[1]).toUpperCase();
  const letters = platform.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 2) return letters.slice(0, 2).toUpperCase();
  if (letters.length === 1) return letters.toUpperCase();
  return '·';
}

function renderHeader(def: PageDef, ctx: RenderCtx): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  const avatarSrc = p.avatar ? safeImgSrc(p.avatar, ctx) : '';
  const parts: string[] = [
    `<span class="sidetab" aria-hidden="true">SIDE A</span>`,
    `<span class="badge" aria-hidden="true">C-90 · Mixtape</span>`,
  ];
  if (avatarSrc) {
    parts.push(
      `<div class="avatar"><img src="${escapeAttr(avatarSrc)}" alt="${escapeAttr(p.displayName)}" loading="lazy" /></div>`,
    );
  }
  parts.push(`<h1>${escapeHtml(p.displayName)}</h1>`);
  if (p.tagline) parts.push(`<p class="tagline">${escapeHtml(p.tagline)}</p>`);
  if (handle) {
    parts.push(
      `<a class="handle" href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)}>` +
        `<span class="ar-mark" aria-hidden="true">ar://</span>${escapeHtml(handle.text)}</a>`,
    );
  }
  if (p.bio) parts.push(`<p class="bio">${escapeHtml(p.bio)}</p>`);
  return `<header class="plate">${parts.join('')}</header>`;
}

function renderTrack(link: LinkBlock, index: number, ctx: RenderCtx): string {
  const t = linkTarget(link.url, ctx);
  const num = link.icon && link.icon.trim() ? link.icon : `A${index + 1}`;
  const meta = t.isAr
    ? `<span class="tmeta"><span class="ar-tag" aria-hidden="true">ar://</span> permaweb archive</span>`
    : '';
  return (
    `<li><a class="track" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    `<span class="tnum" aria-hidden="true">${escapeHtml(num)}</span>` +
    `<span class="tbody"><span class="tlabel">${escapeHtml(link.label)}</span>${meta}</span>` +
    `<span class="tdur" aria-hidden="true">${escapeHtml(trackDuration(link.label))}</span>` +
    `</a></li>`
  );
}

function renderTracks(group: LinkBlock[], ctx: RenderCtx): string {
  const items = group.map((link, i) => renderTrack(link, i, ctx)).join('');
  return `<ul class="tracks">${items}</ul>`;
}

function renderEmbed(block: EmbedBlock, ctx: RenderCtx): string {
  const t = linkTarget(block.arweave, ctx);
  const meta = t.isAr
    ? `<span class="tmeta"><span class="ar-tag" aria-hidden="true">ar://</span> permaweb archive</span>`
    : '';
  return (
    `<ul class="tracks"><li><a class="track" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    `<span class="tnum" aria-hidden="true">♪</span>` +
    `<span class="tbody"><span class="tlabel">${escapeHtml(block.arweave)}</span>${meta}</span>` +
    `</a></li></ul>`
  );
}

function renderImage(block: ImageBlock, ctx: RenderCtx): string {
  const src = safeImgSrc(block.src, ctx);
  if (!src) return '';
  return `<figure class="figure"><img class="img" src="${escapeAttr(src)}" alt="${escapeAttr(block.alt || '')}" loading="lazy" /></figure>`;
}

function renderSocial(block: SocialBlock, ctx: RenderCtx): string {
  const chips = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      return (
        `<a class="soc" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}` +
        ` aria-label="${escapeAttr(item.platform)}" title="${escapeAttr(item.platform)}">` +
        `${escapeHtml(socialMonogram(item.platform))}</a>`
      );
    })
    .join('');
  return `<div class="socials">${chips}</div>`;
}

function renderLiner(verifyBlock: VerifyBlock | undefined, texts: TextBlock[], ctx: RenderCtx): string {
  const parts: string[] = [
    `<span class="dolby"><span class="dd" aria-hidden="true">DD</span> Dolby B NR</span>`,
    `<hr>`,
  ];
  const v = verifyTarget(verifyBlock, ctx);
  if (v) {
    const label = verifyBlock ? verifyBlock.label : 'Permanent on Arweave · verify master';
    parts.push(
      `<a class="verify" href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)} rel="noopener">` +
        `<span class="lock" aria-hidden="true"></span>${escapeHtml(label)}</a>`,
    );
  } else if (verifyBlock && verifyBlock.label) {
    parts.push(`<span class="verify"><span class="lock" aria-hidden="true"></span>${escapeHtml(verifyBlock.label)}</span>`);
  }
  if (texts.length > 0) {
    const lines = texts.map((t) => multiline(t.text)).join('<br>');
    parts.push(`<p class="liner-body">${lines}</p>`);
  }
  return `<footer class="liner">${parts.join('')}</footer>`;
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const blocks = def.blocks;
  const main: string[] = [];
  const texts: TextBlock[] = [];
  let verifyBlock: VerifyBlock | undefined;

  let i = 0;
  while (i < blocks.length) {
    const block: Block = blocks[i];
    if (block.type === 'link') {
      const group: LinkBlock[] = [];
      while (i < blocks.length && blocks[i].type === 'link') {
        group.push(blocks[i] as LinkBlock);
        i++;
      }
      main.push(renderTracks(group, ctx));
      continue;
    }
    switch (block.type) {
      case 'heading':
        main.push(`<p class="tl-head">${escapeHtml(block.text)}</p>`);
        break;
      case 'social':
        main.push(renderSocial(block, ctx));
        break;
      case 'image':
        main.push(renderImage(block, ctx));
        break;
      case 'embed':
        main.push(renderEmbed(block, ctx));
        break;
      case 'divider':
        main.push(`<hr class="rule" />`);
        break;
      case 'text':
        texts.push(block);
        break;
      case 'verify':
        if (!verifyBlock) verifyBlock = block;
        break;
    }
    i++;
  }

  const inner: string[] = [
    `<span class="screw tl" aria-hidden="true"></span>`,
    `<span class="screw tr" aria-hidden="true"></span>`,
    `<span class="screw bl" aria-hidden="true"></span>`,
    `<span class="screw br" aria-hidden="true"></span>`,
    `<div class="reels" aria-hidden="true">` +
      `<div class="reel left"><div class="hub"></div></div>` +
      `<div class="tape"></div>` +
      `<div class="reel right"><div class="hub"></div></div>` +
      `</div>`,
    renderHeader(def, ctx),
    `<nav aria-label="Links">${main.join('')}</nav>`,
    renderLiner(verifyBlock, texts, ctx),
  ];

  return `<main class="cassette">${inner.join('')}</main>`;
}

export const sideATemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Side A',
    family: 'wildcard',
    description: 'A C-90 mixtape cassette — spinning reels, a printed label plate, links as a numbered tracklist.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default sideATemplate;
