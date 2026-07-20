/**
 * Teletext — a Ceefax-style broadcast page: pure black screen, blocky monospace
 * text in the classic teletext palette (white/yellow/cyan/green/magenta), a top
 * header row with a faux page number, colored index rows for links, and the
 * signature FASTEXT colored bar (red/green/yellow/cyan) at the foot. All colors
 * are CSS gradients + solid fills — self-contained, no external assets, no `url(`.
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

// Not yet in the TemplateId union — the registry/schema add it. Cast so this
// module type-checks standalone without editing schema.ts.
const ID = 'teletext' as unknown as import('../schema').TemplateId;

const DEFAULT_FONT =
  '"Courier New", "DejaVu Sans Mono", "Liberation Mono", Consolas, Menlo, ui-monospace, monospace';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-teletext',
  template: ID,
  title: 'CEEFAX 100',
  arnsName: 'ceefax',
  profile: {
    avatar: '',
    displayName: 'Permaweb Ceefax',
    tagline: 'The broadcast page that never goes off-air',
    handle: 'ceefax.ar.io',
    bio: 'You are watching the permaweb teletext service. Use the coloured FASTEXT keys below to jump between pages. Hold the page? Just refresh — it is stored forever on Arweave.',
  },
  blocks: [
    { type: 'heading', text: 'Headlines' },
    { type: 'text', text: 'Good evening. Here is the news, on the page that outlives the broadcast.' },
    { type: 'link', label: 'Top Stories', url: '#news' },
    { type: 'link', label: 'Weather Outlook', url: '#weather' },
    { type: 'link', label: 'Sport Round-Up', url: '#sport' },
    { type: 'link', label: 'Permaweb Archive', url: 'ar://ceefax-archive' },
    { type: 'link', label: 'TV Listings', url: '#tv' },
    { type: 'divider' },
    { type: 'heading', text: 'Contact The Studio' },
    {
      type: 'social',
      items: [
        { platform: 'X', url: '#' },
        { platform: 'Mastodon', url: '#' },
        { platform: 'Email', url: '#' },
        { platform: 'RSS', url: '#' },
      ],
    },
    { type: 'divider' },
    { type: 'text', text: 'Press REVEAL to hold. Coloured keys select pages. AR/IO Broadcast Service.' },
    { type: 'verify', label: 'Permanent on Arweave', url: '#' },
  ],
  theme: {
    colors: { bg: '#000000', surface: '#111111', text: '#FFFFFF', accent: '#00FFFF' },
    font: DEFAULT_FONT,
    buttonShape: 'square',
    background: 'teletext-crt-black',
  },
  layout: { headerAlign: 'left', linkStyle: 'button', width: 'standard' },
};

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const bg = cssColor(c.bg, '#000000');
  const surface = cssColor(c.surface, '#111111');
  const text = cssColor(c.text, '#FFFFFF');
  const accent = cssColor(c.accent, '#00FFFF');
  const font = cssFontFamily(def.theme.font, DEFAULT_FONT);

  return `
:root { color-scheme: only dark; }
.pg-${ID} {
  --bg: ${bg}; --surface: ${surface}; --text: ${text}; --accent: ${accent};
  --white: #FFFFFF; --yellow: #FFFF00; --cyan: #00FFFF; --green: #00FF00;
  --magenta: #FF00FF; --red: #FF0000; --blue: #0000FF; --black: #000000;
  font-family: ${font}; background: var(--bg); color: var(--text);
  min-height: 100vh; padding: 14px 10px; line-height: 1.45;
  font-size: 16px; letter-spacing: .04em; -webkit-text-size-adjust: 100%;
}
.pg-${ID} * { box-sizing: border-box; }
.pg-${ID} .crt {
  position: relative; max-width: 640px; margin: 0 auto; background: var(--black);
  border: 2px solid #202020; padding: 10px clamp(8px, 3vw, 16px) 0; overflow: hidden;
}
.pg-${ID} .crt::after {
  content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 5;
  background: repeating-linear-gradient(0deg, rgba(0,0,0,.35) 0 1px, transparent 1px 3px);
}
.pg-${ID} .hdr {
  display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
  color: var(--white); padding: 2px 0 8px; border-bottom: 2px solid var(--blue);
  text-transform: uppercase; font-weight: bold;
}
.pg-${ID} .pno { color: var(--green); flex: 0 0 auto; }
.pg-${ID} h1 {
  flex: 1 1 auto; min-width: 0; margin: 0; font-size: clamp(18px, 5vw, 26px);
  color: var(--yellow); letter-spacing: .06em; word-break: break-word;
  text-shadow: 0 0 6px rgba(255,255,0,.35);
}
.pg-${ID} .htag { flex: 0 0 auto; color: var(--cyan); }
.pg-${ID} .node { margin: 8px 0 2px; color: var(--cyan); word-break: break-all; }
.pg-${ID} .node .dot { color: var(--green); }
.pg-${ID} .node a { color: var(--cyan); text-decoration: none; font-weight: bold; }
.pg-${ID} .node a:hover { color: var(--white); text-decoration: underline; }
.pg-${ID} .tag { margin: 0 0 6px; color: var(--green); text-transform: uppercase; word-break: break-word; }
.pg-${ID} .page { padding: 10px 0 12px; }
.pg-${ID} h2 {
  margin: 16px 0 8px; color: var(--cyan); font-size: clamp(18px, 5.5vw, 24px);
  font-weight: bold; text-transform: uppercase; letter-spacing: .06em; line-height: 1.1;
  text-shadow: 0 0 6px rgba(0,255,255,.35); word-break: break-word;
}
.pg-${ID} h2:first-child { margin-top: 4px; }
.pg-${ID} p.prose { margin: 0 0 10px; color: var(--white); word-break: break-word; }
.pg-${ID} p.bio { margin: 0 0 12px; color: var(--white); word-break: break-word; }
.pg-${ID} .index { list-style: none; margin: 0 0 10px; padding: 0; }
.pg-${ID} .index li { margin: 0; }
.pg-${ID} .index a {
  display: flex; align-items: baseline; gap: 10px; min-height: 40px; padding: 6px 6px;
  text-decoration: none; color: var(--white); border-left: 6px solid var(--white);
}
.pg-${ID} .index a .pn { flex: 0 0 auto; font-weight: bold; }
.pg-${ID} .index a .lbl { flex: 1 1 auto; text-transform: uppercase; word-break: break-word; }
.pg-${ID} .index a .lead { flex: 0 0 auto; }
.pg-${ID} .index a .ar { flex: 0 0 auto; font-size: .8em; }
.pg-${ID} .index a:hover, .pg-${ID} .index a:focus-visible { background: var(--surface); outline: none; }
.pg-${ID} .index .row-cyan a { border-left-color: var(--cyan); color: var(--cyan); }
.pg-${ID} .index .row-green a { border-left-color: var(--green); color: var(--green); }
.pg-${ID} .index .row-yellow a { border-left-color: var(--yellow); color: var(--yellow); }
.pg-${ID} .index .row-white a { border-left-color: var(--white); color: var(--white); }
.pg-${ID} .index .row-magenta a { border-left-color: var(--magenta); color: var(--magenta); }
.pg-${ID} .index a .pn { color: var(--white); }
.pg-${ID} .social { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 0 0 12px; }
.pg-${ID} .social a { text-decoration: none; text-transform: uppercase; font-weight: bold; color: var(--white); }
.pg-${ID} .social a .k { color: var(--black); background: var(--cyan); padding: 0 5px; margin-right: 6px; }
.pg-${ID} .social a:nth-child(2n) .k { background: var(--green); }
.pg-${ID} .social a:nth-child(3n) .k { background: var(--yellow); }
.pg-${ID} .social a:hover { color: var(--yellow); }
.pg-${ID} .bar { height: 16px; margin: 12px 0; border: 0; background: repeating-linear-gradient(90deg, var(--red) 0 12.5%, var(--yellow) 0 25%, var(--green) 0 37.5%, var(--cyan) 0 50%, var(--white) 0 62.5%, var(--magenta) 0 75%, var(--blue) 0 87.5%, var(--red) 0 100%); }
.pg-${ID} .figure { margin: 0 0 12px; border: 2px solid var(--blue); padding: 4px; display: inline-block; max-width: 100%; }
.pg-${ID} .figure img { display: block; max-width: 100%; height: auto; }
.pg-${ID} .figure figcaption { margin-top: 4px; color: var(--cyan); text-transform: uppercase; font-size: .85em; }
.pg-${ID} .embed { margin: 0 0 10px; }
.pg-${ID} .embed a { color: var(--green); text-decoration: none; word-break: break-all; }
.pg-${ID} .embed a:hover { text-decoration: underline; color: var(--white); }
.pg-${ID} .verifyrow { margin: 12px 0 10px; }
.pg-${ID} .verify { display: inline-flex; align-items: baseline; gap: 8px; text-decoration: none; color: var(--green); text-transform: uppercase; word-break: break-word; }
.pg-${ID} .verify .chk { color: var(--black); background: var(--green); padding: 0 5px; font-weight: bold; }
.pg-${ID} .verify:hover { color: var(--white); }
.pg-${ID} .verify:hover .chk { background: var(--white); }
.pg-${ID} .fastext { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; margin: 4px 0 12px; }
.pg-${ID} .ft {
  display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 8px 10px;
  text-decoration: none; color: var(--black); font-weight: bold; text-transform: uppercase;
  letter-spacing: .04em; overflow: hidden;
}
.pg-${ID} .ft .ft-key { flex: 0 0 auto; width: 14px; height: 14px; background: var(--black); }
.pg-${ID} .ft .ft-lbl { flex: 1 1 auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pg-${ID} .ft-red { background: var(--red); color: var(--white); }
.pg-${ID} .ft-green { background: var(--green); }
.pg-${ID} .ft-yellow { background: var(--yellow); }
.pg-${ID} .ft-cyan { background: var(--cyan); }
.pg-${ID} .ft:hover { filter: brightness(1.15); }
.pg-${ID} a:focus-visible { outline: 2px solid var(--white); outline-offset: 2px; }
@media (min-width: 560px) { .pg-${ID} .fastext { grid-template-columns: repeat(4, 1fr); } }
@media (prefers-reduced-motion: reduce) { .pg-${ID} * { transition: none !important; } }
`.trim();
}

const ROW_COLORS = ['row-cyan', 'row-green', 'row-yellow', 'row-white', 'row-magenta'];

interface Target {
  href: string;
  dataAr: string;
}

function shortLabel(label: string, fallback: string): string {
  const s = (label || '').trim();
  const base = s || fallback;
  return base.length > 16 ? base.slice(0, 15) + '…' : base;
}

function fastextSegment(color: string, label: string, target: Target | null): string {
  const inner =
    `<span class="ft-key" aria-hidden="true"></span>` +
    `<span class="ft-lbl">${escapeHtml(label)}</span>`;
  if (target) {
    return `<a class="ft ft-${color}" href="${escapeAttr(safeHref(target.href))}"${dataArAttr(target.dataAr)}>${inner}</a>`;
  }
  return `<span class="ft ft-${color}">${inner}</span>`;
}

function renderFastext(def: PageDef, links: LinkBlock[], verify: VerifyBlock | undefined, ctx: RenderCtx): string {
  const home = resolveHandle(def, ctx);
  const l0 = links[0] ? linkTarget(links[0].url, ctx) : null;
  const l1 = links[1] ? linkTarget(links[1].url, ctx) : null;
  const l2 = links[2] ? linkTarget(links[2].url, ctx) : null;
  const v = verifyTarget(verify, ctx);

  const segs: string[] = [
    fastextSegment('red', 'Index', home ? { href: home.href, dataAr: home.dataAr } : null),
    fastextSegment('green', shortLabel(links[0]?.label || '', 'A–Z'), l0),
    fastextSegment('yellow', shortLabel(links[1]?.label || '', 'News'), l1),
    v
      ? fastextSegment('cyan', 'Verify', { href: v.href, dataAr: v.dataAr })
      : fastextSegment('cyan', shortLabel(links[2]?.label || '', 'Help'), l2),
  ];
  return `<div class="fastext">${segs.join('')}</div>`;
}

function renderHeader(def: PageDef, ctx: RenderCtx): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  const parts: string[] = [
    `<div class="hdr"><span class="pno">P100</span>` +
      `<h1>${escapeHtml(p.displayName)}</h1>` +
      `<span class="htag" aria-hidden="true">AR/IO</span></div>`,
  ];
  if (handle) {
    parts.push(
      `<p class="node"><span class="dot" aria-hidden="true">&#9673;</span> ` +
        `<a href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)}>${escapeHtml(handle.text)}</a></p>`,
    );
  }
  if (p.tagline) parts.push(`<p class="tag">${escapeHtml(p.tagline)}</p>`);
  if (p.bio) parts.push(`<p class="bio">${multiline(p.bio)}</p>`);
  const avatarSrc = p.avatar ? safeImgSrc(p.avatar, ctx) : '';
  if (avatarSrc) {
    parts.push(
      `<figure class="figure"><img src="${escapeAttr(avatarSrc)}" alt="${escapeAttr(p.displayName)}" loading="lazy" /></figure>`,
    );
  }
  return parts.join('');
}

function renderIndex(group: LinkBlock[], start: number, ctx: RenderCtx): string {
  const items = group
    .map((link, idx) => {
      const t = linkTarget(link.url, ctx);
      const color = ROW_COLORS[(start + idx) % ROW_COLORS.length];
      const pn = String(200 + start + idx);
      const ar = t.isAr ? `<span class="ar" aria-hidden="true">ar://</span>` : '';
      return (
        `<li class="${color}"><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
        `<span class="pn">${escapeHtml(pn)}</span>` +
        `<span class="lbl">${escapeHtml(link.label)}</span>` +
        ar +
        `</a></li>`
      );
    })
    .join('');
  return `<ul class="index">${items}</ul>`;
}

function renderSocial(block: SocialBlock, ctx: RenderCtx): string {
  const items = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      const plat = item.platform.trim();
      const k = plat ? plat.charAt(0).toUpperCase() : '·';
      return (
        `<a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
        `<span class="k" aria-hidden="true">${escapeHtml(k)}</span>${escapeHtml(item.platform)}</a>`
      );
    })
    .join('');
  return `<div class="social">${items}</div>`;
}

function renderVerify(verify: VerifyBlock | undefined, ctx: RenderCtx): string {
  const v = verifyTarget(verify, ctx);
  if (!v) return '';
  const label = verify && verify.label ? verify.label : 'Permanent on Arweave';
  return (
    `<p class="verifyrow"><a class="verify" href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)}>` +
    `<span class="chk" aria-hidden="true">&#10003;</span>${escapeHtml(label)}</a></p>`
  );
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const blocks = def.blocks;

  // Collect link blocks (for FASTEXT) and pull the first verify block to the foot.
  const linkBlocks: LinkBlock[] = [];
  let verifyBlock: VerifyBlock | undefined;
  const consumed = new Set<Block>();
  for (const b of blocks) {
    if (b.type === 'link') linkBlocks.push(b);
    else if (b.type === 'verify' && !verifyBlock) {
      verifyBlock = b;
      consumed.add(b);
    }
  }

  const out: string[] = [renderHeader(def, ctx)];
  let linkCount = 0;
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
      out.push(renderIndex(group, linkCount, ctx));
      linkCount += group.length;
      continue;
    }
    switch (block.type) {
      case 'heading':
        if (block.text) out.push(`<h2>${escapeHtml(block.text)}</h2>`);
        break;
      case 'text':
        if (block.text) out.push(`<p class="prose">${multiline(block.text)}</p>`);
        break;
      case 'social':
        out.push(renderSocial(block, ctx));
        break;
      case 'divider':
        out.push(`<hr class="bar" aria-hidden="true" />`);
        break;
      case 'image': {
        const src = safeImgSrc(block.src, ctx);
        if (src) {
          out.push(
            `<figure class="figure"><img src="${escapeAttr(src)}" alt="${escapeAttr(block.alt || '')}" loading="lazy" />` +
              (block.alt ? `<figcaption>${escapeHtml(block.alt)}</figcaption>` : '') +
              `</figure>`,
          );
        }
        break;
      }
      case 'embed': {
        const t = linkTarget(block.arweave, ctx);
        out.push(
          `<p class="embed"><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>${escapeHtml(block.arweave)}</a></p>`,
        );
        break;
      }
      case 'verify':
        // Routed to the foot via pre-scan; extras ignored.
        break;
    }
    i++;
  }

  const verifyRow = renderVerify(verifyBlock, ctx);
  const page = `<div class="page">${out.join('')}${verifyRow}</div>`;
  const fastext = renderFastext(def, linkBlocks, verifyBlock, ctx);

  return `<div class="crt">${page}${fastext}</div>`;
}

export const teletextTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Teletext',
    family: 'classic',
    description: 'A Ceefax-style broadcast page: black CRT, blocky teletext colors, FASTEXT keys.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default teletextTemplate;
