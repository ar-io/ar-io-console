/**
 * Xerox Riot — DIY punk zine off a busted copier: photostat grain, taped
 * flyer link cards, cut-here dividers, a manifesto clipping and a rubber-stamp
 * ar.io handle. Reproduces docs/pages-templates/xerox-riot.html as a
 * block-driven module.
 */

import type {
  Block,
  LinkBlock,
  PageDef,
  SocialBlock,
  TextBlock,
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

const ID = 'xerox-riot';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-xerox-riot',
  template: 'xerox-riot',
  title: 'Static // Press — Xerox Riot',
  arnsName: 'staticpress.ar.io',
  profile: {
    avatar: '',
    displayName: 'Static // Press',
    tagline: 'Cut · Paste · Photocopy · Repeat',
    bio: 'DIY punk zine off a busted copier in the back of the record shop. New issue whenever the toner holds out.',
  },
  blocks: [
    { type: 'heading', text: 'Where To Find Us' },
    {
      type: 'link',
      label: 'Read Issue #07 (PDF)',
      url: 'ar://pLZ9k2Xr7mQ4vN1tBs8WfC6hDy3JoU0aEgiVn5xYqRb',
      icon: 'square',
    },
    { type: 'link', label: 'Show Listings / DIY Gigs', url: '#shows', icon: 'square' },
    { type: 'link', label: 'Demos + Tapes (Bandcamp)', url: '#tapes', icon: 'square' },
    { type: 'link', label: 'Join The Paper List', url: '#list', icon: 'square' },
    { type: 'divider' },
    { type: 'heading', text: 'Manifesto' },
    {
      type: 'text',
      text: "No gods. No gatekeepers. No glossy print. We staple it ourselves and hand it out at the door. If you can read this, you're already on the list.",
    },
    {
      type: 'social',
      items: [
        { platform: 'instagram', url: '#instagram' },
        { platform: 'bandcamp', url: '#bandcamp' },
        { platform: 'soundcloud', url: '#soundcloud' },
        { platform: 'mastodon', url: '#mastodon' },
      ],
    },
    {
      type: 'verify',
      label: 'Verified permalink · Permanent on Arweave',
      url: 'ar://kQ3h7Zt9vXbN2pLm8sWfR4yD1cUoJ6aEgT0iVnZxYqB',
    },
    { type: 'text', text: 'Printed at 3am · Free / Pay What You Can · Photocopy & Pass It On' },
  ],
  theme: {
    colors: { bg: '#F2EFE9', surface: '#FFFFFF', text: '#141414', accent: '#FF2E88' },
    font: '"Arial Narrow", "Helvetica Neue Condensed", "Roboto Condensed", "Oswald", Impact, "Franklin Gothic Medium", Haettenschweiler, sans-serif',
    buttonShape: 'square',
    background:
      'photocopy paper-grain (stacked radial-gradient stipple over #F2EFE9); inverts to darkroom photo-negative on #141414 in dark mode',
  },
  layout: { headerAlign: 'left', linkStyle: 'card', width: 'standard' },
};

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const bg = cssColor(c.bg, '#F2EFE9');
  const surface = cssColor(c.surface, '#FFFFFF');
  const text = cssColor(c.text, '#141414');
  const accent = cssColor(c.accent, '#FF2E88');
  const font = cssFontFamily(
    def.theme.font,
    '"Arial Narrow", "Helvetica Neue Condensed", "Roboto Condensed", "Oswald", Impact, "Franklin Gothic Medium", Haettenschweiler, sans-serif',
  );

  return `
:root { color-scheme: light dark; }
.pg-${ID} {
  --bg: ${bg}; --surface: ${surface}; --text: ${text}; --accent: ${accent};
  --paper3: #D9D4C7; --muted: #7A7466;
  --tape: rgba(230, 225, 210, 0.55);
  --shadow: rgba(20, 20, 20, 0.18); --shadow-strong: rgba(20, 20, 20, 0.5);
  --grain: rgba(20, 20, 20, 0.05);
  font-family: ${font};
  color: var(--text);
  background-color: var(--bg);
  background-image:
    radial-gradient(var(--grain) 1px, transparent 1px),
    radial-gradient(var(--grain) 1px, transparent 1px);
  background-size: 3px 3px, 7px 7px;
  background-position: 0 0, 1px 2px;
  min-height: 100vh;
  -webkit-font-smoothing: none;
  line-height: 1.35;
}
:root[data-theme="light"] .pg-${ID} {
  --bg: ${bg}; --surface: ${surface}; --text: ${text}; --accent: ${accent};
  --paper3: #D9D4C7; --muted: #7A7466;
  --tape: rgba(230, 225, 210, 0.55);
  --shadow: rgba(20, 20, 20, 0.18); --shadow-strong: rgba(20, 20, 20, 0.5);
  --grain: rgba(20, 20, 20, 0.05);
}
.pg-${ID} * { box-sizing: border-box; }
.pg-${ID} .wrap { max-width: 560px; margin: 0 auto; padding: 2.2rem 1.1rem 3.5rem; }

/* masthead */
.pg-${ID} .title { margin: .1rem 0 .5rem; font-weight: 900; font-size: clamp(3.4rem, 17vw, 6rem); line-height: 0.82; letter-spacing: -0.02em; text-transform: uppercase; -webkit-text-stroke: 1px var(--text); text-shadow: 1px 1px 0 var(--text), 2px 2px 0 var(--shadow); }
.pg-${ID} .tagline { position: relative; display: inline-block; margin: 0; font-weight: 700; font-size: .95rem; letter-spacing: .14em; text-transform: uppercase; color: var(--text); padding: .05rem .3rem; }
.pg-${ID} .tagline .slash { position: absolute; left: -8px; top: 50%; width: 82px; height: 20px; background: var(--accent); transform: translateY(-52%) rotate(-6deg); z-index: 0; }
.pg-${ID} .tagline .tag-txt { position: relative; z-index: 1; }

/* profile / photostat avatar */
.pg-${ID} .profile { display: flex; gap: 1rem; align-items: center; margin: 1.8rem 0 1.4rem; }
.pg-${ID} .avatar { width: 84px; height: 84px; flex: none; border: 2px solid var(--text); display: grid; place-items: center; font-weight: 900; font-size: 1.9rem; letter-spacing: -0.03em; text-transform: uppercase; background: var(--paper3); color: var(--text); filter: grayscale(1) contrast(1.4); position: relative; transform: rotate(-2deg); box-shadow: 3px 3px 0 var(--shadow); }
.pg-${ID} .avatar::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at 62% 40%, rgba(20, 20, 20, 0.30), transparent 62%); mix-blend-mode: multiply; z-index: 1; }
.pg-${ID} .avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; z-index: 0; }
.pg-${ID} .profile-body { min-width: 0; }
.pg-${ID} .bio { margin: .35rem 0 0; font-size: .98rem; font-weight: 600; color: var(--muted); }

/* ar.io handle stamp */
.pg-${ID} .handle { display: inline-flex; align-items: center; gap: .32rem; font-weight: 900; font-size: .82rem; letter-spacing: .05em; text-transform: lowercase; color: var(--text); text-decoration: none; border: 2px solid var(--text); background: var(--surface); padding: .1rem .42rem; transform: rotate(-1.6deg); box-shadow: 2px 2px 0 var(--shadow); transition: transform 140ms cubic-bezier(0.2, 0.9, 0.3, 1.3), box-shadow 140ms ease; }
.pg-${ID} .handle:hover, .pg-${ID} .handle:focus-visible { transform: rotate(0); box-shadow: 1px 1px 0 var(--shadow-strong); }
.pg-${ID} .handle .dot { width: 9px; height: 9px; flex: none; background: var(--accent); border: 1.5px solid var(--text); }

/* section kicker */
.pg-${ID} .kicker { display: inline-block; font-weight: 900; font-size: .9rem; letter-spacing: .16em; text-transform: uppercase; border: 2px solid var(--text); padding: .15rem .5rem; margin: 0 0 1rem; background: var(--surface); transform: rotate(-1.5deg); }

/* taped flyer link cards */
.pg-${ID} .links { display: grid; gap: 1.15rem; margin: 0 0 .5rem; padding: 0; list-style: none; }
.pg-${ID} .card { position: relative; display: flex; align-items: center; gap: .7rem; min-height: 44px; background: var(--surface); border: 2px solid var(--text); color: var(--text); text-decoration: none; padding: .95rem 1rem; font-weight: 800; font-size: 1.14rem; text-transform: uppercase; letter-spacing: .005em; box-shadow: 3px 3px 0 var(--shadow); transition: transform 140ms cubic-bezier(0.2, 0.9, 0.3, 1.3), box-shadow 140ms ease; will-change: transform; }
.pg-${ID} .links li:nth-child(4n+1) .card { transform: rotate(-2.5deg); }
.pg-${ID} .links li:nth-child(4n+2) .card { transform: rotate(1.5deg); }
.pg-${ID} .links li:nth-child(4n+3) .card { transform: rotate(-1.2deg); }
.pg-${ID} .links li:nth-child(4n+4) .card { transform: rotate(2deg); }
.pg-${ID} .card:hover, .pg-${ID} .card:focus-visible { transform: rotate(0); box-shadow: 1px 1px 0 var(--shadow-strong); }
.pg-${ID} .ico { width: 15px; height: 15px; flex: none; background: var(--text); display: inline-block; }
.pg-${ID} .lbl { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.pg-${ID} .arflag { font-size: .62rem; font-weight: 900; letter-spacing: .1em; text-transform: lowercase; border: 1.5px solid var(--text); background: var(--bg); padding: .04rem .24rem; line-height: 1; }
.pg-${ID} .arr { font-weight: 900; font-size: 1.2rem; line-height: 1; }
.pg-${ID} .card::before, .pg-${ID} .card::after { content: ""; position: absolute; width: 64px; height: 22px; pointer-events: none; z-index: 2; background: linear-gradient(120deg, rgba(255, 255, 255, 0.40), var(--tape)); border: 1px dashed rgba(20, 20, 20, 0.15); }
.pg-${ID} .card::before { top: -11px; left: 16px; transform: rotate(-8deg); }
.pg-${ID} .card::after { bottom: -11px; right: 16px; transform: rotate(12deg); }

/* cut-here divider */
.pg-${ID} .cut { position: relative; height: 2px; border: 0; margin: 2.2rem 0; background: repeating-linear-gradient(90deg, var(--text) 0 8px, transparent 8px 16px); }
.pg-${ID} .cut::before { content: "\\2702"; position: absolute; left: 10px; top: 50%; transform: translateY(-50%); background: var(--bg); padding: 0 .35rem; font-size: 1.05rem; color: var(--text); line-height: 1; }

/* manifesto clipping */
.pg-${ID} .manifesto { position: relative; background: var(--surface); border: 2px solid var(--text); border-left: 4px solid var(--text); padding: 1.3rem 1.1rem 1.1rem; margin: 1.6rem 0; box-shadow: 3px 3px 0 var(--shadow); transform: rotate(-0.6deg); }
.pg-${ID} .manifesto::before { content: ""; position: absolute; left: -2px; right: -2px; top: -9px; height: 9px; background: linear-gradient(135deg, var(--surface) 50%, transparent 50%) 0 0 / 9px 9px repeat-x; }
.pg-${ID} .manifesto p { margin: 0; font-weight: 700; font-size: 1.02rem; letter-spacing: .005em; }
.pg-${ID} .manifesto strong { font-weight: 900; text-transform: uppercase; }

/* photostat figure */
.pg-${ID} .figure { margin: 1.6rem 0; }
.pg-${ID} .img { display: block; max-width: 100%; height: auto; border: 2px solid var(--text); filter: grayscale(1) contrast(1.4); box-shadow: 3px 3px 0 var(--shadow); }

/* social */
.pg-${ID} .social { list-style: none; display: flex; flex-wrap: wrap; gap: .7rem; padding: 0; margin: 1.4rem 0 0; }
.pg-${ID} .social a { display: flex; align-items: center; justify-content: center; min-width: 52px; min-height: 52px; padding: 0 .55rem; border: 2px solid var(--text); background: var(--surface); color: var(--text); text-decoration: none; font-weight: 900; font-size: .95rem; letter-spacing: .05em; text-transform: uppercase; box-shadow: 2px 2px 0 var(--shadow); transition: transform 140ms cubic-bezier(0.2, 0.9, 0.3, 1.3), box-shadow 140ms ease; }
.pg-${ID} .social li:nth-child(odd) a { transform: rotate(-3deg); }
.pg-${ID} .social li:nth-child(even) a { transform: rotate(2.5deg); }
.pg-${ID} .social a:hover, .pg-${ID} .social a:focus-visible { transform: rotate(0); box-shadow: 1px 1px 0 var(--shadow-strong); }

/* colophon + verify permalink */
.pg-${ID} .colophon { margin: 2.4rem 0 0; font-size: .82rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.pg-${ID} .permalink { display: inline-flex; align-items: center; gap: .4rem; margin-top: .55rem; color: var(--text); text-decoration: none; font-weight: 900; letter-spacing: .06em; border-bottom: 2px solid var(--accent); padding-bottom: 1px; transition: opacity 140ms ease; }
.pg-${ID} .permalink:hover, .pg-${ID} .permalink:focus-visible { opacity: .7; }
.pg-${ID} .lock { position: relative; display: inline-block; width: 11px; height: 8px; flex: none; background: var(--text); vertical-align: -1px; margin-top: 5px; }
.pg-${ID} .lock::before { content: ""; position: absolute; left: 2px; top: -5px; width: 5px; height: 5px; border: 2px solid var(--text); border-bottom: 0; border-radius: 5px 5px 0 0; }

/* focus */
.pg-${ID} a:focus-visible, .pg-${ID} button:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }

/* dark: photo-negative darkroom stat */
@media (prefers-color-scheme: dark) {
  .pg-${ID} {
    --bg: #141414; --surface: #1F1F1F; --text: #F2EFE9; --paper3: #2A2A2A; --muted: #B7B2A6;
    --tape: rgba(255, 255, 255, 0.10); --shadow: rgba(0, 0, 0, 0.55); --shadow-strong: rgba(255, 255, 255, 0.28); --grain: rgba(255, 255, 255, 0.06);
  }
  .pg-${ID} .card::before, .pg-${ID} .card::after { background: linear-gradient(120deg, rgba(255, 255, 255, 0.06), var(--tape)); border-color: rgba(255, 255, 255, 0.18); }
  .pg-${ID} .avatar::after { background: radial-gradient(circle at 62% 40%, rgba(255, 255, 255, 0.18), transparent 62%); mix-blend-mode: screen; }
  .pg-${ID} .arflag { background: var(--surface); }
}
:root[data-theme="dark"] .pg-${ID} {
  --bg: #141414; --surface: #1F1F1F; --text: #F2EFE9; --paper3: #2A2A2A; --muted: #B7B2A6;
  --tape: rgba(255, 255, 255, 0.10); --shadow: rgba(0, 0, 0, 0.55); --shadow-strong: rgba(255, 255, 255, 0.28); --grain: rgba(255, 255, 255, 0.06);
}
:root[data-theme="dark"] .pg-${ID} .card::before, :root[data-theme="dark"] .pg-${ID} .card::after { background: linear-gradient(120deg, rgba(255, 255, 255, 0.06), var(--tape)); border-color: rgba(255, 255, 255, 0.18); }
:root[data-theme="dark"] .pg-${ID} .avatar::after { background: radial-gradient(circle at 62% 40%, rgba(255, 255, 255, 0.18), transparent 62%); mix-blend-mode: screen; }
:root[data-theme="dark"] .pg-${ID} .arflag { background: var(--surface); }

/* reduced motion */
@media (prefers-reduced-motion: reduce) {
  .pg-${ID} * { transition: none !important; animation: none !important; }
  .pg-${ID} .card, .pg-${ID} .social a, .pg-${ID} .avatar, .pg-${ID} .manifesto, .pg-${ID} .kicker, .pg-${ID} .handle { transform: rotate(0) !important; }
}
`.trim();
}

function renderHeader(def: PageDef): string {
  const p = def.profile;
  const parts: string[] = [`<h1 class="title">${escapeHtml(p.displayName)}</h1>`];
  if (p.tagline) {
    parts.push(
      `<p class="tagline"><span class="slash" aria-hidden="true"></span>` +
        `<span class="tag-txt">${escapeHtml(p.tagline)}</span></p>`,
    );
  }
  return `<header>${parts.join('')}</header>`;
}

function renderProfile(def: PageDef, ctx: RenderCtx): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  const body: string[] = [];
  if (handle) {
    body.push(
      `<a class="handle" href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)}>` +
        `<span class="dot" aria-hidden="true"></span>${escapeHtml(handle.text)}</a>`,
    );
  }
  if (p.bio) body.push(`<p class="bio">${escapeHtml(p.bio)}</p>`);
  const avatarSrc = p.avatar ? safeImgSrc(p.avatar, ctx) : '';
  const avatarInner = avatarSrc
    ? `<img src="${escapeAttr(avatarSrc)}" alt="${escapeAttr(p.displayName)}" loading="lazy" />`
    : escapeHtml(avatarInitials(def));
  return (
    `<section class="profile">` +
    `<div class="avatar" aria-hidden="true">${avatarInner}</div>` +
    `<div class="profile-body">${body.join('')}</div>` +
    `</section>`
  );
}

function renderCards(group: LinkBlock[], ctx: RenderCtx): string {
  const items = group
    .map((link) => {
      const t = linkTarget(link.url, ctx);
      const flag = t.isAr ? `<span class="arflag" aria-hidden="true">ar://</span>` : '';
      return (
        `<li><a class="card" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
        `<span class="ico" aria-hidden="true"></span>` +
        `<span class="lbl">${escapeHtml(link.label)}</span>` +
        flag +
        `<span class="arr" aria-hidden="true">&#8599;</span>` +
        `</a></li>`
      );
    })
    .join('');
  return `<ul class="links">${items}</ul>`;
}

function renderSocial(block: SocialBlock, ctx: RenderCtx): string {
  const items = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      return (
        `<li><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)} ` +
        `aria-label="${escapeAttr(item.platform)}">${escapeHtml(item.platform)}</a></li>`
      );
    })
    .join('');
  return `<ul class="social" aria-label="Social links">${items}</ul>`;
}

function renderColophon(
  verify: VerifyBlock | undefined,
  caption: string | undefined,
  ctx: RenderCtx,
): string {
  const parts: string[] = [];
  if (caption) parts.push(`${multiline(caption)}`);
  const v = verifyTarget(verify, ctx);
  if (v) {
    const label = verify ? verify.label : 'Verified permalink · Permanent on Arweave';
    parts.push(
      `<a class="permalink" href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)}>` +
        `<span class="lock" aria-hidden="true"></span>${escapeHtml(label)}</a>`,
    );
  }
  if (parts.length === 0) return '';
  return `<p class="colophon">${parts.join('<br>')}</p>`;
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const blocks = def.blocks;

  // Pull the verify permalink out of the flow into a footer colophon, and adopt
  // a text block adjacent to it (before/after) as the colophon caption.
  let verifyBlock: VerifyBlock | undefined;
  let verifyIndex = -1;
  for (let j = 0; j < blocks.length; j++) {
    if (blocks[j].type === 'verify') {
      verifyBlock = blocks[j] as VerifyBlock;
      verifyIndex = j;
      break;
    }
  }
  let colophonText: string | undefined;
  const consumed = new Set<Block>();
  if (verifyBlock) {
    consumed.add(verifyBlock);
    const after = blocks[verifyIndex + 1];
    const before = blocks[verifyIndex - 1];
    if (after && after.type === 'text') {
      colophonText = (after as TextBlock).text;
      consumed.add(after);
    } else if (before && before.type === 'text') {
      colophonText = (before as TextBlock).text;
      consumed.add(before);
    }
  }

  const out: string[] = [renderHeader(def), renderProfile(def, ctx)];

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
      out.push(renderCards(group, ctx));
      continue;
    }
    switch (block.type) {
      case 'heading':
        out.push(`<h2 class="kicker">${escapeHtml(block.text)}</h2>`);
        break;
      case 'text':
        out.push(`<blockquote class="manifesto"><p>${multiline(block.text)}</p></blockquote>`);
        break;
      case 'divider':
        out.push(`<hr class="cut" aria-hidden="true">`);
        break;
      case 'social':
        out.push(renderSocial(block, ctx));
        break;
      case 'verify':
        // Handled via the footer colophon (pre-scan). A second verify is ignored.
        break;
      case 'image': {
        const src = safeImgSrc(block.src, ctx);
        if (src) {
          out.push(
            `<figure class="figure"><img class="img" src="${escapeAttr(src)}" ` +
              `alt="${escapeAttr(block.alt || '')}" loading="lazy" /></figure>`,
          );
        }
        break;
      }
      case 'embed': {
        const t = linkTarget(block.arweave, ctx);
        out.push(
          `<ul class="links"><li><a class="card" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
            `<span class="ico" aria-hidden="true"></span>` +
            `<span class="lbl">${escapeHtml(block.arweave)}</span>` +
            `<span class="arflag" aria-hidden="true">ar://</span>` +
            `<span class="arr" aria-hidden="true">&#8599;</span>` +
            `</a></li></ul>`,
        );
        break;
      }
    }
    i++;
  }

  const colophon = renderColophon(verifyBlock, colophonText, ctx);
  if (colophon) out.push(colophon);

  return `<main class="wrap">${out.join('')}</main>`;
}

export const xeroxRiotTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Xerox Riot',
    family: 'wildcard',
    description: 'DIY punk zine off a busted copier: photostat grain, taped flyer links, cut-here dividers.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default xeroxRiotTemplate;
