/**
 * Midnight Tower BBS — near-black amber CRT terminal: ASCII masthead, framed
 * panels, a numbered login menu, a dotted-leader directory, static scanlines and
 * a vignette. Reproduces docs/pages-templates/midnight-tower-bbs.html as a
 * block-driven module.
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

const ID = 'midnight-tower-bbs';

const DEFAULT_FONT =
  '"DejaVu Sans Mono", "Liberation Mono", "Consolas", "Courier New", ui-monospace, SFMono-Regular, Menlo, monospace';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-midnight-tower-bbs',
  template: 'midnight-tower-bbs',
  title: 'Midnight Tower BBS',
  arnsName: 'midnighttower.ar.io',
  profile: {
    avatar: '',
    displayName: 'Midnight Tower BBS',
    tagline: 'Node 1 / 1 · 14.4k · Est. 1994',
    bio: "Welcome back, caller. You have reached MIDNIGHT TOWER, a private board run from a spare 486 in the basement since '94. No warez, no drama, sign the wall on your way out. — The Sysop",
  },
  blocks: [
    { type: 'heading', text: '» CONNECT 14400 «' },
    {
      type: 'text',
      text: "Welcome back, caller. You have reached MIDNIGHT TOWER, a private board run from a spare 486 in the basement since '94. No warez, no drama, sign the wall on your way out.\n— The Sysop",
    },
    { type: 'text', text: 'DIAL · midnighttower.ar.io' },
    { type: 'divider' },
    { type: 'heading', text: 'Main Menu' },
    { type: 'link', label: 'Message Boards & The Wall', url: '#', icon: '1' },
    { type: 'link', label: 'File Libraries / Downloads', url: '#', icon: '2' },
    { type: 'link', label: 'Door Games (LORD, TradeWars)', url: '#', icon: '3' },
    { type: 'link', label: "Sysop's ANSI Art Gallery", url: 'ar://tower-ansi', icon: '4' },
    { type: 'link', label: 'Page the Sysop / Chat', url: '#', icon: '5' },
    { type: 'divider' },
    { type: 'heading', text: 'Elsewhere on the Net' },
    {
      type: 'social',
      items: [
        { platform: 'GitHub', url: 'https://github.com/sysop' },
        { platform: 'Mastodon', url: 'https://bbs.zone/@tower' },
        { platform: 'FidoNet', url: '#' },
        { platform: 'E-Mail', url: 'mailto:sysop@tower.bbs' },
      ],
    },
    { type: 'text', text: 'NO CARRIER — press [SPACE] to redial' },
    {
      type: 'link',
      label: 'Verified Permalink · Permanent on Arweave',
      url: 'ar://n7Qb2Xk9Rm4Tv1Ws8Yp3Hc6Zd0Jf5Ga_Lo-uEiKcPqS',
      icon: 'lock',
    },
  ],
  theme: {
    colors: { bg: '#0A0800', surface: '#141000', text: '#FFB000', accent: '#FFD866' },
    font: DEFAULT_FONT,
    buttonShape: 'square',
    background: 'near-black amber CRT with static scanlines + vignette',
  },
  layout: { headerAlign: 'center', linkStyle: 'button', width: 'standard' },
};

const ASCII =
  ' __  __ ___ ____  _   _ ___ ____ _   _ _____\n' +
  '|  \\/  |_ _|  _ \\| \\ | |_ _/ ___| | | |_   _|\n' +
  '| |\\/| || || | | |  \\| || | |  _| |_| | | |\n' +
  '| |  | || || |_| | |\\  || | |_| |  _  | | |\n' +
  '|_|  |_|___|____/|_| \\_|___\\____|_| |_| |_|\n' +
  '     T O W E R   ::   B B S   S Y S T E M';

const DIVIDER = '════════════════════════════════════════════════════════════';

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const bg = cssColor(c.bg, '#0A0800');
  const surface = cssColor(c.surface, '#141000');
  const text = cssColor(c.text, '#FFB000');
  const accent = cssColor(c.accent, '#FFD866');
  const dim = hexToRgba(c.text, 0.55);
  const glow = hexToRgba(c.text, 0.28);
  const glowHi = hexToRgba(c.text, 0.35);
  const font = cssFontFamily(def.theme.font, DEFAULT_FONT);

  return `
.pg-${ID} {
  --bg: ${bg}; --surface: ${surface}; --text: ${text}; --accent: ${accent};
  --dim: ${dim}; --hi: #FFECC0; --ink: #050400; --shadow: #00000099;
  --glow: ${glow}; --glow-hi: ${glowHi};
  --font: ${font};
  position: relative; min-height: 100vh;
  padding: clamp(14px, 4vw, 40px) clamp(10px, 3vw, 20px);
  background: var(--bg); color: var(--text); font-family: var(--font);
  font-size: 15px; line-height: 1.55; -webkit-text-size-adjust: 100%;
  text-shadow: 0 0 3px var(--glow);
  animation: pg-flicker-${ID} .15s steps(2) infinite;
}
.pg-${ID} * { box-sizing: border-box; }
.pg-${ID} .wrap { max-width: 660px; margin: 0 auto; }
.pg-${ID}::after {
  content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 9;
  background: repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 1px, transparent 1px 3px);
}
.pg-${ID}::before {
  content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 8;
  background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,.55) 100%);
}
.pg-${ID} .frame {
  position: relative; border: 1px solid var(--dim); border-radius: 0;
  background: var(--surface); padding: 18px clamp(12px, 3vw, 22px);
  margin: 0 0 18px; box-shadow: 0 0 0 1px var(--ink) inset, 0 8px 24px var(--shadow);
}
.pg-${ID} .frame::before { content: "\\2554"; position: absolute; top: -2px; left: 2px; color: var(--dim); line-height: 1; }
.pg-${ID} .frame::after { content: "\\255D"; position: absolute; bottom: -2px; right: 2px; color: var(--dim); line-height: 1; }
.pg-${ID} .masthead { overflow-x: auto; text-align: center; margin: 0 0 18px; }
.pg-${ID} .avatar {
  position: relative; width: clamp(72px, 20vw, 96px); aspect-ratio: 1 / 1;
  margin: 0 auto 14px; border: 1px solid var(--dim); background: var(--ink); overflow: hidden;
  box-shadow: 0 0 0 1px var(--ink) inset, 0 0 8px var(--glow-hi);
}
.pg-${ID} .avatar::before { content: "\\2554"; position: absolute; top: -2px; left: 2px; z-index: 1; color: var(--dim); line-height: 1; }
.pg-${ID} .avatar::after { content: "\\255D"; position: absolute; bottom: -2px; right: 2px; z-index: 1; color: var(--dim); line-height: 1; }
.pg-${ID} .avatar img {
  display: block; width: 100%; height: 100%; object-fit: cover;
  filter: sepia(.35) saturate(1.15) contrast(1.05) brightness(.95);
}
.pg-${ID} .ascii {
  display: inline-block; white-space: pre; text-align: left; margin: 0;
  color: var(--text); font-size: clamp(6px, 1.9vw, 11px); line-height: 1.05;
  text-shadow: 0 0 1px var(--text), 0 0 6px var(--glow-hi);
}
.pg-${ID} .tagline {
  text-align: center; color: var(--accent); font-size: .82rem; letter-spacing: .06em;
  margin: 8px 0 0; text-transform: uppercase;
}
.pg-${ID} .node {
  text-align: center; color: var(--dim); font-size: .72rem; letter-spacing: .14em;
  text-transform: uppercase; margin: 4px 0 0;
}
.pg-${ID} .node .arns { color: var(--accent); text-decoration: none; }
.pg-${ID} .node .arns:hover { color: var(--hi); }
.pg-${ID} h2 {
  font-size: .95rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
  color: var(--hi); margin: 0 0 12px;
  text-shadow: 0 0 1px var(--text), 0 0 6px var(--glow-hi);
}
.pg-${ID} p { margin: 0 0 10px; }
.pg-${ID} p:last-child { margin-bottom: 0; }
.pg-${ID} .bio { color: var(--text); }
.pg-${ID} .sig { color: var(--accent); }
.pg-${ID} .divider {
  color: var(--dim); white-space: nowrap; overflow: hidden;
  font-size: .9rem; line-height: 1; margin: 16px 0; user-select: none;
}
.pg-${ID} .menu { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.pg-${ID} .menu a {
  display: flex; align-items: center; gap: 12px; min-height: 44px;
  border: 1px solid var(--dim); border-radius: 0; background: var(--surface);
  color: var(--text); text-decoration: none; padding: 10px 14px;
  font-size: .95rem; transition: background .08s, color .08s;
}
.pg-${ID} .menu a .num { color: var(--accent); font-weight: 700; flex: 0 0 auto; }
.pg-${ID} .menu a .lbl { flex: 1 1 auto; }
.pg-${ID} .menu a .arrow { color: var(--dim); }
.pg-${ID} .menu a .arw { color: var(--dim); font-size: .72rem; letter-spacing: .06em; flex: 0 0 auto; }
.pg-${ID} .menu a:hover, .pg-${ID} .menu a:active { background: var(--text); color: var(--bg); text-shadow: none; }
.pg-${ID} .menu a:hover .num, .pg-${ID} .menu a:hover .arrow, .pg-${ID} .menu a:hover .arw { color: var(--bg); }
.pg-${ID} a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.pg-${ID} .dir { list-style: none; margin: 0; padding: 0; }
.pg-${ID} .dir li { display: flex; align-items: baseline; gap: 6px; min-height: 36px; padding: 3px 0; }
.pg-${ID} .dir a { color: var(--text); text-decoration: none; display: flex; align-items: baseline; gap: 8px; width: 100%; }
.pg-${ID} .dir .plat { color: var(--accent); white-space: nowrap; }
.pg-${ID} .dir .lead { flex: 1 1 auto; border-bottom: 1px dotted var(--dim); transform: translateY(-3px); min-width: 14px; }
.pg-${ID} .dir .val { color: var(--text); white-space: nowrap; }
.pg-${ID} .dir a:hover .val, .pg-${ID} .dir a:hover .plat { color: var(--hi); }
.pg-${ID} .figure { margin: 12px 0; }
.pg-${ID} .figure img { display: block; max-width: 100%; height: auto; border: 1px solid var(--dim); }
.pg-${ID} .cursor { display: inline-block; color: var(--text); animation: pg-blink-${ID} 1.06s steps(1) infinite alternate; }
.pg-${ID} .footer { text-align: center; color: var(--dim); font-size: .78rem; margin-top: 14px; }
.pg-${ID} .verify {
  display: inline-flex; align-items: center; gap: 8px;
  color: var(--dim); text-decoration: none; letter-spacing: .1em; transition: color .08s;
}
.pg-${ID} .verify .lock { color: var(--accent); font-weight: 700; }
.pg-${ID} .verify:hover { color: var(--hi); }
.pg-${ID} .verify:hover .lock { color: var(--hi); }
@keyframes pg-flicker-${ID} { 0% { opacity: .97; } 100% { opacity: 1; } }
@keyframes pg-blink-${ID} { 0% { opacity: 1; } 100% { opacity: 0; } }
@media (prefers-color-scheme: light) {
  .pg-${ID} { text-shadow: 0 0 2px var(--glow); }
  .pg-${ID}::after { background: repeating-linear-gradient(0deg, rgba(0,0,0,.14) 0 1px, transparent 1px 3px); }
  .pg-${ID}::before { background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,.40) 100%); }
}
@media (prefers-reduced-motion: reduce) {
  .pg-${ID} { animation: none; }
  .pg-${ID} .cursor { animation: none; opacity: 1; }
  .pg-${ID} * { transition: none !important; }
}
`.trim();
}

/** A link is treated as the verify permalink when it carries the `lock` icon. */
function isPermalinkLink(block: Block): block is LinkBlock {
  return block.type === 'link' && block.icon === 'lock';
}

const NO_CARRIER = /no carrier/i;

/** Derive a compact directory value from a social url (scheme/host stripped). */
function directoryValue(url: string): string {
  const raw = url.trim();
  if (!raw || raw === '#') return '';
  const mailto = /^mailto:(.+)$/i.exec(raw);
  if (mailto) return mailto[1];
  return raw.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function renderHeader(def: PageDef, ctx: RenderCtx): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  // When a caller uploads a real avatar image, show it as a framed CRT "system
  // photo" above the ASCII masthead; otherwise the masthead stays ASCII-only.
  const avatarSrc = p.avatar ? safeImgSrc(p.avatar, ctx) : '';
  const parts: string[] = [];
  if (avatarSrc) {
    parts.push(
      `<div class="avatar" aria-hidden="true"><img src="${escapeAttr(avatarSrc)}" alt="${escapeAttr(p.displayName)}" loading="lazy" /></div>`,
    );
  }
  parts.push(
    `<pre class="ascii" aria-hidden="true">${ASCII}</pre>`,
    `<h1 style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">${escapeHtml(p.displayName)}</h1>`,
  );
  if (p.tagline) parts.push(`<p class="tagline">${escapeHtml(p.tagline)}</p>`);
  if (handle) {
    parts.push(
      `<p class="node">Dial &middot; ` +
        `<a class="arns" href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)}>${escapeHtml(handle.text)}</a>` +
        `</p>`,
    );
  }
  return `<div class="masthead frame">${parts.join('')}</div>`;
}

function renderText(text: string): string {
  // Split into paragraphs on blank/newlines; a line opening with an em dash is the
  // sysop signature and gets the blinking cursor.
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      if (/^[—-]/.test(line)) {
        return `<p class="sig">${multiline(line)}<span class="cursor" aria-hidden="true">&#9609;</span></p>`;
      }
      return `<p class="bio">${multiline(line)}</p>`;
    })
    .join('');
}

function renderMenu(group: LinkBlock[], ctx: RenderCtx): string {
  const items = group
    .map((link, i) => {
      const t = linkTarget(link.url, ctx);
      const num = escapeHtml(link.icon && link.icon.trim() ? link.icon.trim() : String(i + 1));
      const arw = t.isAr ? `<span class="arw" aria-hidden="true">ar://</span>` : '';
      return (
        `<li><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
        `<span class="num">[${num}]</span>` +
        `<span class="lbl">${escapeHtml(link.label)}</span>` +
        arw +
        `<span class="arrow" aria-hidden="true">&rsaquo;</span>` +
        `</a></li>`
      );
    })
    .join('');
  return `<ul class="menu">${items}</ul>`;
}

function renderSocial(block: SocialBlock, ctx: RenderCtx): string {
  const items = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      const plat = item.platform.trim();
      const badge = plat ? `[${plat.charAt(0).toUpperCase()}] ${plat.toUpperCase()}` : '';
      const val = directoryValue(t.dataAr || item.url);
      return (
        `<li><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
        `<span class="plat">${escapeHtml(badge)}</span>` +
        `<span class="lead" aria-hidden="true"></span>` +
        `<span class="val">${escapeHtml(val)}</span>` +
        `</a></li>`
      );
    })
    .join('');
  return `<ul class="dir">${items}</ul>`;
}

function renderVerify(
  def: PageDef,
  permalink: VerifyBlock | undefined,
  status: string | undefined,
  ctx: RenderCtx,
): string {
  const parts: string[] = [];
  if (status) parts.push(`<p class="footer">${escapeHtml(status)}</p>`);
  const v = verifyTarget(permalink, ctx);
  if (v) {
    const label = permalink && permalink.label ? permalink.label : 'Verified permalink · Permanent on Arweave';
    parts.push(
      `<p class="footer"><a class="verify" href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)}>` +
        `<span class="lock" aria-hidden="true">[&#10003;]</span>${escapeHtml(label)}</a></p>`,
    );
  }
  return parts.join('');
}

interface FrameState {
  open: boolean;
  heading: string;
  buf: string[];
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const blocks = def.blocks;

  // Pre-scan for the verify permalink and the NO CARRIER status line — both are
  // pulled out of the flow and rendered together at the foot of the last frame.
  let permalink: VerifyBlock | undefined;
  let status: string | undefined;
  const consumed = new Set<Block>();
  for (const b of blocks) {
    if (!permalink && b.type === 'verify') {
      permalink = b;
      consumed.add(b);
    } else if (!permalink && isPermalinkLink(b)) {
      permalink = { type: 'verify', label: b.label, url: b.url };
      consumed.add(b);
    } else if (status === undefined && b.type === 'text' && NO_CARRIER.test(b.text)) {
      status = b.text;
      consumed.add(b);
    }
  }

  const out: string[] = [renderHeader(def, ctx)];
  const frame: FrameState = { open: false, heading: '', buf: [] };
  const flush = () => {
    if (!frame.open) return;
    const inner = (frame.heading ? `<h2>${escapeHtml(frame.heading)}</h2>` : '') + frame.buf.join('');
    out.push(`<section class="frame">${inner}</section>`);
    frame.open = false;
    frame.heading = '';
    frame.buf = [];
  };
  const ensure = () => {
    frame.open = true;
  };

  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (consumed.has(block)) {
      i++;
      continue;
    }

    if (block.type === 'link') {
      ensure();
      const group: LinkBlock[] = [];
      while (i < blocks.length && blocks[i].type === 'link' && !consumed.has(blocks[i])) {
        group.push(blocks[i] as LinkBlock);
        i++;
      }
      frame.buf.push(renderMenu(group, ctx));
      continue;
    }

    switch (block.type) {
      case 'heading':
        flush();
        ensure();
        frame.heading = block.text;
        frame.buf.push(`<div class="divider" aria-hidden="true">${DIVIDER}</div>`);
        break;
      case 'divider':
        flush();
        break;
      case 'text':
        ensure();
        frame.buf.push(renderText(block.text));
        break;
      case 'social':
        ensure();
        frame.buf.push(renderSocial(block, ctx));
        break;
      case 'image': {
        const src = safeImgSrc(block.src, ctx);
        if (src) {
          ensure();
          frame.buf.push(
            `<figure class="figure"><img src="${escapeAttr(src)}" alt="${escapeAttr(block.alt || '')}" loading="lazy" /></figure>`,
          );
        }
        break;
      }
      case 'embed': {
        ensure();
        const t = linkTarget(block.arweave, ctx);
        frame.buf.push(
          `<p class="bio"><a class="verify" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>${escapeHtml(block.arweave)}</a></p>`,
        );
        break;
      }
      case 'verify':
        // Handled via the footer pre-scan; a second verify block is ignored.
        break;
    }
    i++;
  }

  const footer = renderVerify(def, permalink, status, ctx);
  if (footer) {
    if (frame.open) {
      frame.buf.push(`<div class="divider" aria-hidden="true">${DIVIDER}</div>`);
      frame.buf.push(footer);
    } else {
      out.push(`<section class="frame">${footer}</section>`);
    }
  }
  flush();

  return `<main class="wrap">${out.join('')}</main>`;
}

export const midnightTowerBbsTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Midnight Tower BBS',
    family: 'classic',
    description: 'Near-black amber CRT terminal: ASCII masthead, login menu, scanlines.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default midnightTowerBbsTemplate;
