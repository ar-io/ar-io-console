/**
 * The Masthead — a cream-stock broadsheet nameplate: double-rule frame, a
 * drop-capped lede, a numbered "Contents" ledger, small-caps correspondence,
 * and an ink-and-paper colophon. Reproduces docs/pages-templates/the-masthead.html
 * as a block-driven module. Ships a CSS-only Auto/Day/Night edition switch.
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

const ID = 'the-masthead';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-the-masthead',
  template: 'the-masthead',
  title: 'Eleanor J. Vance',
  arnsName: 'eleanorvance',
  profile: {
    avatar: '',
    displayName: 'Eleanor J. Vance',
    tagline: 'Essayist & Editor-at-Large',
    handle: 'eleanorvance.ar.io',
    bio: 'Writing from a narrow desk above the harbour, Eleanor keeps a standing quarrel with the ordinary — the ferry timetable, the price of pears, the manners of committees. Her columns have run in the weekend papers for a dozen winters, and her first collection, Marginalia, is out this autumn. She reads letters slowly and answers most of them.',
  },
  blocks: [
    { type: 'heading', text: 'Contents' },
    { type: 'link', label: 'Marginalia — the new collection', url: 'https://example.com/marginalia', icon: 'feature' },
    { type: 'link', label: 'The Sunday Ledger — weekly dispatch', url: 'https://example.com/newsletter', icon: 'newsletter' },
    { type: 'link', label: 'Field Notes from the Harbour', url: 'ar://harbournotes', icon: 'longread' },
    { type: 'link', label: 'The Correspondence Desk', url: 'https://example.com/contact', icon: 'contact' },
    { type: 'divider' },
    { type: 'heading', text: 'Correspondence' },
    {
      type: 'social',
      items: [
        { platform: 'twitter', url: 'https://twitter.com/' },
        { platform: 'instagram', url: 'https://instagram.com/' },
        { platform: 'email', url: 'mailto:letters@example.com' },
        { platform: 'rss', url: 'https://example.com/rss' },
      ],
    },
    {
      type: 'verify',
      label: 'Permanent on Arweave',
      url: 'ar://kQ8vX2mLpR7nT4wZ1cB9jD6fH0sYaeGu5oN8rVbWx_Q',
    },
  ],
  theme: {
    colors: { bg: '#FBF7EF', surface: '#F4EDE1', text: '#1C1B18', accent: '#7A1E1E' },
    font: "Georgia, 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Palatino, 'Times New Roman', serif",
    buttonShape: 'square',
    background:
      'cream stock #FBF7EF with 1px ink hairline rules, double-rule nameplate frame, and a faint paper-grain speckle',
  },
  layout: { headerAlign: 'center', linkStyle: 'card', width: 'standard' },
};

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const bg = cssColor(c.bg, '#FBF7EF');
  const surface = cssColor(c.surface, '#F4EDE1');
  const text = cssColor(c.text, '#1C1B18');
  const accent = cssColor(c.accent, '#7A1E1E');
  const label = hexToRgba(c.text, 0.55);
  const rule = text;
  const ruleTint = hexToRgba(c.text, 0.14);
  const speck = hexToRgba(c.text, 0.035);
  const font = cssFontFamily(
    def.theme.font,
    "Georgia, 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Palatino, 'Times New Roman', serif",
  );

  const lightVars =
    `--bg: ${bg}; --surface: ${surface}; --text: ${text}; --accent: ${accent}; ` +
    `--accent-press: ${accent}; --label: ${label}; --rule: ${rule}; --rule-tint: ${ruleTint}; --speck: ${speck};`;
  const darkVars =
    `--bg: #0F0E0C; --surface: #161512; --text: #EDE6D8; --accent: ${accent}; ` +
    `--accent-press: ${accent}; --label: rgba(237, 230, 216, 0.55); --rule: #EDE6D8; ` +
    `--rule-tint: rgba(237, 230, 216, 0.16); --speck: rgba(237, 230, 216, 0.012);`;

  return `
.pg-${ID} * { box-sizing: border-box; }
.pg-${ID} {
  ${lightVars}
  font-family: ${font};
  color: var(--text); background-color: var(--bg);
  background-image: radial-gradient(var(--speck) 0.5px, transparent 0.6px);
  background-size: 3px 3px; min-height: 100vh; line-height: 1.55;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
@media (prefers-color-scheme: dark) {
  .pg-${ID}:has(#ed-system:checked) { ${darkVars} }
}
.pg-${ID}:has(#ed-dark:checked) { ${darkVars} }
.pg-${ID}:has(#ed-light:checked) { ${lightVars} }
.pg-${ID} .paper { max-width: 44rem; margin: 0 auto; padding: clamp(1.25rem, 4vw, 3rem) clamp(1.1rem, 4vw, 2.75rem) 2.5rem; }
.pg-${ID} .strip { display: flex; align-items: baseline; justify-content: space-between; gap: .75rem; font-variant: small-caps; letter-spacing: .06em; font-size: .72rem; color: var(--label); }
.pg-${ID} .strip-c { color: var(--accent); font-weight: 700; letter-spacing: .1em; text-align: center; }
.pg-${ID} .strip-l, .pg-${ID} .strip-r { flex: 1; }
.pg-${ID} .strip-r { text-align: right; }
.pg-${ID} .rule-double { border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); height: 3px; margin: .5rem 0 1.25rem; }
.pg-${ID} .rule-single { border: 0; border-top: 1px solid var(--rule); margin: 2rem 0 1.5rem; }
.pg-${ID} header { text-align: center; }
.pg-${ID} .kicker { margin: 0 0 .35rem; font-variant: small-caps; letter-spacing: .22em; font-size: .74rem; color: var(--label); }
.pg-${ID} .portrait { width: 92px; height: 92px; margin: .35rem auto .7rem; padding: 3px; border: 1px solid var(--rule); background: var(--bg); }
.pg-${ID} .portrait-img { display: block; width: 100%; height: 100%; object-fit: cover; border: 1px solid var(--rule-tint); filter: grayscale(1) contrast(1.05); }
.pg-${ID} .nameplate { margin: .1rem 0 .3rem; font-weight: 700; font-size: clamp(2.4rem, 10vw, 4.4rem); line-height: .98; letter-spacing: -.01em; color: var(--text); }
.pg-${ID} .nameplate .amp { color: var(--accent); font-style: italic; }
.pg-${ID} .tagline { margin: .15rem 0 .55rem; font-style: italic; font-size: 1.02rem; color: var(--label); }
.pg-${ID} .handle { margin: 0 0 1.1rem; font-variant: small-caps; letter-spacing: .14em; font-size: .78rem; color: var(--accent); }
.pg-${ID} .handle a { display: inline-flex; align-items: center; gap: .4rem; color: inherit; text-decoration: none; border-bottom: 1px solid transparent; transition: border-color .18s ease; }
.pg-${ID} .handle a:hover, .pg-${ID} .handle a:focus-visible { border-bottom-color: var(--accent); }
.pg-${ID} .handle .glyph { width: .42rem; height: .42rem; border: 1px solid var(--accent); transform: rotate(45deg); display: inline-block; }
.pg-${ID} .edition { border: 0; padding: 0; margin: .25rem 0 1.5rem; text-align: center; }
.pg-${ID} .edition legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.pg-${ID} .switch { display: inline-flex; border: 1px solid var(--rule); }
.pg-${ID} .switch input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.pg-${ID} .switch label { font-variant: small-caps; letter-spacing: .1em; font-size: .72rem; color: var(--label); padding: .4rem .7rem; min-height: 44px; display: inline-flex; align-items: center; cursor: pointer; border-left: 1px solid var(--rule-tint); transition: background-color .18s ease, color .18s ease; }
.pg-${ID} .switch label:first-of-type { border-left: 0; }
.pg-${ID} #ed-system:checked ~ label[for=ed-system],
.pg-${ID} #ed-light:checked ~ label[for=ed-light],
.pg-${ID} #ed-dark:checked ~ label[for=ed-dark] { background: var(--accent); color: var(--bg); }
.pg-${ID} .switch input:focus-visible ~ label { outline: 2px solid var(--accent); outline-offset: 2px; }
.pg-${ID} .bio { margin: 0; font-size: 1.075rem; text-align: justify; hyphens: auto; }
.pg-${ID} .bio::first-letter { float: left; font-size: 3.7rem; line-height: .72; padding: .32rem .5rem 0 0; color: var(--accent); font-weight: 700; }
.pg-${ID} .section-label { font-variant: small-caps; letter-spacing: .16em; font-size: .82rem; color: var(--label); font-weight: 400; margin: 1.5rem 0 .35rem; display: flex; align-items: center; gap: .75rem; }
.pg-${ID} .section-label::after { content: ""; flex: 1; border-top: 1px solid var(--rule-tint); }
.pg-${ID} .ledger { list-style: none; counter-reset: toc; margin: 0; padding: 0; }
.pg-${ID} .ledger li { counter-increment: toc; }
.pg-${ID} .ledger a { display: flex; align-items: baseline; gap: .65rem; min-height: 44px; padding: .5rem .35rem; text-decoration: none; color: var(--text); border-bottom: 1px solid var(--rule-tint); transition: background-color .18s ease; }
.pg-${ID} .ledger a::before { content: counter(toc, decimal-leading-zero); color: var(--accent); font-size: .85rem; letter-spacing: .03em; min-width: 1.9rem; flex: 0 0 auto; }
.pg-${ID} .ledger .story { flex: 0 1 auto; font-size: 1.05rem; }
.pg-${ID} .ledger .kick { display: block; font-variant: small-caps; letter-spacing: .08em; font-size: .66rem; color: var(--label); }
.pg-${ID} .ledger .kick .ar { color: var(--accent); }
.pg-${ID} .ledger .leader { flex: 1 1 auto; align-self: flex-end; margin-bottom: .28rem; border-bottom: 1px dotted var(--label); min-width: 1.5rem; }
.pg-${ID} .ledger .arrow { flex: 0 0 auto; color: var(--accent); font-size: 1rem; transition: transform .18s ease; }
.pg-${ID} .ledger a:hover, .pg-${ID} .ledger a:focus-visible { background: var(--surface); }
.pg-${ID} .ledger a:hover .arrow, .pg-${ID} .ledger a:focus-visible .arrow { transform: translateX(4px); }
.pg-${ID} .ledger a:hover .story, .pg-${ID} .ledger a:focus-visible .story { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }
.pg-${ID} .ledger a:active { color: var(--accent-press); }
.pg-${ID} .article { margin: 1rem 0; font-size: 1.02rem; text-align: justify; hyphens: auto; color: var(--text); }
.pg-${ID} .cut { margin: 1.25rem 0; }
.pg-${ID} .cut-img { display: block; max-width: 100%; height: auto; border: 1px solid var(--rule); }
.pg-${ID} .socials { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: .5rem .9rem; }
.pg-${ID} .socials a { display: inline-flex; align-items: center; min-height: 44px; padding: .35rem .2rem; color: var(--text); text-decoration: none; font-variant: small-caps; letter-spacing: .1em; font-size: .82rem; border-bottom: 1px solid transparent; transition: color .18s ease, border-color .18s ease; }
.pg-${ID} .socials a:hover, .pg-${ID} .socials a:focus-visible { color: var(--accent); border-bottom-color: var(--accent); }
.pg-${ID} .colophon { margin-top: 2rem; text-align: center; font-variant: small-caps; letter-spacing: .12em; font-size: .7rem; color: var(--label); }
.pg-${ID} .colophon .flourish { color: var(--accent); display: block; margin-bottom: .4rem; font-size: 1.1rem; }
.pg-${ID} .permalink { display: inline-flex; align-items: center; gap: .4rem; margin-top: .7rem; color: var(--label); text-decoration: none; font-variant: small-caps; letter-spacing: .12em; font-size: .7rem; border-bottom: 1px solid transparent; transition: color .18s ease, border-color .18s ease; }
.pg-${ID} .permalink .chain { width: .85rem; height: .85rem; color: var(--accent); flex: 0 0 auto; }
.pg-${ID} .permalink:hover, .pg-${ID} .permalink:focus-visible { color: var(--accent); border-bottom-color: var(--accent); }
.pg-${ID} a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .pg-${ID} * { transition: none !important; }
  .pg-${ID} .ledger a:hover .arrow, .pg-${ID} .ledger a:focus-visible .arrow { transform: none; }
}
`.trim();
}

const CHAIN_SVG =
  `<svg class="chain" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" ` +
  `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
  `<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/>` +
  `<path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>`;

/** Escape a display name, colouring standalone ampersands as the accent flourish. */
function nameplate(name: string): string {
  return escapeHtml(name).replace(/&amp;/g, '<span class="amp">&amp;</span>');
}

/** A link's small-caps kicker: its (humanised) icon plus any ar:// affordance. */
function kickFor(link: LinkBlock, isAr: boolean, dataAr: string): string {
  const parts: string[] = [];
  const icon = (link.icon || '').replace(/[-_]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
  if (icon) parts.push(escapeHtml(icon));
  if (isAr && dataAr) parts.push(`<span class="ar">${escapeHtml(dataAr)}</span>`);
  if (parts.length === 0) return '';
  return `<span class="kick">${parts.join(' &middot; ')}</span>`;
}

function renderLedger(group: LinkBlock[], ctx: RenderCtx): string {
  const items = group
    .map((link) => {
      const t = linkTarget(link.url, ctx);
      const kick = kickFor(link, t.isAr, t.dataAr);
      return (
        `<li><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
        `<span class="story">${escapeHtml(link.label)}${kick}</span>` +
        `<span class="leader" aria-hidden="true"></span>` +
        `<span class="arrow" aria-hidden="true">&rarr;</span>` +
        `</a></li>`
      );
    })
    .join('');
  return `<ol class="ledger">${items}</ol>`;
}

function renderSocial(block: SocialBlock, ctx: RenderCtx): string {
  const items = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      return `<li><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>${escapeHtml(item.platform)}</a></li>`;
    })
    .join('');
  return `<ul class="socials">${items}</ul>`;
}

function renderColophon(block: VerifyBlock, ctx: RenderCtx): string {
  const v = verifyTarget(block, ctx);
  const link = v
    ? `<a class="permalink" href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)}>${CHAIN_SVG}${escapeHtml(block.label)}</a>`
    : `<span class="permalink">${escapeHtml(block.label)}</span>`;
  return (
    `<footer class="colophon">` +
    `<span class="flourish" aria-hidden="true">&sect;</span>` +
    `Set in Georgia &middot; Printed on cream stock &middot; MMXXVI` +
    link +
    `</footer>`
  );
}

function renderHeader(def: PageDef, ctx: RenderCtx): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  const avatarSrc = p.avatar ? safeImgSrc(p.avatar, ctx) : '';
  const portrait = avatarSrc
    ? `<figure class="portrait"><img class="portrait-img" src="${escapeAttr(avatarSrc)}" alt="${escapeAttr(p.displayName)}" loading="lazy" /></figure>`
    : '';
  const parts: string[] = [
    `<div class="strip">` +
      `<span class="strip-l">Vol.&nbsp;XII &middot; No.&nbsp;7</span>` +
      `<span class="strip-c">The Sunday Ledger</span>` +
      `<span class="strip-r">July&nbsp;18,&nbsp;2026</span>` +
      `</div>`,
    `<div class="rule-double" role="presentation"></div>`,
    `<p class="kicker">Essays &middot; Reportage &middot; Correspondence</p>`,
    portrait,
    `<h1 class="nameplate">${nameplate(p.displayName)}</h1>`,
  ];
  if (p.tagline) parts.push(`<p class="tagline">${escapeHtml(p.tagline)}</p>`);
  if (handle) {
    parts.push(
      `<p class="handle"><a href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)}>` +
        `<span class="glyph" aria-hidden="true"></span>${escapeHtml(handle.text)}</a></p>`,
    );
  }
  parts.push(`<div class="rule-double" role="presentation"></div>`);
  parts.push(
    `<fieldset class="edition">` +
      `<legend>Choose edition appearance</legend>` +
      `<div class="switch">` +
      `<input type="radio" name="edition" id="ed-system" checked>` +
      `<label for="ed-system">Auto</label>` +
      `<input type="radio" name="edition" id="ed-light">` +
      `<label for="ed-light">Day</label>` +
      `<input type="radio" name="edition" id="ed-dark">` +
      `<label for="ed-dark">Night</label>` +
      `</div>` +
      `</fieldset>`,
  );
  return `<header>${parts.join('')}</header>`;
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const out: string[] = [renderHeader(def, ctx)];
  if (def.profile.bio) {
    out.push(`<section class="lede"><p class="bio">${escapeHtml(def.profile.bio)}</p></section>`);
  }

  const blocks = def.blocks;
  let i = 0;
  while (i < blocks.length) {
    const block: Block = blocks[i];
    if (block.type === 'link') {
      const group: LinkBlock[] = [];
      while (i < blocks.length && blocks[i].type === 'link') {
        group.push(blocks[i] as LinkBlock);
        i++;
      }
      out.push(renderLedger(group, ctx));
      continue;
    }
    switch (block.type) {
      case 'heading':
        out.push(`<h2 class="section-label">${escapeHtml(block.text)}</h2>`);
        break;
      case 'text':
        out.push(`<p class="article">${multiline(block.text)}</p>`);
        break;
      case 'divider':
        out.push(`<hr class="rule-single" role="presentation" />`);
        break;
      case 'social':
        out.push(renderSocial(block, ctx));
        break;
      case 'verify':
        out.push(renderColophon(block, ctx));
        break;
      case 'image': {
        const src = safeImgSrc(block.src, ctx);
        if (src) {
          out.push(
            `<figure class="cut"><img class="cut-img" src="${escapeAttr(src)}" alt="${escapeAttr(block.alt || '')}" loading="lazy" /></figure>`,
          );
        }
        break;
      }
      case 'embed': {
        const t = linkTarget(block.arweave, ctx);
        out.push(
          `<p class="article"><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>${escapeHtml(block.arweave)}</a></p>`,
        );
        break;
      }
    }
    i++;
  }
  return `<div class="paper">${out.join('')}</div>`;
}

export const theMastheadTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'The Masthead',
    family: 'modern',
    description: 'A cream-stock broadsheet nameplate with a numbered contents ledger.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default theMastheadTemplate;
