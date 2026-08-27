/**
 * Desktop 95 — a Windows-95 desktop: teal backdrop, a centered "window" with a
 * blue title bar and CSS-drawn min/max/close buttons, classic beveled gray
 * borders (light top-left / dark bottom-right via border colors), raised
 * push-buttons for links, and an MS-Sans-ish system font. Self-contained, no
 * external assets, no `url(`.
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

// Not yet in the TemplateId union — the registry/schema add it. Cast so this
// module type-checks standalone without editing schema.ts.
const ID = 'desktop-95' as unknown as import('../schema').TemplateId;

const DEFAULT_FONT = '"MS Sans Serif", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-desktop-95',
  template: ID,
  title: 'Gizmo.exe',
  arnsName: 'gizmo',
  profile: {
    avatar: '',
    displayName: 'Gizmo',
    tagline: 'Webmaster · 100% hand-coded HTML',
    handle: 'gizmo.ar.io',
    bio: "Welcome to my little corner of the desktop! I build shovelware, collect Winamp skins, and keep this homepage running on a Pentium II. Double-click anything below. Best viewed at 800x600.",
  },
  blocks: [
    { type: 'text', text: 'C:\\> Loading GIZMO.EXE ... OK. Welcome, user!' },
    { type: 'heading', text: 'My Programs' },
    { type: 'link', label: 'My Homepage', url: '#home', icon: '🖥' },
    { type: 'link', label: 'Sign My Guestbook', url: '#guestbook', icon: '📖' },
    { type: 'link', label: 'Download Winamp Skins', url: '#skins', icon: '💾' },
    { type: 'link', label: "Gizmo's Permaweb Archive", url: 'ar://gizmo-archive', icon: '📁' },
    { type: 'link', label: 'The 32-bit Web Ring', url: '#webring', icon: '🔗' },
    { type: 'divider' },
    { type: 'heading', text: 'System Info' },
    {
      type: 'text',
      text: 'This homepage is stored forever on the permaweb — no hosting bill, no 404s, no expired domains. Refresh as often as you like; it will still be here in 2097.',
    },
    { type: 'divider' },
    { type: 'heading', text: 'Find Me Online' },
    {
      type: 'social',
      items: [
        { platform: 'ICQ', url: '#' },
        { platform: 'AIM', url: '#' },
        { platform: 'Email', url: '#' },
        { platform: 'GeoCities', url: '#' },
      ],
    },
    { type: 'divider' },
    { type: 'text', text: 'Thanks for visiting! Do not forget to add me to your Favorites.' },
    { type: 'verify', label: 'Permanent on Arweave', url: '#' },
  ],
  theme: {
    colors: { bg: '#008080', surface: '#C0C0C0', text: '#000000', accent: '#000080' },
    font: DEFAULT_FONT,
    buttonShape: 'square',
    background: 'win95-teal-desktop',
  },
  layout: { headerAlign: 'left', linkStyle: 'button', width: 'standard' },
};

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const desktop = cssColor(c.bg, '#008080');
  const face = cssColor(c.surface, '#C0C0C0');
  const ink = cssColor(c.text, '#000000');
  const titlebar = cssColor(c.accent, '#000080');
  const font = cssFontFamily(def.theme.font, DEFAULT_FONT);

  return `
:root { color-scheme: only light; }
.pg-${ID} {
  --desktop: ${desktop}; --face: ${face}; --ink: ${ink}; --title: ${titlebar};
  --hi: #FFFFFF; --light: #DFDFDF; --shadow: #808080; --dark: #000000;
  --title-2: #1084D0; --field: #FFFFFF; --sel: #000080; --sel-ink: #FFFFFF;
  font-family: ${font}; color: var(--ink);
  background-color: var(--desktop);
  background-image: linear-gradient(135deg, var(--desktop), var(--desktop));
  min-height: 100vh; padding: 14px 12px 0; line-height: 1.4; font-size: 14px;
}
.pg-${ID} * { box-sizing: border-box; }
.pg-${ID} .scene { max-width: 660px; margin: 0 auto; display: flex; flex-direction: column; min-height: calc(100vh - 14px); }
.pg-${ID} .raised {
  background: var(--face); border: 2px solid;
  border-color: var(--light) var(--dark) var(--dark) var(--light);
  box-shadow: inset 1px 1px 0 var(--hi), inset -1px -1px 0 var(--shadow);
}
.pg-${ID} .sunken {
  background: var(--field); border: 2px solid;
  border-color: var(--shadow) var(--hi) var(--hi) var(--shadow);
  box-shadow: inset 1px 1px 0 var(--dark), inset -1px -1px 0 var(--light);
}
.pg-${ID} .win { flex: 1 1 auto; margin: 0 0 8px; padding: 3px; display: flex; flex-direction: column; }
.pg-${ID} .titlebar {
  display: flex; align-items: center; gap: 6px;
  background: linear-gradient(90deg, var(--title), var(--title-2));
  color: var(--hi); padding: 3px 3px 3px 4px; margin: 0 0 3px;
}
.pg-${ID} .tb-icon { flex: 0 0 auto; width: 16px; height: 16px; background: var(--field); border: 1px solid var(--dark); position: relative; }
.pg-${ID} .tb-icon::before { content: ""; position: absolute; inset: 3px; background: linear-gradient(135deg, var(--title-2), var(--sel)); }
.pg-${ID} .tb-title { flex: 1 1 auto; font-weight: bold; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: .2px; }
.pg-${ID} .tb-controls { flex: 0 0 auto; display: flex; gap: 2px; }
.pg-${ID} .tb-btn {
  width: 18px; height: 16px; background: var(--face); border: 2px solid;
  border-color: var(--hi) var(--dark) var(--dark) var(--hi);
  box-shadow: inset 1px 1px 0 var(--light), inset -1px -1px 0 var(--shadow);
  display: flex; align-items: center; justify-content: center;
}
.pg-${ID} .tb-btn i { display: block; }
.pg-${ID} .tb-min i { width: 8px; height: 2px; background: var(--dark); margin-top: 6px; }
.pg-${ID} .tb-max i { width: 10px; height: 9px; border: 1px solid var(--dark); border-top-width: 2px; }
.pg-${ID} .tb-close i { position: relative; width: 8px; height: 8px; }
.pg-${ID} .tb-close i::before, .pg-${ID} .tb-close i::after { content: ""; position: absolute; left: 50%; top: 0; width: 1px; height: 10px; background: var(--dark); }
.pg-${ID} .tb-close i::before { transform: translateX(-50%) rotate(45deg); }
.pg-${ID} .tb-close i::after { transform: translateX(-50%) rotate(-45deg); }
.pg-${ID} .menubar { display: flex; gap: 14px; padding: 2px 8px 4px; font-size: 13px; color: var(--ink); }
.pg-${ID} .menubar span u { text-decoration: underline; }
.pg-${ID} .win-body { flex: 1 1 auto; padding: 12px; }
.pg-${ID} .profile { display: flex; gap: 12px; align-items: flex-start; margin: 0 0 12px; }
.pg-${ID} .avatar { flex: 0 0 auto; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; background: var(--field); font-weight: bold; font-size: 24px; color: var(--sel); text-transform: uppercase; overflow: hidden; }
.pg-${ID} .avatar img { width: 100%; height: 100%; object-fit: cover; image-rendering: auto; }
.pg-${ID} .id-block { min-width: 0; flex: 1 1 auto; }
.pg-${ID} h1 { font-size: 22px; font-weight: bold; margin: 0 0 2px; color: var(--ink); word-break: break-word; }
.pg-${ID} .tagline { font-size: 13px; color: var(--ink); margin: 0 0 6px; word-break: break-word; }
.pg-${ID} .handle { display: inline-flex; align-items: center; gap: 5px; padding: 2px 6px; font-size: 12px; max-width: 100%; }
.pg-${ID} .handle .glyph { flex: 0 0 auto; width: 10px; height: 10px; background: linear-gradient(135deg, var(--title-2), var(--sel)); border: 1px solid var(--dark); }
.pg-${ID} .handle a { color: var(--sel); text-decoration: none; font-weight: bold; word-break: break-all; }
.pg-${ID} .handle a:hover { text-decoration: underline; }
.pg-${ID} .bio { font-size: 13px; color: var(--ink); margin: 10px 0 0; word-break: break-word; }
.pg-${ID} .grouphead { display: inline-block; background: var(--sel); color: var(--sel-ink); font-weight: bold; font-size: 13px; padding: 2px 10px; margin: 14px 0 8px; }
.pg-${ID} .prose { font-size: 13px; margin: 0 0 10px; word-break: break-word; }
.pg-${ID} .links { display: flex; flex-direction: column; gap: 8px; margin: 0 0 10px; }
.pg-${ID} .btn {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: 40px;
  padding: 8px 12px; text-align: left; text-decoration: none; color: var(--ink);
  font-family: inherit; font-size: 14px; cursor: pointer;
  background: var(--face); border: 2px solid;
  border-color: var(--hi) var(--dark) var(--dark) var(--hi);
  box-shadow: inset 1px 1px 0 var(--light), inset -1px -1px 0 var(--shadow);
}
.pg-${ID} .btn .ico { flex: 0 0 auto; }
.pg-${ID} .btn .lbl { flex: 1 1 auto; word-break: break-word; }
.pg-${ID} .btn .ar { flex: 0 0 auto; font-size: 11px; font-weight: bold; color: var(--sel); }
.pg-${ID} .btn:hover { background: var(--face); }
.pg-${ID} .btn:active {
  border-color: var(--dark) var(--hi) var(--hi) var(--dark);
  box-shadow: inset 1px 1px 0 var(--shadow), inset -1px -1px 0 var(--light);
  padding: 9px 11px 7px 13px;
}
.pg-${ID} a:focus-visible, .pg-${ID} .btn:focus-visible { outline: 1px dotted var(--dark); outline-offset: -4px; }
.pg-${ID} .social { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 10px; }
.pg-${ID} .chip {
  display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 6px 12px;
  text-decoration: none; color: var(--ink); font-size: 13px; font-weight: bold;
  background: var(--face); border: 2px solid;
  border-color: var(--hi) var(--dark) var(--dark) var(--hi);
  box-shadow: inset 1px 1px 0 var(--light), inset -1px -1px 0 var(--shadow);
}
.pg-${ID} .chip .badge { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; background: var(--sel); color: var(--sel-ink); font-size: 11px; }
.pg-${ID} .chip:active { border-color: var(--dark) var(--hi) var(--hi) var(--dark); box-shadow: inset 1px 1px 0 var(--shadow), inset -1px -1px 0 var(--light); }
.pg-${ID} .divider { height: 0; border: 0; border-top: 1px solid var(--shadow); border-bottom: 1px solid var(--hi); margin: 12px 0; }
.pg-${ID} .figure { margin: 0 0 10px; padding: 4px; display: inline-block; max-width: 100%; }
.pg-${ID} .figure img { display: block; max-width: 100%; height: auto; }
.pg-${ID} .figure figcaption { font-size: 12px; color: var(--ink); margin-top: 4px; }
.pg-${ID} .embed { margin: 0 0 10px; }
.pg-${ID} .embed a { color: var(--sel); font-weight: bold; text-decoration: underline; word-break: break-all; }
.pg-${ID} .statusbar { display: flex; flex-wrap: wrap; gap: 4px; padding: 3px; }
.pg-${ID} .status-cell { padding: 3px 8px; font-size: 12px; color: var(--ink); }
.pg-${ID} .status-cell.grow { flex: 1 1 auto; min-width: 80px; }
.pg-${ID} .verify { display: inline-flex; align-items: center; gap: 6px; text-decoration: none; color: var(--ink); }
.pg-${ID} .verify .lock { flex: 0 0 auto; width: 10px; height: 10px; background: var(--sel); border: 1px solid var(--dark); }
.pg-${ID} .verify:hover { text-decoration: underline; }
.pg-${ID} .taskbar { display: flex; align-items: center; gap: 8px; padding: 3px; margin: 0 0 8px; }
.pg-${ID} .start {
  display: inline-flex; align-items: center; gap: 6px; font-weight: bold; font-size: 14px;
  padding: 4px 10px; color: var(--ink); text-decoration: none;
  background: var(--face); border: 2px solid;
  border-color: var(--hi) var(--dark) var(--dark) var(--hi);
  box-shadow: inset 1px 1px 0 var(--light), inset -1px -1px 0 var(--shadow);
}
.pg-${ID} .start .flag { width: 14px; height: 14px; background: linear-gradient(135deg, var(--sel), var(--title-2)); border: 1px solid var(--dark); }
.pg-${ID} .taskbar .clock { margin-left: auto; padding: 4px 10px; font-size: 12px; }
@media (max-width: 480px) {
  .pg-${ID} .profile { flex-direction: column; }
  .pg-${ID} .menubar { flex-wrap: wrap; }
}
`.trim();
}

function renderHeader(def: PageDef, ctx: RenderCtx): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  const avatarSrc = p.avatar ? safeImgSrc(p.avatar, ctx) : '';
  const avatar = avatarSrc
    ? `<div class="avatar sunken"><img src="${escapeAttr(avatarSrc)}" alt="${escapeAttr(p.displayName)}" loading="lazy" /></div>`
    : `<div class="avatar sunken" aria-hidden="true">${escapeHtml(avatarInitials(def))}</div>`;
  const parts: string[] = [`<h1>${escapeHtml(p.displayName)}</h1>`];
  if (p.tagline) parts.push(`<p class="tagline">${escapeHtml(p.tagline)}</p>`);
  if (handle) {
    parts.push(
      `<span class="handle sunken"><span class="glyph" aria-hidden="true"></span>` +
        `<a href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)}>${escapeHtml(handle.text)}</a></span>`,
    );
  }
  const body = `<div class="id-block">${parts.join('')}</div>`;
  const bio = p.bio ? `<p class="bio">${multiline(p.bio)}</p>` : '';
  return `<div class="profile">${avatar}${body}</div>${bio}`;
}

function renderLinks(group: LinkBlock[], ctx: RenderCtx): string {
  const items = group
    .map((link) => {
      const t = linkTarget(link.url, ctx);
      const ico = link.icon ? `<span class="ico" aria-hidden="true">${escapeHtml(link.icon)}</span>` : '';
      const ar = t.isAr ? `<span class="ar" aria-hidden="true">ar://</span>` : '';
      return (
        `<a class="btn" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
        `${ico}<span class="lbl">${escapeHtml(link.label)}</span>${ar}</a>`
      );
    })
    .join('');
  return `<div class="links">${items}</div>`;
}

function renderSocial(block: SocialBlock, ctx: RenderCtx): string {
  const chips = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      const plat = item.platform.trim();
      const badge = plat ? plat.charAt(0).toUpperCase() : '·';
      return (
        `<a class="chip" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
        `<span class="badge" aria-hidden="true">${escapeHtml(badge)}</span>` +
        `<span>${escapeHtml(item.platform)}</span></a>`
      );
    })
    .join('');
  return `<div class="social">${chips}</div>`;
}

function renderImage(src: string, alt: string): string {
  return `<figure class="figure sunken"><img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" loading="lazy" />` +
    (alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : '') + `</figure>`;
}

function renderStatusBar(verify: VerifyBlock | undefined, ctx: RenderCtx): string {
  const cells: string[] = [];
  const v = verifyTarget(verify, ctx);
  if (v) {
    const label = verify && verify.label ? verify.label : 'Permanent on Arweave';
    cells.push(
      `<span class="status-cell sunken grow"><a class="verify" href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)}>` +
        `<span class="lock" aria-hidden="true"></span>${escapeHtml(label)}</a></span>`,
    );
  } else {
    cells.push(`<span class="status-cell sunken grow">Ready</span>`);
  }
  cells.push(`<span class="status-cell sunken" aria-hidden="true">permaweb</span>`);
  return `<div class="statusbar raised">${cells.join('')}</div>`;
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const blocks = def.blocks;

  // Pull the first verify block out to the status bar.
  let verifyBlock: VerifyBlock | undefined;
  const consumed = new Set<Block>();
  for (const b of blocks) {
    if (b.type === 'verify' && !verifyBlock) {
      verifyBlock = b;
      consumed.add(b);
    }
  }

  const bodyParts: string[] = [renderHeader(def, ctx)];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (consumed.has(block)) {
      i++;
      continue;
    }
    if (block.type === 'link') {
      const group: LinkBlock[] = [];
      while (i < blocks.length && blocks[i].type === 'link' && !consumed.has(blocks[i])) {
        group.push(blocks[i] as LinkBlock);
        i++;
      }
      bodyParts.push(renderLinks(group, ctx));
      continue;
    }
    switch (block.type) {
      case 'heading':
        if (block.text) bodyParts.push(`<div class="grouphead">${escapeHtml(block.text)}</div>`);
        break;
      case 'text':
        if (block.text) bodyParts.push(`<p class="prose">${multiline(block.text)}</p>`);
        break;
      case 'social':
        bodyParts.push(renderSocial(block, ctx));
        break;
      case 'divider':
        bodyParts.push(`<hr class="divider" />`);
        break;
      case 'image': {
        const src = safeImgSrc(block.src, ctx);
        if (src) bodyParts.push(renderImage(src, block.alt || ''));
        break;
      }
      case 'embed': {
        const t = linkTarget(block.arweave, ctx);
        bodyParts.push(
          `<p class="embed"><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>${escapeHtml(block.arweave)}</a></p>`,
        );
        break;
      }
      case 'verify':
        // Routed to the status bar via the pre-scan; extras ignored.
        break;
    }
    i++;
  }

  const title = def.title || def.profile.displayName || 'Untitled';
  const titlebar =
    `<div class="titlebar">` +
    `<span class="tb-icon" aria-hidden="true"></span>` +
    `<span class="tb-title">${escapeHtml(title)}</span>` +
    `<span class="tb-controls" aria-hidden="true">` +
    `<span class="tb-btn tb-min"><i></i></span>` +
    `<span class="tb-btn tb-max"><i></i></span>` +
    `<span class="tb-btn tb-close"><i></i></span>` +
    `</span></div>`;
  const menubar =
    `<div class="menubar" aria-hidden="true">` +
    `<span><u>F</u>ile</span><span><u>E</u>dit</span><span><u>V</u>iew</span><span><u>H</u>elp</span>` +
    `</div>`;

  const handle = resolveHandle(def, ctx);
  const startLabel = handle ? handle.text : (def.profile.displayName || 'Start');
  const taskbar =
    `<div class="taskbar raised">` +
    `<span class="start"><span class="flag" aria-hidden="true"></span>${escapeHtml(startLabel)}</span>` +
    `<span class="clock sunken" aria-hidden="true">permaweb</span>` +
    `</div>`;

  const win =
    `<div class="win raised">${titlebar}${menubar}` +
    `<div class="win-body">${bodyParts.join('')}</div>` +
    renderStatusBar(verifyBlock, ctx) +
    `</div>`;

  return `<div class="scene">${win}${taskbar}</div>`;
}

export const desktop95Template: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Desktop 95',
    family: 'classic',
    description: 'A Windows-95 desktop: teal backdrop, a beveled window, and raised push-button links.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default desktop95Template;
