/**
 * The Arcana — a gilded tarot card for the permaweb: dark violet night sky,
 * twinkling stars, an alchemical sigil, and antique-gold engraving. Reproduces
 * docs/pages-templates/the-arcana.html as a block-driven module.
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
  resolveHandle,
  safeImgSrc,
  verifyTarget,
} from './shared';

const ID = 'the-arcana';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-the-arcana',
  template: 'the-arcana',
  title: 'Séraphine Vale — The Arcana',
  arnsName: 'arcana',
  profile: {
    avatar: '',
    displayName: 'Séraphine Vale',
    tagline: 'Keeper of Hidden Signals',
    handle: 'arcana.ar.io',
    bio: 'Diviner of the permaweb. I read the static between the stars and archive what the network dreams.',
  },
  blocks: [
    { type: 'heading', text: 'XXIII · The Arcana' },
    { type: 'link', label: 'Read the Grimoire', url: 'https://example.com/grimoire', icon: 'star' },
    { type: 'link', label: 'Book a Reading', url: 'https://example.com/reading', icon: 'star' },
    { type: 'link', label: 'The Nightly Dispatch', url: 'https://example.com/dispatch', icon: 'star' },
    { type: 'link', label: 'Collected Talismans', url: 'ar://arcana-talismans', icon: 'star' },
    { type: 'divider' },
    {
      type: 'social',
      items: [
        { platform: 'mastodon', url: 'https://mastodon.social/@seraphinevale' },
        { platform: 'bluesky', url: 'https://bsky.app/profile/seraphinevale' },
        { platform: 'newsletter', url: 'https://example.com/subscribe' },
        { platform: 'rss', url: 'https://example.com/feed.xml' },
      ],
    },
    {
      type: 'text',
      text: 'What is uploaded is never truly lost — only waiting to be drawn again.',
    },
    {
      type: 'verify',
      label: 'Permanent on Arweave',
      url: 'ar://pW8dK3nR7vX2mYqL5tZ9cH4jF6sB1aE0uG5oN7iB2xC',
    },
  ],
  theme: {
    colors: { bg: '#0E0B14', surface: '#171224', text: '#EFE6CF', accent: '#C9A227' },
    font: '"Iowan Old Style", "Palatino Linotype", Palatino, "URW Palladio L", "Book Antiqua", Georgia, "Times New Roman", serif',
    buttonShape: 'rounded',
    background: 'gilded-night-sky',
  },
  layout: { headerAlign: 'center', linkStyle: 'button', width: 'standard' },
};

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const bg = cssColor(c.bg, '#0E0B14');
  const surface = cssColor(c.surface, '#171224');
  const text = cssColor(c.text, '#EFE6CF');
  const accent = cssColor(c.accent, '#C9A227');
  const font = cssFontFamily(
    def.theme.font,
    '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Times New Roman", serif',
  );

  return `
:root { color-scheme: dark; }
.pg-${ID} {
  --bg: ${bg}; --surface: ${surface}; --text: ${text}; --accent: ${accent};
  --edge: #0A0810; --violet: #2A2140; --glow: #E8D48A; --shadow-gold: #9A7B1E;
  --parch: #B8AE94; --inset: #3A2E12; --fill: #1B1530;
  min-height: 100vh; margin: 0; padding: 28px 16px;
  display: flex; align-items: center; justify-content: center;
  color: var(--text);
  font-family: ${font};
  background:
    radial-gradient(1100px 760px at 50% -12%, #1b1436 0%, transparent 62%),
    radial-gradient(circle at 82% 8%, rgba(232, 212, 138, .06), transparent 34%),
    var(--bg);
}
.pg-${ID} * { box-sizing: border-box; }
.pg-${ID} .card {
  position: relative; width: 100%; max-width: 440px; padding: 36px 26px 30px;
  border: 1px solid var(--accent); border-radius: 18px;
  background: radial-gradient(125% 85% at 50% 0%, #1e1738 0%, var(--surface) 55%, #110d1d 100%);
  box-shadow: 0 0 0 1px rgba(201, 162, 39, .22), inset 0 0 0 1px rgba(42, 33, 64, .9), inset 0 0 44px rgba(10, 8, 16, .85), 0 22px 60px rgba(0, 0, 0, .55);
  overflow: hidden;
}
.pg-${ID} .card::before { content: ""; position: absolute; inset: 10px; border: 1px solid rgba(201, 162, 39, .42); border-radius: 12px; pointer-events: none; }
.pg-${ID} .corner { position: absolute; width: 14px; height: 14px; background: var(--accent); opacity: .75; pointer-events: none; clip-path: polygon(50% 0, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0 50%, 42% 42%); }
.pg-${ID} .corner.tl { top: 16px; left: 16px; }
.pg-${ID} .corner.tr { top: 16px; right: 16px; }
.pg-${ID} .corner.bl { bottom: 16px; left: 16px; }
.pg-${ID} .corner.br { bottom: 16px; right: 16px; }
.pg-${ID} .stars { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.pg-${ID} .stars i { position: absolute; width: 2px; height: 2px; border-radius: 50%; background: var(--glow); opacity: .5; box-shadow: 0 0 6px rgba(232, 212, 138, .55); }
@media (prefers-reduced-motion: no-preference) {
  .pg-${ID} .stars i { animation: pg-tw-${ID} 3.4s ease-in-out infinite; }
  .pg-${ID} .stars i:nth-child(2n) { animation-duration: 4.6s; animation-delay: .6s; }
  .pg-${ID} .stars i:nth-child(3n) { animation-duration: 5.5s; animation-delay: 1.4s; }
  .pg-${ID} .stars i:nth-child(4n) { animation-duration: 4.1s; animation-delay: 2.1s; }
}
@keyframes pg-tw-${ID} { 0%, 100% { opacity: .18; } 50% { opacity: .9; } }
.pg-${ID} .head { position: relative; text-align: center; }
.pg-${ID} .numeral { font-size: .72rem; letter-spacing: .42em; text-transform: uppercase; color: var(--accent); margin: 0 0 20px; padding-left: .42em; }
.pg-${ID} .sigil { position: relative; width: 98px; height: 98px; margin: 0 auto 18px; border-radius: 50%; border: 1px solid rgba(201, 162, 39, .5); background: radial-gradient(circle at 50% 42%, #251b40, #110c20); box-shadow: inset 0 0 22px rgba(10, 8, 16, .9), 0 0 26px rgba(232, 212, 138, .1); }
.pg-${ID} .moon { position: absolute; inset: 0; }
.pg-${ID} .moon::before, .pg-${ID} .moon::after { content: ""; position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; border-radius: 50%; }
.pg-${ID} .moon::before { transform: translate(-60%, -50%); background: radial-gradient(circle at 36% 34%, #E8D48A, #C9A227 68%, #9A7B1E); box-shadow: 0 0 16px rgba(232, 212, 138, .4); }
.pg-${ID} .moon::after { transform: translate(-40%, -52%); background: radial-gradient(circle at 50% 42%, #251b40, #110c20 78%); }
@media (prefers-reduced-motion: no-preference) { .pg-${ID} .moon::before { animation: pg-glow-${ID} 4.5s ease-in-out infinite; } }
@keyframes pg-glow-${ID} { 0%, 100% { box-shadow: 0 0 14px rgba(232, 212, 138, .32); } 50% { box-shadow: 0 0 28px rgba(232, 212, 138, .62); } }
.pg-${ID} .sigil .portrait { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 50%; object-fit: cover; filter: sepia(.18) saturate(.9) brightness(.96); }
.pg-${ID} .sigil:has(.portrait) { background: #110c20; }
.pg-${ID} .name { font-size: 1.85rem; font-weight: 600; line-height: 1.1; margin: 0 0 8px; letter-spacing: .01em; }
.pg-${ID} .tagline { font-size: .72rem; letter-spacing: .26em; text-transform: uppercase; color: var(--accent); margin: 0 0 14px; }
.pg-${ID} .handle { display: inline-flex; align-items: center; gap: 8px; font-size: .68rem; letter-spacing: .14em; color: var(--accent); text-decoration: none; background: rgba(201, 162, 39, .08); border: 1px solid rgba(201, 162, 39, .32); border-radius: 999px; padding: 5px 13px 5px 11px; margin: 0 0 16px; transition: border-color .2s ease, box-shadow .2s ease, color .2s ease; }
.pg-${ID} .handle::before { content: ""; width: 6px; height: 6px; flex: 0 0 6px; background: var(--accent); clip-path: polygon(50% 0, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0 50%, 42% 42%); }
.pg-${ID} .handle:hover { color: var(--glow); border-color: var(--glow); box-shadow: 0 0 16px rgba(232, 212, 138, .16); }
.pg-${ID} .handle:hover::before { background: var(--glow); }
.pg-${ID} .handle:focus-visible { outline: 2px solid var(--glow); outline-offset: 2px; }
.pg-${ID} .bio { font-size: .95rem; line-height: 1.6; color: var(--parch); font-style: italic; margin: 0 auto; max-width: 32ch; }
.pg-${ID} .rule { display: flex; align-items: center; gap: 12px; margin: 24px 2px; }
.pg-${ID} .rule::before, .pg-${ID} .rule::after { content: ""; height: 1px; flex: 1; background: linear-gradient(90deg, transparent, rgba(201, 162, 39, .55), transparent); }
.pg-${ID} .rule i { width: 12px; height: 12px; background: var(--accent); clip-path: polygon(50% 0, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0 50%, 42% 42%); }
.pg-${ID} .section { font-size: .72rem; letter-spacing: .42em; text-transform: uppercase; color: var(--accent); text-align: center; margin: 22px 0 4px; }
.pg-${ID} .links { display: flex; flex-direction: column; gap: 12px; margin-top: 26px; }
.pg-${ID} .link { display: flex; align-items: center; gap: 14px; min-height: 54px; padding: 0 18px; border-radius: 12px; text-decoration: none; color: var(--text); font-size: .78rem; letter-spacing: .15em; text-transform: uppercase; background: linear-gradient(180deg, #201839, #161029); border: 1px solid rgba(201, 162, 39, .42); box-shadow: inset 0 1px 0 rgba(232, 212, 138, .08), inset 0 -2px 0 rgba(154, 123, 30, .28), 0 2px 6px rgba(0, 0, 0, .4); transition: border-color .2s ease, box-shadow .2s ease, transform .12s ease; }
.pg-${ID} .link .ico { width: 15px; height: 15px; flex: 0 0 15px; background: var(--accent); clip-path: polygon(50% 0, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0 50%, 42% 42%); transition: background .2s ease; }
.pg-${ID} .link span.txt { flex: 1; }
.pg-${ID} .link .armark { flex: 0 0 auto; font-size: .58rem; letter-spacing: .06em; text-transform: none; color: var(--accent); border: 1px solid rgba(201, 162, 39, .4); border-radius: 6px; padding: 2px 6px; opacity: .85; transition: color .2s ease, border-color .2s ease; }
.pg-${ID} .link:hover { border-color: var(--glow); box-shadow: inset 0 0 0 1px rgba(232, 212, 138, .28), 0 0 22px rgba(232, 212, 138, .16); transform: translateY(-1px); }
.pg-${ID} .link:hover .ico { background: var(--glow); }
.pg-${ID} .link:hover .armark { color: var(--glow); border-color: var(--glow); }
.pg-${ID} .link:active { background: linear-gradient(180deg, #140f24, #1b1531); box-shadow: inset 0 2px 6px rgba(10, 8, 16, .9), inset 0 0 0 1px rgba(58, 46, 18, .9); transform: translateY(0); }
.pg-${ID} .link:focus-visible { outline: 2px solid var(--glow); outline-offset: 2px; }
.pg-${ID} .social { display: flex; justify-content: center; flex-wrap: wrap; gap: 14px; margin-top: 22px; }
.pg-${ID} .social a { display: flex; align-items: center; justify-content: center; width: 46px; height: 46px; border-radius: 50%; color: var(--text); text-decoration: none; font-size: .85rem; letter-spacing: .04em; font-weight: 600; background: radial-gradient(circle at 50% 32%, #201839, #140f24); border: 1px solid rgba(201, 162, 39, .42); box-shadow: inset 0 0 10px rgba(10, 8, 16, .7); transition: border-color .2s ease, box-shadow .2s ease, color .2s ease; }
.pg-${ID} .social a:hover { border-color: var(--glow); color: var(--glow); box-shadow: 0 0 18px rgba(232, 212, 138, .2); }
.pg-${ID} .social a:focus-visible { outline: 2px solid var(--glow); outline-offset: 2px; }
.pg-${ID} .figure { margin: 22px 0 0; text-align: center; }
.pg-${ID} .figure img { display: block; max-width: 100%; height: auto; margin: 0 auto; border-radius: 12px; border: 1px solid rgba(201, 162, 39, .42); box-shadow: 0 0 18px rgba(10, 8, 16, .6); }
.pg-${ID} .fortune { text-align: center; font-style: italic; color: var(--parch); font-size: .9rem; line-height: 1.6; margin: 26px 4px 4px; }
.pg-${ID} .fortune::before { content: "\\201C"; }
.pg-${ID} .fortune::after { content: "\\201D"; }
.pg-${ID} .permalink { display: inline-flex; align-items: center; justify-content: center; gap: 9px; width: 100%; margin: 20px auto 0; color: var(--parch); text-decoration: none; font-size: .62rem; letter-spacing: .24em; text-transform: uppercase; transition: color .2s ease; }
.pg-${ID} .permalink .lock { position: relative; display: inline-block; width: 11px; height: 8px; margin-top: 5px; border-radius: 2px; background: currentColor; }
.pg-${ID} .permalink .lock::before { content: ""; position: absolute; left: 50%; top: -6px; transform: translateX(-50%); width: 7px; height: 8px; border: 1.5px solid currentColor; border-bottom: none; border-radius: 6px 6px 0 0; }
.pg-${ID} .permalink:hover { color: var(--glow); }
.pg-${ID} .permalink:focus-visible { outline: 2px solid var(--glow); outline-offset: 3px; border-radius: 6px; }
@media (prefers-color-scheme: light) {
  .pg-${ID} .card { border: 2px solid var(--accent); box-shadow: 0 8px 40px rgba(0, 0, 0, .5), inset 0 0 0 1px rgba(42, 33, 64, .9), inset 0 0 44px rgba(10, 8, 16, .85); }
}
@media (prefers-reduced-motion: reduce) {
  .pg-${ID} .stars i, .pg-${ID} .moon::before, .pg-${ID} .link, .pg-${ID} .handle, .pg-${ID} .social a, .pg-${ID} .permalink { animation: none !important; transition: none !important; }
}
`.trim();
}

const STARS =
  '<div class="stars" aria-hidden="true">' +
  '<i style="top:8%;left:14%"></i><i style="top:16%;left:78%"></i>' +
  '<i style="top:26%;left:40%"></i><i style="top:34%;left:88%"></i>' +
  '<i style="top:44%;left:9%"></i><i style="top:52%;left:64%"></i>' +
  '<i style="top:63%;left:22%"></i><i style="top:71%;left:82%"></i>' +
  '<i style="top:80%;left:48%"></i><i style="top:88%;left:16%"></i>' +
  '<i style="top:12%;left:56%"></i><i style="top:58%;left:92%"></i>' +
  '</div>';

const CORNERS =
  '<span class="corner tl" aria-hidden="true"></span>' +
  '<span class="corner tr" aria-hidden="true"></span>' +
  '<span class="corner bl" aria-hidden="true"></span>' +
  '<span class="corner br" aria-hidden="true"></span>';

const RULE = '<div class="rule" aria-hidden="true"><i></i></div>';

/** Two-letter arcana sigil for a social platform (falls back to a star). */
function socialGlyph(platform: string): string {
  const s = platform.trim();
  if (!s) return '✦';
  const letters = s.replace(/[^A-Za-z0-9]/g, '');
  if (!letters) return '✦';
  const first = letters[0].toUpperCase();
  const second = letters.length > 1 ? letters[1].toLowerCase() : '';
  return `${first}${second}`;
}

function renderHeader(def: PageDef, ctx: RenderCtx, numeral: string): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  const parts: string[] = [];
  if (numeral) parts.push(`<p class="numeral">${escapeHtml(numeral)}</p>`);
  const avatarSrc = p.avatar ? safeImgSrc(p.avatar, ctx) : '';
  const sigilInner = avatarSrc
    ? `<img class="portrait" src="${escapeAttr(avatarSrc)}" alt="${escapeAttr(p.displayName)}" loading="lazy" />`
    : '<span class="moon"></span>';
  parts.push(`<div class="sigil" aria-hidden="true">${sigilInner}</div>`);
  parts.push(`<h1 class="name">${escapeHtml(p.displayName)}</h1>`);
  if (p.tagline) parts.push(`<p class="tagline">${escapeHtml(p.tagline)}</p>`);
  if (handle) {
    parts.push(
      `<a class="handle" href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)} ` +
        `aria-label="${escapeAttr(`ArNS handle: ${handle.text}`)}">${escapeHtml(handle.text)}</a>`,
    );
  }
  if (p.bio) parts.push(`<p class="bio">${escapeHtml(p.bio)}</p>`);
  return `<header class="head">${parts.join('')}</header>`;
}

function renderLink(link: LinkBlock, ctx: RenderCtx): string {
  const t = linkTarget(link.url, ctx);
  const armark = t.isAr ? '<span class="armark" aria-hidden="true">ar://</span>' : '';
  return (
    `<a class="link" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    `<span class="ico" aria-hidden="true"></span>` +
    `<span class="txt">${escapeHtml(link.label)}</span>${armark}</a>`
  );
}

function renderSocial(block: SocialBlock, ctx: RenderCtx): string {
  const links = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      return (
        `<a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)} ` +
        `aria-label="${escapeAttr(item.platform)}"><span aria-hidden="true">${escapeHtml(socialGlyph(item.platform))}</span></a>`
      );
    })
    .join('');
  return `<div class="social">${links}</div>`;
}

function renderPermalink(block: VerifyBlock, ctx: RenderCtx): string {
  const v = verifyTarget(block, ctx);
  const label = block.label || 'Permanent on Arweave';
  if (!v) {
    return `<p class="permalink"><span class="lock" aria-hidden="true"></span>${escapeHtml(label)}</p>`;
  }
  return (
    `<a class="permalink" href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)} ` +
    `aria-label="${escapeAttr(`${label} — verify this page's transaction`)}">` +
    `<span class="lock" aria-hidden="true"></span>${escapeHtml(label)}</a>`
  );
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const blocks = def.blocks;

  // The first heading becomes the arcana numeral in the header (chrome pulled
  // out of the main flow, like a card's roman numeral).
  let numeral = '';
  let numeralBlock: Block | null = null;
  for (const b of blocks) {
    if (b.type === 'heading') {
      numeral = b.text;
      numeralBlock = b;
      break;
    }
  }

  const out: string[] = [STARS, CORNERS, renderHeader(def, ctx, numeral), RULE];

  let i = 0;
  while (i < blocks.length) {
    const block: Block = blocks[i];
    if (block === numeralBlock) {
      i++;
      continue;
    }

    if (block.type === 'link') {
      const buttons: string[] = [];
      while (i < blocks.length && blocks[i].type === 'link') {
        buttons.push(renderLink(blocks[i] as LinkBlock, ctx));
        i++;
      }
      out.push(`<nav class="links" aria-label="Links">${buttons.join('')}</nav>`);
      continue;
    }

    switch (block.type) {
      case 'heading':
        out.push(`<p class="section">${escapeHtml(block.text)}</p>`);
        break;
      case 'divider':
        out.push(RULE);
        break;
      case 'social':
        out.push(renderSocial(block, ctx));
        break;
      case 'text':
        out.push(`<p class="fortune">${escapeHtml(block.text)}</p>`);
        break;
      case 'verify':
        out.push(renderPermalink(block, ctx));
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
        const armark = t.isAr ? '<span class="armark" aria-hidden="true">ar://</span>' : '';
        out.push(
          `<nav class="links" aria-label="Embedded resource">` +
            `<a class="link" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
            `<span class="ico" aria-hidden="true"></span>` +
            `<span class="txt">${escapeHtml(block.arweave)}</span>${armark}</a></nav>`,
        );
        break;
      }
    }
    i++;
  }

  return `<main class="card">${out.join('')}</main>`;
}

export const theArcanaTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'The Arcana',
    family: 'wildcard',
    description: 'A gilded tarot card for the permaweb — violet night sky, alchemical sigil, antique gold.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default theArcanaTemplate;
