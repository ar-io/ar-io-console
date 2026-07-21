/**
 * Top 8 — mid-2000s social-profile nostalgia: beveled title bars, a boxed
 * profile card with an "Online Now!" badge, a two-up Top 8 friend grid, and a
 * threaded comment wall. Reproduces docs/pages-templates/top-eight.html as a
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

const ID = 'top-eight';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-top-eight',
  template: 'top-eight',
  title: 'xX_JennaStar_Xx — My Profile',
  arnsName: 'jennastar',
  profile: {
    avatar: '',
    displayName: 'xX_JennaStar_Xx',
    handle: 'jennastar.ar.io',
    tagline: '"live fast, blog often" ★ 19 • brooklyn',
    bio: "hey!! ur on my page :) i'm into indie shows, disposable cameras & staying up way too late making playlists. add me, comment me, and check out my band's new demo before it's cool. no drama pls ♡",
  },
  blocks: [
    { type: 'text', text: 'Mood: super stoked :)' },
    { type: 'heading', text: 'About Me' },
    {
      type: 'text',
      text: "hey!! ur on my page :) i'm into indie shows, disposable cameras & staying up way too late making playlists. add me, comment me, and check out my band's new demo before it's cool. no drama pls ♡",
    },
    { type: 'heading', text: 'My URLs' },
    { type: 'link', label: 'My xanga blog', url: '#blog', icon: 'blog' },
    { type: 'link', label: 'Photo bucket (new pics!!)', url: '#photos', icon: 'photo' },
    { type: 'link', label: 'Listen to my band', url: 'ar://jennasband', icon: 'music' },
    { type: 'link', label: 'AIM me: jennastarr06', url: '#im', icon: 'chat' },
    { type: 'divider' },
    { type: 'heading', text: 'My Top 8' },
    {
      type: 'social',
      items: [
        { platform: 'Ashley ♥bff♥', url: '#f1' },
        { platform: 'Marcus', url: '#f2' },
        { platform: '~Destiny~', url: '#f3' },
        { platform: 'Tyler B.', url: '#f4' },
        { platform: 'xBrittanyx', url: '#f5' },
        { platform: 'DJ Kev', url: '#f6' },
        { platform: 'Sam & the guys', url: '#f7' },
        { platform: 'Mom <3', url: '#f8' },
      ],
    },
    { type: 'heading', text: 'Comments' },
    {
      type: 'text',
      text: 'Ashley ♥bff♥ (Jul 14, 2006): omg first!! ur #1 on MY top 8 too obvi. call me after cheer 2nite ♥',
    },
    {
      type: 'text',
      text: 'Marcus (Jul 13, 2006): wait why am i #2 lol. jk jk the new demo goes hard. added u to mine.',
    },
    { type: 'divider' },
    {
      type: 'verify',
      label: 'permanent on arweave',
      url: 'ar://aB3dE7gH1jK4mN6pQ9rS2tU5vW8xY0zC-dF_hJ2lM4n',
    },
  ],
  theme: {
    colors: { bg: '#D5E2F2', surface: '#FFFFFF', text: '#333333', accent: '#003399' },
    font: 'Verdana, Geneva, Tahoma, "DejaVu Sans", sans-serif',
    buttonShape: 'square',
    background: 'radial-gradient sparkle-dot tile over #D5E2F2 base',
  },
  layout: { headerAlign: 'left', linkStyle: 'grid', width: 'standard' },
};

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const bg = cssColor(c.bg, '#D5E2F2');
  const surface = cssColor(c.surface, '#FFFFFF');
  const text = cssColor(c.text, '#333333');
  const accent = cssColor(c.accent, '#003399');
  const border = hexToRgba(c.accent, 0.4);
  const bevel = hexToRgba(c.text, 0.18);
  const muted = hexToRgba(c.text, 0.5);
  const divTop = hexToRgba(c.accent, 0.5);
  const sparkle2 = hexToRgba(c.accent, 0.28);
  const font = cssFontFamily(def.theme.font, 'Verdana, Geneva, Tahoma, "DejaVu Sans", sans-serif');

  const lightVars =
    `--bg:${bg};--surface:${surface};--text:${text};--accent:${accent};--bar:${accent};` +
    `--border:${border};--bevel:${bevel};--muted:${muted};--divTop:${divTop};` +
    `--nameColor:${accent};--artagColor:#fff;--onlineText:#2E7D32;--onlineBg:#F0FAF1;--onlineBorder:#2E7D32;` +
    `--sparkle:rgba(255,255,255,.85);--sparkle2:${sparkle2};`;

  // Dark mode uses a fixed, legible palette (the accent may be too dark to sit on
  // a dark surface), matching the finished sample. The theme accent still tints
  // decorative fills that read on either background.
  const darkVars =
    `--bg:#0A1428;--surface:#14213D;--text:#E6EDF7;--accent:#9DB8F0;--bar:#16308A;` +
    `--border:#3A5BB8;--bevel:#0A1D4D;--muted:#8fa3c4;--divTop:#3A5BB8;` +
    `--nameColor:#C8D8EE;--artagColor:#0A1428;--onlineText:#7FE38C;--onlineBg:#0E2A12;--onlineBorder:#2E7D32;` +
    `--sparkle:rgba(157,184,240,.25);--sparkle2:rgba(58,91,184,.22);`;

  return `
:root { color-scheme: light dark; }
.pg-${ID} * { box-sizing: border-box; }
.pg-${ID} {
  ${lightVars}
  color: var(--text);
  font-family: ${font};
  font-size: 13px; line-height: 1.5; min-height: 100vh; padding: 14px 10px 40px;
  background-color: var(--bg);
  background-image:
    radial-gradient(circle at 3px 3px, var(--sparkle) 0.6px, transparent 1.6px),
    radial-gradient(circle at 11px 9px, var(--sparkle2) 0.6px, transparent 1.6px);
  background-size: 16px 16px, 22px 22px;
}
:root[data-theme="light"] .pg-${ID} { ${lightVars} }
@media (prefers-color-scheme: dark) { .pg-${ID} { ${darkVars} } }
:root[data-theme="dark"] .pg-${ID} { ${darkVars} }

.pg-${ID} .pg-container { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
.pg-${ID} .pg-box { background: var(--surface); border: 1px solid var(--border); box-shadow: 1px 1px 0 var(--bevel); }
.pg-${ID} .pg-box-body { padding: 12px 14px; }
.pg-${ID} .pg-bar {
  background: linear-gradient(180deg, rgba(255,255,255,.20) 0%, rgba(0,0,0,.22) 100%), var(--bar);
  color: #fff; font-weight: bold; font-size: 12px; letter-spacing: .02em; padding: 6px 12px;
  text-shadow: 0 1px 1px rgba(0,0,0,.35); border-bottom: 1px solid rgba(255,255,255,.25);
}

.pg-${ID} .pg-profile-body { display: flex; gap: 14px; padding: 14px; align-items: flex-start; }
.pg-${ID} .pg-avatar {
  flex: 0 0 auto; width: 100px; height: 100px; border: 1px solid var(--accent); position: relative; overflow: hidden;
  background: radial-gradient(circle at 32% 28%, #EAF1FA 0%, #C8D8EE 42%, var(--accent) 100%);
}
.pg-${ID} .pg-avatar::after {
  content: ""; position: absolute; left: 50%; bottom: 0; width: 64px; height: 52px; transform: translateX(-50%);
  background:
    radial-gradient(circle at 50% 30%, rgba(255,255,255,.55) 0 16px, transparent 17px),
    radial-gradient(ellipse at 50% 130%, rgba(255,255,255,.5) 0 26px, transparent 27px);
}
.pg-${ID} .pg-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; position: relative; z-index: 1; }
.pg-${ID} .pg-profile-info { min-width: 0; }
.pg-${ID} .pg-name { margin: 0 0 2px; font-size: 19px; line-height: 1.2; font-weight: bold; color: var(--nameColor); word-break: break-word; }
.pg-${ID} .pg-tagline { margin: 0 0 8px; font-style: italic; color: var(--text); }
.pg-${ID} .pg-handle {
  display: inline-flex; align-items: center; gap: 5px; margin: 0 0 7px;
  font-size: 11px; font-weight: bold; color: var(--nameColor); text-decoration: none; letter-spacing: .01em;
}
.pg-${ID} .pg-handle:hover { text-decoration: underline; }
.pg-${ID} .pg-globe {
  width: 11px; height: 11px; flex: 0 0 auto; border-radius: 50%; border: 1px solid var(--accent);
  background:
    linear-gradient(90deg, transparent 45%, rgba(0,0,0,.25) 46% 54%, transparent 55%),
    radial-gradient(circle at 50% 30%, #EAF1FA 0%, #C8D8EE 55%, var(--accent) 100%);
}
.pg-${ID} .pg-online {
  display: inline-flex; align-items: center; gap: 6px; background: var(--onlineBg); color: var(--onlineText);
  border: 1px solid var(--onlineBorder); font-weight: bold; font-size: 11px; padding: 3px 9px 3px 8px;
}
.pg-${ID} .pg-dot { width: 9px; height: 9px; border-radius: 50%; background: #4CD964; box-shadow: 0 0 0 0 rgba(76,217,100,.6); flex: 0 0 auto; }
.pg-${ID} .pg-mood { margin: 9px 0 0; font-size: 12px; color: var(--text); }
.pg-${ID} .pg-mood b { color: var(--nameColor); }
.pg-${ID} .pg-smiley {
  display: inline-block; vertical-align: -3px; width: 15px; height: 15px; border-radius: 50%; margin-left: 3px; border: 1px solid #C79A00;
  background:
    radial-gradient(circle at 34% 38%, #3a2f00 0 1.4px, transparent 1.7px),
    radial-gradient(circle at 66% 38%, #3a2f00 0 1.4px, transparent 1.7px),
    radial-gradient(circle at 50% 92%, transparent 0 4.4px, #8a6d00 4.4px 5.4px, transparent 5.5px),
    radial-gradient(circle at 50% 40%, #FFE45C 0%, #FFD21A 70%, #E9B800 100%);
}

.pg-${ID} a { color: var(--accent); text-decoration: underline; }
.pg-${ID} .pg-links { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; }
.pg-${ID} .pg-links a { display: inline-flex; align-items: center; gap: 8px; font-weight: bold; min-height: 22px; }
.pg-${ID} .pg-ic {
  width: 14px; height: 14px; flex: 0 0 auto; display: inline-block;
  background: linear-gradient(180deg, rgba(255,255,255,.4), rgba(0,0,0,.28)), var(--accent); border: 1px solid rgba(0,0,0,.5);
}
.pg-${ID} .pg-artag {
  font-size: 9px; font-weight: bold; color: var(--artagColor); background: var(--accent);
  padding: 1px 4px; border: 1px solid rgba(0,0,0,.5); letter-spacing: .03em; margin-left: 6px; text-decoration: none; line-height: 1.4;
}

.pg-${ID} .pg-divider { height: 0; margin: 2px 0; border-top: 1px solid var(--divTop); border-bottom: 1px solid var(--surface); }

.pg-${ID} .pg-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.pg-${ID} .pg-card { margin: 0; }
.pg-${ID} .pg-card a { display: block; text-decoration: none; color: inherit; border: 1px solid var(--border); background: var(--surface); min-height: 44px; transition: box-shadow 120ms ease; }
.pg-${ID} .pg-card a:hover, .pg-${ID} .pg-card a:focus-visible { box-shadow: inset 0 0 0 2px var(--accent); outline: none; }
.pg-${ID} .pg-card-av { display: block; width: 100%; aspect-ratio: 1 / 1; background: radial-gradient(circle at 35% 30%, #EAF1FA 0%, #C8D8EE 45%, var(--accent) 100%); }
.pg-${ID} .pg-card-name { display: block; background: var(--bar); color: #fff; font-weight: bold; font-size: 11px; padding: 4px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.pg-${ID} .pg-comment { display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px dotted var(--bevel); }
.pg-${ID} .pg-comment:last-child { border-bottom: 0; }
.pg-${ID} .pg-c-av { flex: 0 0 auto; width: 42px; height: 42px; border: 1px solid var(--accent); background: radial-gradient(circle at 35% 30%, #EAF1FA 0%, #C8D8EE 45%, var(--accent) 100%); }
.pg-${ID} .pg-c-body { min-width: 0; }
.pg-${ID} .pg-c-name { font-weight: bold; color: var(--nameColor); }
.pg-${ID} .pg-c-date { color: var(--muted); font-size: 10px; margin-left: 4px; }
.pg-${ID} .pg-c-text { margin: 3px 0 0; }

.pg-${ID} .pg-prose { margin: 0; }
.pg-${ID} .pg-figure { margin: 0; }
.pg-${ID} .pg-img { display: block; max-width: 100%; height: auto; border: 1px solid var(--border); }

.pg-${ID} .pg-foot { text-align: center; font-size: 10px; color: var(--muted); padding: 4px 0 0; line-height: 1.7; }
.pg-${ID} .pg-perma { display: inline-flex; align-items: center; gap: 5px; color: var(--muted); text-decoration: none; font-weight: bold; }
.pg-${ID} .pg-perma:hover { color: var(--accent); text-decoration: underline; }
.pg-${ID} .pg-lock { width: 9px; height: 8px; flex: 0 0 auto; border: 1px solid currentColor; border-radius: 1px; position: relative; }
.pg-${ID} .pg-lock::before { content: ""; position: absolute; left: 50%; top: -4px; width: 6px; height: 5px; border: 1px solid currentColor; border-bottom: 0; border-radius: 5px 5px 0 0; transform: translateX(-50%); }

.pg-${ID} a:focus-visible, .pg-${ID} .pg-card a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

@media (prefers-reduced-motion: no-preference) {
  .pg-${ID} .pg-dot { animation: pgOnlinePulse-${ID} 1.6s ease-out infinite; }
}
@keyframes pgOnlinePulse-${ID} {
  0% { box-shadow: 0 0 0 0 rgba(76,217,100,.6); }
  70% { box-shadow: 0 0 0 7px rgba(76,217,100,0); }
  100% { box-shadow: 0 0 0 0 rgba(76,217,100,0); }
}
@media (prefers-reduced-motion: reduce) {
  .pg-${ID} .pg-card a { transition: none; }
  .pg-${ID} .pg-dot { animation: none; }
}
`.trim();
}

const MOOD_RE = /^\s*mood\s*:\s*([\s\S]*)$/i;
const COMMENT_RE = /^([\s\S]*?)\s*\(([^()]*)\)\s*:\s*([\s\S]+)$/;
const SMILEY_RE = /\s*:-?\)\s*$/;

/** Header/profile card, built from the profile plus an optional pre-scanned mood. */
function renderProfileBox(def: PageDef, ctx: RenderCtx, moodText: string | undefined): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  const avSrc = p.avatar ? safeImgSrc(p.avatar, ctx) : '';
  const avatar = avSrc
    ? `<div class="pg-avatar"><img src="${escapeAttr(avSrc)}" alt="${escapeAttr(`Profile photo of ${p.displayName}`)}" loading="lazy" /></div>`
    : `<div class="pg-avatar" role="img" aria-label="Profile photo placeholder"></div>`;

  const info: string[] = [`<h1 class="pg-name">${escapeHtml(p.displayName)}</h1>`];
  if (handle) {
    info.push(
      `<a class="pg-handle" href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)}>` +
        `<span class="pg-globe" aria-hidden="true"></span>${escapeHtml(handle.text)}</a>`,
    );
  }
  if (p.tagline) info.push(`<p class="pg-tagline">${escapeHtml(p.tagline)}</p>`);
  info.push(`<span class="pg-online"><span class="pg-dot" aria-hidden="true"></span>Online Now!</span>`);
  if (moodText) info.push(renderMood(moodText));

  const bar = `<div class="pg-bar">${escapeHtml(p.displayName)} — My Profile</div>`;
  return (
    `<div class="pg-box">${bar}<div class="pg-profile-body">${avatar}` +
    `<div class="pg-profile-info">${info.join('')}</div></div></div>`
  );
}

function renderMood(text: string): string {
  const m = MOOD_RE.exec(text);
  let rest = (m ? m[1] : text).trim();
  let smiley = '';
  const sm = SMILEY_RE.exec(rest);
  if (sm) {
    rest = rest.slice(0, sm.index).trim();
    smiley = '<span class="pg-smiley" aria-hidden="true"></span>';
  }
  return `<p class="pg-mood"><b>Mood:</b> ${escapeHtml(rest)}${smiley}</p>`;
}

/** A run of consecutive links becomes the boxed "My URLs" list. */
function renderLinks(group: LinkBlock[], ctx: RenderCtx): string {
  const items = group
    .map((link) => {
      const t = linkTarget(link.url, ctx);
      const ar = t.isAr ? `<span class="pg-artag" aria-hidden="true">ar://</span>` : '';
      return (
        `<li><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
        `<span class="pg-ic" aria-hidden="true"></span>${escapeHtml(link.label)}${ar}</a></li>`
      );
    })
    .join('');
  return `<ul class="pg-links">${items}</ul>`;
}

/** A social block becomes the two-up "Top 8" friend grid. */
function renderGrid(block: SocialBlock, ctx: RenderCtx): string {
  const cards = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      return (
        `<li class="pg-card"><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
        `<span class="pg-card-av" aria-hidden="true"></span>` +
        `<span class="pg-card-name">${escapeHtml(item.platform)}</span></a></li>`
      );
    })
    .join('');
  return `<ul class="pg-grid">${cards}</ul>`;
}

/** A text block renders as a threaded comment ("Name (date): body") or plain prose. */
function renderText(text: string): string {
  const c = COMMENT_RE.exec(text);
  if (c && c[1].trim()) {
    return (
      `<div class="pg-comment"><div class="pg-c-av" aria-hidden="true"></div>` +
      `<div class="pg-c-body">` +
      `<span class="pg-c-name">${escapeHtml(c[1].trim())}</span>` +
      `<span class="pg-c-date">${escapeHtml(c[2].trim())}</span>` +
      `<p class="pg-c-text">${multiline(c[3].trim())}</p></div></div>`
    );
  }
  return `<p class="pg-prose">${multiline(text)}</p>`;
}

function renderFooter(def: PageDef, verify: VerifyBlock | undefined, ctx: RenderCtx): string {
  const name = escapeHtml(def.profile.displayName);
  const line1 = `© 2006 ${name} • best viewed at 1024×768 • a/s/l?`;
  const v = verifyTarget(verify, ctx);
  let link = '';
  if (v) {
    const label = verify ? verify.label : 'permanent on arweave · verified permalink';
    link =
      `<br><a class="pg-perma" href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)}>` +
      `<span class="pg-lock" aria-hidden="true"></span>${escapeHtml(label)}</a>`;
  }
  return `<p class="pg-foot">${line1}${link}</p>`;
}

interface BoxState {
  open: boolean;
  heading: string;
  buf: string[];
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const blocks = def.blocks;

  // Pre-scan chrome pulled out of the normal flow: the profile mood line and the
  // verify permalink (rendered in the header and footer respectively).
  let moodText: string | undefined;
  let verifyBlock: VerifyBlock | undefined;
  const consumed = new Set<Block>();
  for (const b of blocks) {
    if (b.type === 'text' && moodText === undefined && MOOD_RE.test(b.text)) {
      moodText = b.text;
      consumed.add(b);
    } else if (b.type === 'verify' && !verifyBlock) {
      verifyBlock = b;
      consumed.add(b);
    }
  }

  const out: string[] = [renderProfileBox(def, ctx, moodText)];

  const box: BoxState = { open: false, heading: '', buf: [] };
  const flush = () => {
    if (!box.open) return;
    const bar = box.heading ? `<div class="pg-bar">${escapeHtml(box.heading)}</div>` : '';
    out.push(`<div class="pg-box">${bar}<div class="pg-box-body">${box.buf.join('')}</div></div>`);
    box.open = false;
    box.heading = '';
    box.buf = [];
  };
  const ensure = () => {
    box.open = true;
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
      box.buf.push(renderLinks(group, ctx));
      continue;
    }

    switch (block.type) {
      case 'heading':
        flush();
        ensure();
        box.heading = block.text;
        break;
      case 'divider':
        flush();
        out.push('<div class="pg-divider" role="separator"></div>');
        break;
      case 'social':
        ensure();
        box.buf.push(renderGrid(block, ctx));
        break;
      case 'text':
        ensure();
        box.buf.push(renderText(block.text));
        break;
      case 'image': {
        const src = safeImgSrc(block.src, ctx);
        if (src) {
          ensure();
          box.buf.push(
            `<figure class="pg-figure"><img class="pg-img" src="${escapeAttr(src)}" alt="${escapeAttr(block.alt || '')}" loading="lazy" /></figure>`,
          );
        }
        break;
      }
      case 'embed': {
        ensure();
        const t = linkTarget(block.arweave, ctx);
        box.buf.push(
          `<p class="pg-prose"><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>${escapeHtml(block.arweave)}</a></p>`,
        );
        break;
      }
      case 'verify':
        // Rendered via the footer (pre-scan); a second verify block is ignored.
        break;
    }
    i++;
  }
  flush();

  // A single engraved rule sits above the footer. Reuse a trailing divider block
  // if the page already ended with one instead of stacking two.
  const endsWithDivider = out.length > 0 && out[out.length - 1].indexOf('pg-divider') !== -1;
  if (!endsWithDivider) out.push('<div class="pg-divider" role="separator"></div>');
  out.push(renderFooter(def, verifyBlock, ctx));

  return `<div class="pg-container">${out.join('')}</div>`;
}

export const topEightTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Top 8',
    family: 'classic',
    description: 'Mid-2000s social profile: beveled title bars, a Top 8 grid, and a comment wall.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default topEightTemplate;
