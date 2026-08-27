/**
 * Dial-Up Homestead — 1997 GeoCities starfield, beveled buttons, under-
 * construction banner. Reproduces docs/pages-templates/dial-up-homestead.html
 * as a block-driven module.
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
  linkTarget,
  multiline,
  resolveHandle,
  safeImgSrc,
  verifyTarget,
} from './shared';

const ID = 'dial-up-homestead';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-dial-up-homestead',
  template: 'dial-up-homestead',
  title: "~starla's corner of cyberspace~",
  arnsName: 'starla',
  profile: {
    avatar: '',
    displayName: "Starla's Homepage",
    tagline: '*~welcome to my corner of cyberspace~*',
    handle: 'starla.ar.io',
    bio: "Hi there, netizen! You've reached the personal homepage of Starla, age 19, cat mom, midnight webmistress & certified HTML tinkerer. Grab a Surge, sign my guestbook, and stay a while. Made with love (and a 56k modem).",
  },
  blocks: [
    { type: 'text', text: '⚠ UNDER CONSTRUCTION ⚠ pardon my dust!' },
    { type: 'heading', text: '★ My Cool Links ★' },
    { type: 'link', label: 'About Me & My Cats', url: '#about', icon: '☺' },
    { type: 'link', label: 'Photo Gallery NEW!', url: '#gallery', icon: '📷' },
    { type: 'link', label: 'My MIDI Jukebox', url: '#tunes', icon: '♫' },
    { type: 'link', label: 'Sign My Guestbook', url: '#book', icon: '✍' },
    { type: 'link', label: "Jenny's Homepage (on the permaweb!)", url: 'ar://jenny', icon: '★' },
    { type: 'link', label: "The Webring I'm In", url: '#rings', icon: '🔗' },
    { type: 'divider' },
    { type: 'heading', text: "☛ What's New?" },
    {
      type: 'text',
      text: "07.18.97 — Redid my whole layout at 2am because I couldn't sleep!! Tell me what you think in the guestbook. Also added a brand new MIDI that autoplays — it's my fave song <3. Shout out to my best friend Jenny whose page you should totally visit. This site is best experienced with the lights off and the volume UP.",
    },
    { type: 'divider' },
    { type: 'heading', text: '✉ Reach Me' },
    {
      type: 'social',
      items: [
        { platform: 'ICQ', url: '#' },
        { platform: 'AIM', url: '#' },
        { platform: 'Email', url: '#' },
        { platform: 'Yahoo Pager', url: '#' },
      ],
    },
    { type: 'divider' },
    { type: 'text', text: 'You are visitor number 001337 since Jan 1997!' },
    {
      type: 'text',
      text: "♥ Thanks for stopping by — don't forget to bookmark me! ♥ Best viewed in Netscape Navigator 3.0 at 800×600 © 1997 Starla",
    },
    {
      type: 'verify',
      label: 'Permanent on Arweave · verified permalink',
      url: 'ar://qX7mR2kP9wL4nT8vB1cZ6yH3jF5dG0sA7eU2oI9pW4t',
    },
  ],
  theme: {
    colors: { bg: '#000033', surface: '#000066', text: '#FFFF99', accent: '#FF00FF' },
    font: '"Times New Roman", Times, "Liberation Serif", Georgia, serif',
    buttonShape: 'square',
    background: 'starfield',
  },
  layout: { headerAlign: 'center', linkStyle: 'button', width: 'standard' },
};

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const navy = cssColor(c.bg, '#000033');
  const surface = cssColor(c.surface, '#000066');
  const text = cssColor(c.text, '#FFFF99');
  const magenta = cssColor(c.accent, '#FF00FF');
  const font = cssFontFamily(def.theme.font, '"Times New Roman", Times, "Liberation Serif", Georgia, serif');

  return `
:root { color-scheme: only light; }
.pg-${ID} {
  --navy: ${navy}; --surface: ${surface}; --surface-lift: #000080;
  --text: ${text}; --magenta: ${magenta}; --cyan: #00FFFF; --gold: #FFD700;
  --dark: #111111; --phos: #00FF66; --silver: #C0C0C0; --hi: #FFFFFF;
  --lo: #808080; --red: #FF0000;
  font-family: ${font};
  color: var(--text); background-color: var(--navy);
  background-image:
    radial-gradient(1px 1px at 20px 30px, #ffffff 99%, transparent),
    radial-gradient(1px 1px at 90px 120px, #ffffff 99%, transparent),
    radial-gradient(2px 2px at 160px 60px, #cfe3ff 99%, transparent),
    radial-gradient(1px 1px at 230px 180px, #ffffff 99%, transparent),
    radial-gradient(1px 1px at 300px 40px, #fff7cc 99%, transparent),
    radial-gradient(2px 2px at 50px 200px, #ffffff 99%, transparent),
    radial-gradient(1px 1px at 350px 150px, #cfe3ff 99%, transparent),
    radial-gradient(1px 1px at 120px 250px, #ffffff 99%, transparent);
  background-size: 380px 280px; background-repeat: repeat;
  min-height: 100vh; padding: 12px; line-height: 1.5;
}
.pg-${ID} * { box-sizing: border-box; }
.pg-${ID} .page { max-width: 760px; margin: 0 auto; }
.pg-${ID} .panel { background-color: var(--surface); border: 3px outset var(--silver); padding: 16px; margin: 0 0 16px; }
.pg-${ID} .construction { display: flex; align-items: center; border: 3px outset var(--silver); margin: 0 0 16px; overflow: hidden; }
.pg-${ID} .stripe { flex: 0 0 34px; align-self: stretch; min-height: 34px; background-image: repeating-linear-gradient(45deg, var(--gold) 0, var(--gold) 12px, var(--dark) 12px, var(--dark) 24px); }
.pg-${ID} .construction .label { flex: 1 1 auto; text-align: center; background: var(--gold); color: #000000; font-weight: bold; font-family: Arial, Helvetica, sans-serif; font-size: 13px; letter-spacing: 1px; padding: 8px 6px; text-transform: uppercase; }
.pg-${ID} header { text-align: center; }
.pg-${ID} .avatar { width: 96px; height: 96px; margin: 0 auto 10px; border: 3px outset var(--silver); background: radial-gradient(circle at 50% 38%, #ffe0b3 0 30%, transparent 31%), radial-gradient(circle at 50% 78%, #ff66cc 0 46%, transparent 47%), linear-gradient(135deg,#330066,#000066); position: relative; image-rendering: pixelated; }
.pg-${ID} .avatar::after { content: ""; position: absolute; top: 10px; right: 14px; width: 8px; height: 8px; background: linear-gradient(var(--hi),var(--hi)) 50%/2px 8px no-repeat, linear-gradient(var(--hi),var(--hi)) 50%/8px 2px no-repeat; }
.pg-${ID} .avatar--img { background: var(--dark); image-rendering: auto; }
.pg-${ID} .avatar--img::after { content: none; }
.pg-${ID} .avatar--img img { display: block; width: 100%; height: 100%; object-fit: cover; image-rendering: auto; }
.pg-${ID} h1 { font-size: 34px; margin: 0 0 4px; color: var(--magenta); text-shadow: 3px 3px 0 #000, 5px 5px 0 var(--cyan); letter-spacing: 1px; }
.pg-${ID} .tagline { font-size: 18px; font-style: italic; color: var(--cyan); margin: 0 0 6px; }
.pg-${ID} .handle { margin: 8px auto 0; display: inline-flex; align-items: center; gap: 6px; max-width: 100%; padding: 4px 10px; background: var(--dark); border: 2px inset var(--lo); font-family: "Courier New", monospace; font-size: 13px; color: var(--phos); text-shadow: 0 0 4px var(--phos); }
.pg-${ID} .handle .globe { color: var(--cyan); text-shadow: none; }
.pg-${ID} .handle a { color: var(--phos); text-decoration: none; font-weight: bold; }
.pg-${ID} .handle a:hover { text-decoration: underline; }
.pg-${ID} .bio { font-size: 16px; color: var(--text); margin: 8px auto 0; max-width: 52ch; }
.pg-${ID} hr { border: 0; height: 6px; margin: 18px 0; background: linear-gradient(90deg, #FF0000, #FF9900, #FFFF00, #00FF00, #00CCFF, #6633FF, #FF00FF); }
.pg-${ID} h2 { font-size: 24px; color: var(--gold); text-shadow: 2px 2px 0 #000; margin: 0 0 12px; text-align: center; text-transform: uppercase; letter-spacing: 1px; }
.pg-${ID} .links { display: flex; flex-direction: column; gap: 12px; align-items: center; }
.pg-${ID} .btn { display: block; width: 100%; max-width: 420px; min-height: 44px; padding: 11px 16px; text-align: center; text-decoration: none; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: bold; color: #000000; background: var(--silver); border: 3px outset var(--silver); cursor: pointer; position: relative; }
.pg-${ID} .btn .ico { margin-right: 8px; }
.pg-${ID} .btn .new { color: var(--red); font-family: Arial, sans-serif; font-weight: bold; margin-left: 8px; }
.pg-${ID} .btn .ar { color: var(--magenta); font-family: "Courier New", monospace; font-size: 11px; font-weight: bold; margin-left: 8px; }
.pg-${ID} .btn:hover { background: #d4d4d4; }
.pg-${ID} .btn:active { border-style: inset; background: #b0b0b0; }
.pg-${ID} .prose a { color: var(--magenta); text-decoration: underline; font-weight: bold; }
.pg-${ID} .prose a:visited { color: var(--cyan); }
.pg-${ID} .prose a:hover { background: #000; }
.pg-${ID} a:focus-visible, .pg-${ID} button:focus-visible { outline: 3px solid var(--cyan); outline-offset: 2px; }
.pg-${ID} .social { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.pg-${ID} .chip { display: inline-block; padding: 8px 12px; min-height: 44px; line-height: 26px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: bold; color: #000; background: var(--silver); border: 3px outset var(--silver); text-decoration: none; }
.pg-${ID} .chip:active { border-style: inset; }
.pg-${ID} .counter { text-align: center; margin: 6px 0 2px; }
.pg-${ID} .odometer { display: inline-block; padding: 6px; background: var(--gold); border: 3px ridge var(--gold); border-radius: 3px; }
.pg-${ID} .odometer .win { display: inline-block; background: var(--dark); padding: 6px 4px; border: 2px inset var(--lo); }
.pg-${ID} .odometer .digit { display: inline-block; width: 20px; font-family: "Courier New", monospace; font-weight: bold; font-size: 22px; color: var(--phos); text-align: center; text-shadow: 0 0 4px var(--phos); background: #001a00; margin: 0 1px; border: 1px solid #003300; }
.pg-${ID} .counter .caption { display: block; font-size: 13px; color: var(--text); margin-top: 6px; font-style: italic; }
.pg-${ID} footer { text-align: center; font-size: 14px; color: var(--text); padding: 8px 0 4px; }
.pg-${ID} footer .marq { color: var(--cyan); font-weight: bold; }
.pg-${ID} .permalink { margin: 10px 0 0; }
.pg-${ID} .permalink a { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: var(--dark); border: 2px inset var(--lo); font-family: "Courier New", monospace; font-size: 12px; color: var(--phos); text-shadow: 0 0 4px var(--phos); text-decoration: none; }
.pg-${ID} .permalink a .lock { color: var(--gold); text-shadow: none; }
.pg-${ID} .permalink a:hover { text-decoration: underline; }
.pg-${ID} .best-viewed { font-size: 12px; color: var(--text); margin-top: 8px; font-style: italic; }
@media (prefers-reduced-motion: no-preference) {
  .pg-${ID} .construction .blink { animation: pg-blink-${ID} 1s steps(2, jump-none) infinite; }
  .pg-${ID} footer .blink { animation: pg-blink-${ID} 1.2s steps(2, jump-none) infinite; }
  .pg-${ID} .btn:active { transform: translate(2px, 2px); }
  @keyframes pg-blink-${ID} { 0% { opacity: 1; } 50% { opacity: 1; } 50.01% { opacity: 0; } 100% { opacity: 0; } }
}
@media (prefers-reduced-motion: reduce) {
  .pg-${ID} .blink { visibility: visible !important; opacity: 1 !important; animation: none !important; }
}
@media (min-width: 560px) { .pg-${ID} h1 { font-size: 42px; } }
`.trim();
}

const UNDER_CONSTRUCTION = /under construction/i;
const VISITOR = /visitor number/i;
const BEST_VIEWED = /best viewed/i;

function bannerLabel(text: string): string {
  // Escape first, then wrap the "under construction" phrase in a blink span.
  return escapeHtml(text).replace(/under construction/i, (m) => `<span class="blink">${m}</span>`);
}

function renderBanner(text: string): string {
  return (
    `<div class="construction" role="img" aria-label="This site is under construction">` +
    `<span class="stripe" aria-hidden="true"></span>` +
    `<span class="label">${bannerLabel(text)}</span>` +
    `<span class="stripe" aria-hidden="true"></span>` +
    `</div>`
  );
}

function renderHeader(def: PageDef, ctx: RenderCtx): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  const avatarLabel = escapeAttr(`Portrait of ${p.displayName}`);
  const avatarSrc = p.avatar ? safeImgSrc(p.avatar, ctx) : '';
  const avatar = avatarSrc
    ? `<div class="avatar avatar--img" role="img" aria-label="${avatarLabel}">` +
      `<img src="${escapeAttr(avatarSrc)}" alt="${escapeAttr(p.displayName)}" loading="lazy" /></div>`
    : `<div class="avatar" role="img" aria-label="${avatarLabel}"></div>`;
  const parts: string[] = [
    avatar,
    `<h1>${escapeHtml(p.displayName)}</h1>`,
  ];
  if (p.tagline) parts.push(`<p class="tagline">${escapeHtml(p.tagline)}</p>`);
  if (handle) {
    parts.push(
      `<p class="handle"><span class="globe" aria-hidden="true">&#9673;</span>find me at ` +
        `<a href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)}>${escapeHtml(handle.text)}</a></p>`,
    );
  }
  if (p.bio) parts.push(`<p class="bio">${escapeHtml(p.bio)}</p>`);
  return `<header class="panel">${parts.join('')}</header>`;
}

function renderButton(link: LinkBlock, ctx: RenderCtx): string {
  const t = linkTarget(link.url, ctx);
  const ico = link.icon ? `<span class="ico" aria-hidden="true">${escapeHtml(link.icon)}</span>` : '';
  const ar = t.isAr ? ` <span class="ar" aria-hidden="true">ar://</span>` : '';
  return `<a class="btn" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>${ico}${escapeHtml(link.label)}${ar}</a>`;
}

function renderSocial(block: SocialBlock, ctx: RenderCtx): string {
  const chips = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      return `<a class="chip" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>${escapeHtml(item.platform)}</a>`;
    })
    .join('');
  return `<div class="social">${chips}</div>`;
}

function renderCounter(text: string): string {
  const match = /([\d][\d,]*)/.exec(text);
  const digits = match ? match[1].replace(/,/g, '') : '';
  const cells = digits
    .split('')
    .map((d) => `<span class="digit">${escapeHtml(d)}</span>`)
    .join('');
  const odometer = cells
    ? `<span class="odometer" aria-hidden="true"><span class="win">${cells}</span></span>`
    : '';
  return `<div class="counter">${odometer}<span class="caption">${escapeHtml(text)}</span></div>`;
}

function renderFooter(
  def: PageDef,
  verify: VerifyBlock | undefined,
  bestViewed: string | undefined,
  ctx: RenderCtx,
): string {
  const parts: string[] = [];
  const v = verifyTarget(verify, ctx);
  if (v) {
    const label = verify ? verify.label : 'Permanent on Arweave — verified permalink';
    parts.push(
      `<p class="permalink"><a href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)}>` +
        `<span class="lock" aria-hidden="true">&#128274;</span>${escapeHtml(label)}</a></p>`,
    );
  }
  if (bestViewed) parts.push(`<p class="best-viewed">${escapeHtml(bestViewed)}</p>`);
  if (parts.length === 0) return '';
  return `<footer>${parts.join('')}</footer>`;
}

interface PanelState {
  open: boolean;
  heading: string;
  prose: boolean;
  buf: string[];
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const blocks = def.blocks;

  // Pre-scan for chrome elements pulled out of the main flow.
  let bannerText = '';
  let bestViewed: string | undefined;
  let verifyBlock: VerifyBlock | undefined;
  const consumed = new Set<Block>();
  for (const b of blocks) {
    if (b.type === 'text' && !bannerText && UNDER_CONSTRUCTION.test(b.text)) {
      bannerText = b.text;
      consumed.add(b);
    } else if (b.type === 'text' && bestViewed === undefined && BEST_VIEWED.test(b.text)) {
      bestViewed = b.text;
      consumed.add(b);
    } else if (b.type === 'verify' && !verifyBlock) {
      verifyBlock = b;
      consumed.add(b);
    }
  }

  const out: string[] = [renderBanner(bannerText || '⚠ UNDER CONSTRUCTION ⚠ pardon my dust!')];
  out.push(renderHeader(def, ctx));

  const panel: PanelState = { open: false, heading: '', prose: false, buf: [] };
  const flush = () => {
    if (!panel.open) return;
    out.push('<hr>');
    const cls = panel.prose ? 'panel prose' : 'panel';
    const inner = (panel.heading ? `<h2>${escapeHtml(panel.heading)}</h2>` : '') + panel.buf.join('');
    out.push(`<div class="${cls}">${inner}</div>`);
    panel.open = false;
    panel.heading = '';
    panel.prose = false;
    panel.buf = [];
  };
  const ensure = () => {
    panel.open = true;
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
      const buttons: string[] = [];
      while (i < blocks.length && blocks[i].type === 'link' && !consumed.has(blocks[i])) {
        buttons.push(renderButton(blocks[i] as LinkBlock, ctx));
        i++;
      }
      panel.buf.push(`<div class="links">${buttons.join('')}</div>`);
      continue;
    }

    switch (block.type) {
      case 'heading':
        flush();
        ensure();
        panel.heading = block.text;
        break;
      case 'divider':
        flush();
        break;
      case 'social':
        ensure();
        panel.buf.push(renderSocial(block, ctx));
        break;
      case 'text':
        if (VISITOR.test(block.text)) {
          flush();
          out.push('<hr>');
          out.push(renderCounter(block.text));
        } else {
          ensure();
          panel.prose = true;
          panel.buf.push(`<p>${multiline(block.text)}</p>`);
        }
        break;
      case 'image': {
        const src = safeImgSrc(block.src, ctx);
        if (src) {
          ensure();
          panel.buf.push(
            `<p><img src="${escapeAttr(src)}" alt="${escapeAttr(block.alt || '')}" style="max-width:100%;height:auto" loading="lazy" /></p>`,
          );
        }
        break;
      }
      case 'embed': {
        ensure();
        panel.prose = true;
        const t = linkTarget(block.arweave, ctx);
        panel.buf.push(
          `<p><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>${escapeHtml(block.arweave)}</a></p>`,
        );
        break;
      }
      case 'verify':
        // Handled via footer (pre-scan). A second verify block, if any, is ignored.
        break;
    }
    i++;
  }
  flush();

  const footer = renderFooter(def, verifyBlock, bestViewed, ctx);
  if (footer) {
    out.push('<hr>');
    out.push(footer);
  }

  return `<div class="page">${out.join('')}</div>`;
}

export const dialUpHomesteadTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Dial-Up Homestead',
    family: 'classic',
    description: '1997 GeoCities starfield, beveled buttons, under-construction banner.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default dialUpHomesteadTemplate;
