/**
 * Shell Session — a GitHub-dark terminal window: prompt lines, a typing tagline,
 * ls-style link rows and a verified permalink. Reproduces
 * docs/pages-templates/shell-session.html as a block-driven module.
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
  type LinkTarget,
  multiline,
  resolveHandle,
  safeImgSrc,
  verifyTarget,
} from './shared';

const ID = 'shell-session';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-shell-session',
  template: 'shell-session',
  title: 'jules.ar.io — shell session',
  arnsName: 'jules',
  profile: {
    avatar: '',
    displayName: 'Jules Okonkwo',
    tagline: 'builder of small, fast things',
    bio: 'Backend engineer building distributed systems and permanent infrastructure on the permaweb. I like small tools, fast feedback loops, and databases that refuse to lose data. Currently poking at latency, storage, and the occasional Rust rewrite.',
  },
  blocks: [
    { type: 'heading', text: 'whoami' },
    { type: 'heading', text: 'cat about.md' },
    {
      type: 'text',
      text: 'Backend engineer building distributed systems and permanent infrastructure on the permaweb. I like small tools, fast feedback loops, and databases that refuse to lose data. Currently poking at latency, storage, and the occasional Rust rewrite.',
    },
    { type: 'divider' },
    { type: 'heading', text: 'ls -la ~/links' },
    { type: 'link', label: 'portfolio.dev', url: 'https://jules.dev', icon: '→' },
    { type: 'link', label: 'source ~ github', url: 'https://github.com/julesok', icon: '→' },
    { type: 'link', label: '/log — writing', url: 'https://jules.dev/log', icon: '→' },
    { type: 'link', label: 'notes.ar.io — permaweb mirror', url: 'ar://jules-notes', icon: '→' },
    { type: 'link', label: 'resume.pdf', url: 'https://jules.dev/resume.pdf', icon: '→' },
    { type: 'link', label: 'now', url: 'https://jules.dev/now', icon: '→' },
    { type: 'divider' },
    { type: 'heading', text: 'cat ~/.social' },
    {
      type: 'social',
      items: [
        { platform: 'github', url: 'https://github.com/julesok' },
        { platform: 'mastodon', url: 'https://hachyderm.io/@jules' },
        { platform: 'x', url: 'https://x.com/julesbuilds' },
        { platform: 'linkedin', url: 'https://www.linkedin.com/in/julesok' },
        { platform: 'rss', url: 'https://jules.dev/feed.xml' },
      ],
    },
    { type: 'divider' },
    { type: 'text', text: '# uptime: 7y 42d · load average: curious, caffeinated, online' },
    {
      type: 'verify',
      label: 'permanent on arweave · verify permalink',
      url: 'ar://PmQ8sV2xL9nR4tK7wYc1Bd6Fg0Hj5Ka3Ze_UiOn-Rz2',
    },
  ],
  theme: {
    colors: { bg: '#0D1117', surface: '#161B22', text: '#C9D1D9', accent: '#3FB950' },
    font: 'ui-monospace, "SF Mono", "SFMono-Regular", "Cascadia Code", "Cascadia Mono", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace',
    buttonShape: 'square',
    background: 'terminal-void',
  },
  layout: { headerAlign: 'left', linkStyle: 'button', width: 'standard' },
};

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const bg = cssColor(c.bg, '#0D1117');
  const surface = cssColor(c.surface, '#161B22');
  const text = cssColor(c.text, '#C9D1D9');
  const accent = cssColor(c.accent, '#3FB950');
  const glow = hexToRgba(c.accent, 0.13);
  const font = cssFontFamily(
    def.theme.font,
    'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  );

  return `
.pg-${ID} {
  --bg: ${bg}; --surface: ${surface}; --text: ${text}; --accent: ${accent};
  --void: #010409; --border: #30363D; --border-muted: #21262D;
  --comment: #8B949E; --link: #58A6FF; --bright: #F0F6FC;
  --glow: ${glow}; --sel: #0D419D33;
  --dot-r: #FF5F56; --dot-y: #FFBD2E; --dot-g: #27C93F;
  font-family: ${font};
  background: var(--void);
  color: var(--text);
  min-height: 100vh;
  line-height: 1.6;
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  padding: 16px;
}
.pg-${ID} * { box-sizing: border-box; }
.pg-${ID} ::selection { background: var(--sel); color: var(--bright); }
.pg-${ID} .term {
  width: 100%; max-width: 720px; margin: min(6vh, 52px) auto;
  background: var(--bg); border: 1px solid var(--border); border-radius: 10px;
  overflow: hidden; box-shadow: 0 22px 60px -18px #000000e6, 0 2px 8px -2px #00000099;
}
.pg-${ID} .titlebar {
  display: flex; align-items: center; gap: 10px; padding: 11px 14px;
  background: var(--surface); border-bottom: 1px solid var(--border);
}
.pg-${ID} .dots { display: flex; gap: 8px; flex: 0 0 auto; }
.pg-${ID} .dot { width: 12px; height: 12px; border-radius: 50%; box-shadow: inset 0 0 0 1px #00000033; }
.pg-${ID} .dot.r { background: var(--dot-r); }
.pg-${ID} .dot.y { background: var(--dot-y); }
.pg-${ID} .dot.g { background: var(--dot-g); }
.pg-${ID} .title {
  flex: 1; min-width: 0; text-align: center; color: var(--comment); font-size: 12px;
  letter-spacing: .02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pg-${ID} .title b { color: var(--text); font-weight: 600; }
.pg-${ID} .spacer { flex: 0 0 46px; }
.pg-${ID} .body { padding: 20px 18px 24px; }
@media (min-width: 560px) { .pg-${ID} .body { padding: 26px 26px 28px; } }
.pg-${ID} .cmd { margin: 0; color: var(--bright); font-weight: 400; font-size: 14px; word-break: break-word; }
.pg-${ID} h2.cmd { font-size: 14px; font-weight: 400; }
.pg-${ID} .sec { margin-top: 26px; }
.pg-${ID} .prompt { user-select: none; -webkit-user-select: none; white-space: nowrap; }
.pg-${ID} .prompt .u { color: var(--accent); }
.pg-${ID} .prompt .c { color: var(--comment); }
.pg-${ID} .prompt .path { color: var(--link); }
.pg-${ID} .prompt .d { color: var(--accent); }
.pg-${ID} .avatar {
  width: 72px; height: 72px; margin: 10px 0 4px; border: 1px solid var(--border);
  border-radius: 4px; overflow: hidden; background: var(--surface);
  box-shadow: inset 0 0 0 1px var(--border-muted), 0 0 14px 1px var(--glow);
}
.pg-${ID} .avatar img { display: block; width: 100%; height: 100%; object-fit: cover; }
.pg-${ID} .name { color: var(--bright); font-size: clamp(23px, 7vw, 32px); font-weight: 700; letter-spacing: -.01em; line-height: 1.15; margin: 6px 0 2px; }
.pg-${ID} .tagline-wrap { margin: 0 0 2px; display: flex; align-items: center; }
.pg-${ID} .tagline { display: inline-block; color: var(--text); font-size: 13px; white-space: nowrap; overflow: hidden; width: 30ch; max-width: 100%; }
.pg-${ID} .cursor {
  display: inline-block; width: .62ch; height: 1.05em; flex: 0 0 auto; margin-left: .35ch;
  background: var(--accent); box-shadow: 0 0 8px 1px var(--glow); vertical-align: -2px;
  animation: pg-ss-blink 1.05s steps(1) infinite;
}
@keyframes pg-ss-type { from { width: 0; } to { width: 30ch; } }
@keyframes pg-ss-blink { 50% { opacity: 0; } }
@media (prefers-reduced-motion: no-preference) {
  .pg-${ID} .tagline { width: 0; animation: pg-ss-type 2.1s steps(30) .3s both; }
}
.pg-${ID} .handle { margin: 6px 0 0; font-size: 12.5px; color: var(--comment); display: flex; align-items: center; gap: 6px; }
.pg-${ID} .handle .arr { color: var(--accent); user-select: none; -webkit-user-select: none; }
.pg-${ID} .handle a { color: var(--accent); text-decoration: none; }
.pg-${ID} .handle a:hover { color: var(--link); text-decoration: underline; }
.pg-${ID} .out { margin: 6px 0 0; color: var(--text); max-width: 64ch; }
.pg-${ID} .out.muted { color: var(--comment); font-size: 13px; }
.pg-${ID} .divider {
  margin: 22px 0 4px; color: var(--border); font-size: 13px;
  user-select: none; -webkit-user-select: none; overflow: hidden; white-space: nowrap;
}
.pg-${ID} ul.links { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.pg-${ID} .links a {
  display: flex; align-items: center; gap: 10px; min-height: 46px; padding: 9px 14px;
  border: 1px solid var(--border); border-radius: 4px; background: transparent;
  color: var(--text); text-decoration: none; transition: background .15s ease, border-color .15s ease;
}
.pg-${ID} .links .perm { color: var(--comment); font-size: 12.5px; flex: 0 0 auto; display: none; }
.pg-${ID} .links .arrow { color: var(--accent); flex: 0 0 auto; font-size: 13px; }
.pg-${ID} .links .label { color: var(--bright); font-weight: 600; transition: color .15s ease; }
.pg-${ID} .links .url { margin-left: auto; color: var(--comment); font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40%; text-align: right; }
.pg-${ID} .links a[data-ar] .perm { color: var(--accent); }
.pg-${ID} .links a[data-ar] .url { color: var(--accent); }
@media (min-width: 560px) { .pg-${ID} .links .perm { display: inline; } }
.pg-${ID} .links a:hover { background: var(--surface); border-color: var(--accent); }
.pg-${ID} .links a:hover .label { color: var(--link); }
.pg-${ID} .links a:hover .url { color: var(--link); }
.pg-${ID} ul.social { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.pg-${ID} .social a {
  display: inline-flex; align-items: center; min-height: 44px; padding: 8px 12px;
  border: 1px solid var(--border); border-radius: 4px; color: var(--text); text-decoration: none;
  font-size: 13px; transition: background .15s ease, border-color .15s ease, color .15s ease;
}
.pg-${ID} .social a .b { color: var(--comment); user-select: none; -webkit-user-select: none; }
.pg-${ID} .social a:hover { background: var(--surface); border-color: var(--accent); color: var(--link); }
.pg-${ID} .verify { margin-top: 14px; display: flex; align-items: center; gap: 8px; font-size: 12.5px; flex-wrap: wrap; }
.pg-${ID} .verify .seal { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px 1px var(--glow); flex: 0 0 auto; }
.pg-${ID} .verify .c { color: var(--comment); }
.pg-${ID} .verify a { color: var(--accent); text-decoration: none; white-space: nowrap; }
.pg-${ID} .verify a .txid { color: var(--comment); }
.pg-${ID} .verify a:hover { color: var(--link); text-decoration: underline; }
.pg-${ID} .verify a:hover .txid { color: var(--link); }
.pg-${ID} .tail { margin-top: 24px; color: var(--accent); display: flex; align-items: center; }
.pg-${ID} .figure { margin: 12px 0 0; }
.pg-${ID} .figure img { display: block; max-width: 100%; height: auto; border: 1px solid var(--border); border-radius: 4px; }
.pg-${ID} a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; background: var(--glow); border-radius: 4px; }
@media (prefers-reduced-motion: reduce) {
  .pg-${ID} .tagline { width: auto; animation: none; }
  .pg-${ID} .cursor { animation: none; opacity: 1; }
}
@media (prefers-color-scheme: light) {
  .pg-${ID} .term { border-color: #3d444d; box-shadow: 0 24px 66px -16px #00000055, 0 2px 10px -2px #0000003d; }
}
`.trim();
}

const PROMPT =
  '<span class="prompt" aria-hidden="true">' +
  '<span class="u">visitor@arweave</span><span class="c">:</span>' +
  '<span class="path">~</span> <span class="d">$</span> </span>';

const DIVIDER =
  '<p class="divider" aria-hidden="true"># --------------------------------------------------</p>';

const TAIL = `<p class="cmd tail">${PROMPT}<span class="cursor" aria-hidden="true"></span></p>`;

/** Fake unix permission string — ar:// links read as symlinks, paths as files, plain names as dirs. */
function permFor(label: string, isAr: boolean): string {
  if (isAr) return 'lrwxrwxrwx';
  return /[./]/.test(label) ? '-rw-r--r--' : 'drwxr-xr-x';
}

/** Right-aligned target display: the ar:// intent for symlinks, else the bare host+path. */
function linkUrlDisplay(t: LinkTarget): string {
  if (t.isAr) return t.dataAr;
  const href = t.href;
  if (href === '#' || href.startsWith('#')) return '';
  return href.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

/** Condense a tx id / permalink to `head…tail` for the verify affordance. */
function shortId(source: string): string {
  const stripped = source
    .replace(/^ar:\/\//i, '')
    .replace(/^https?:\/\/[^/]+\//i, '')
    .replace(/\/+$/, '');
  const tail = stripped.split('/').pop() || stripped;
  if (tail.length <= 14) return tail;
  return `${tail.slice(0, 6)}…${tail.slice(-6)}`;
}

function renderHeader(def: PageDef, whoami: string, ctx: RenderCtx): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  const avatarSrc = p.avatar ? safeImgSrc(p.avatar, ctx) : '';
  const parts: string[] = [
    `<p class="cmd">${PROMPT}${escapeHtml(whoami)}</p>`,
  ];
  if (avatarSrc) {
    parts.push(
      `<div class="avatar" aria-hidden="true"><img src="${escapeAttr(avatarSrc)}" alt="" loading="lazy" /></div>`,
    );
  }
  parts.push(`<h1 class="name">${escapeHtml(p.displayName)}</h1>`);
  if (p.tagline) {
    parts.push(
      `<p class="tagline-wrap"><span class="tagline" aria-label="${escapeAttr(p.tagline)}">${escapeHtml(p.tagline)}</span><span class="cursor" aria-hidden="true"></span></p>`,
    );
  }
  if (handle) {
    parts.push(
      `<p class="handle"><span class="arr" aria-hidden="true">↳</span> id: ` +
        `<a href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)}>${escapeHtml(handle.text)}</a></p>`,
    );
  }
  return parts.join('');
}

function renderLinks(group: LinkBlock[], ctx: RenderCtx): string {
  const rows = group
    .map((link) => {
      const t = linkTarget(link.url, ctx);
      const urlDisp = linkUrlDisplay(t);
      const urlSpan = urlDisp ? `<span class="url">${escapeHtml(urlDisp)}</span>` : '';
      return (
        `<li><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
        `<span class="perm" aria-hidden="true">${permFor(link.label, t.isAr)}</span>` +
        `<span class="arrow" aria-hidden="true">→</span>` +
        `<span class="label">${escapeHtml(link.label)}</span>` +
        urlSpan +
        `</a></li>`
      );
    })
    .join('');
  return `<ul class="links">${rows}</ul>`;
}

function renderSocial(block: SocialBlock, ctx: RenderCtx): string {
  const items = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      return (
        `<li><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
        `<span class="b" aria-hidden="true">[&nbsp;</span>${escapeHtml(item.platform)}<span class="b" aria-hidden="true">&nbsp;]</span>` +
        `</a></li>`
      );
    })
    .join('');
  return `<ul class="social" aria-label="Social links">${items}</ul>`;
}

function renderVerify(block: VerifyBlock, ctx: RenderCtx): string {
  const v = verifyTarget(block, ctx);
  const seal = '<span class="seal" aria-hidden="true"></span>';
  if (!v) {
    return `<p class="verify">${seal}<span class="c"># ${escapeHtml(block.label)}</span></p>`;
  }
  const short = shortId(v.dataAr || v.href);
  return (
    `<p class="verify">${seal}<span class="c">#</span> ` +
    `<a href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)} title="Verify this page's transaction on Arweave">` +
    `${escapeHtml(block.label)} ↗ <span class="txid">${escapeHtml(short)}</span></a></p>`
  );
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const blocks = def.blocks;

  // The first heading is the identity command (`whoami`) that introduces the header.
  let start = 0;
  let whoami = 'whoami';
  if (blocks.length > 0 && blocks[0].type === 'heading') {
    whoami = blocks[0].text || 'whoami';
    start = 1;
  }

  const out: string[] = [renderHeader(def, whoami, ctx)];

  let i = start;
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
        out.push(`<h2 class="cmd sec">${PROMPT}${escapeHtml(block.text)}</h2>`);
        break;
      case 'text': {
        const muted = /^\s*#/.test(block.text) ? ' muted' : '';
        out.push(`<p class="out${muted}">${multiline(block.text)}</p>`);
        break;
      }
      case 'divider':
        out.push(DIVIDER);
        break;
      case 'social':
        out.push(renderSocial(block, ctx));
        break;
      case 'verify':
        out.push(renderVerify(block, ctx));
        break;
      case 'image': {
        const src = safeImgSrc(block.src, ctx);
        if (src) {
          out.push(
            `<figure class="figure"><img src="${escapeAttr(src)}" alt="${escapeAttr(block.alt || '')}" loading="lazy" /></figure>`,
          );
        }
        break;
      }
      case 'embed': {
        const t = linkTarget(block.arweave, ctx);
        out.push(
          `<p class="out"><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>${escapeHtml(block.arweave)}</a></p>`,
        );
        break;
      }
    }
    i++;
  }

  out.push(TAIL);

  const handle = resolveHandle(def, ctx);
  const titleName = handle ? handle.text : def.profile.displayName;
  return (
    `<main class="term" role="main" aria-label="${escapeAttr(`Terminal session for ${def.profile.displayName}`)}">` +
    `<div class="titlebar">` +
    `<span class="dots" aria-hidden="true"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></span>` +
    `<span class="title"><b>${escapeHtml(titleName)}</b>: ~ — ssh</span>` +
    `<span class="spacer" aria-hidden="true"></span>` +
    `</div>` +
    `<div class="body">${out.join('')}</div>` +
    `</main>`
  );
}

export const shellSessionTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Shell Session',
    family: 'developer',
    description: 'A GitHub-dark terminal window: prompt lines, ls-style links, a verified permalink.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default shellSessionTemplate;
