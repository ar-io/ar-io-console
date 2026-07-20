/**
 * Boarding Pass — a permaweb link-in-bio styled as an airline boarding pass /
 * ticket: cream ticket stock with a torn perforation, monospaced boarding-pass
 * fields repurposed playfully (PASSENGER / FLIGHT / GATE / SEAT), a CSS
 * repeating-linear-gradient "barcode", and links laid out as itinerary segments.
 * Fully self-contained: gradients + solid fills only (no url()), system fonts.
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

const ID = 'boarding-pass' as unknown as import('../schema').TemplateId;

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-boarding-pass',
  template: ID,
  title: 'Wren Solaire — Boarding Pass',
  arnsName: 'wander',
  profile: {
    avatar: '',
    displayName: 'Wren Solaire',
    tagline: 'Nomad photographer · 46 countries',
    handle: 'wander.ar.io',
    bio: 'Chasing golden hours and slow trains. I archive every trip on the permaweb so the memories outlast the postcards.',
  },
  blocks: [
    { type: 'heading', text: 'Itinerary' },
    { type: 'link', label: 'Portfolio — the full gallery', url: 'https://example.com/portfolio', icon: '◆' },
    { type: 'link', label: 'The Slow Travel Journal', url: 'https://example.com/journal', icon: '✎' },
    {
      type: 'link',
      label: 'Field notes — on the permaweb',
      url: 'ar://mT4nP8qX2vB9kR7wZ1cJ5sD3hN6fA0gE4uL7iO2YpQx',
      icon: '✦',
    },
    { type: 'divider' },
    {
      type: 'text',
      text: 'Now boarding: a night train through the Carpathians. Postcards land here first, then live forever.',
    },
    {
      type: 'social',
      items: [
        { platform: 'instagram', url: 'https://example.com' },
        { platform: 'x', url: 'https://example.com' },
        { platform: 'youtube', url: 'https://example.com' },
        { platform: 'github', url: 'https://example.com' },
      ],
    },
    { type: 'verify', label: 'Permanent on Arweave', url: '#' },
  ],
  theme: {
    colors: { bg: '#DFE7EE', surface: '#FBF8F0', text: '#182741', accent: '#E4572E' },
    font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    buttonShape: 'rounded',
    background: 'boarding-pass',
  },
  layout: { headerAlign: 'left', linkStyle: 'card', width: 'standard' },
};

const MONO = 'ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const accent = cssColor(c.accent, '#E4572E');
  const font = cssFontFamily(
    def.theme.font,
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  );

  const lightVars =
    `--paper:#FBF8F0; --paper-edge:#F1EADB; --ink:#182741; --muted:#5C6A85; ` +
    `--line:rgba(24,39,65,.16); --page:#DCE6EE; --sky1:rgba(120,164,206,.35); --sky2:#EDE6D8;`;
  const darkVars =
    `--paper:#20242E; --paper-edge:#272C38; --ink:#EDF1F7; --muted:#9AA6BC; ` +
    `--line:rgba(237,241,247,.16); --page:#0D1017; --sky1:rgba(78,120,170,.20); --sky2:#141922;`;

  return `
:root { color-scheme: light dark; }
.pg-${ID} {
  ${lightVars}
  --accent:${accent};
  min-height: 100vh; margin: 0; padding: clamp(1.5rem,5vw,3rem) 1rem;
  display: flex; align-items: flex-start; justify-content: center;
  color: var(--ink); font-family: ${font}; -webkit-font-smoothing: antialiased;
  background:
    radial-gradient(120% 78% at 50% -12%, var(--sky1), transparent 62%),
    linear-gradient(180deg, var(--sky2), var(--page));
}
.pg-${ID} * { box-sizing: border-box; }
.pg-${ID} .bp-ticket {
  position: relative; width: 100%; max-width: 30rem;
  background: var(--paper); border-radius: 20px;
  box-shadow: 0 24px 60px rgba(16,28,51,.28), inset 0 1px 0 rgba(255,255,255,.5);
}
.pg-${ID} .bp-main { position: relative; padding: 1.5rem 1.35rem 1.15rem; overflow: hidden; border-radius: 20px 20px 0 0; }
.pg-${ID} .bp-main::before {
  content: ""; position: absolute; inset: 0 0 auto 0; height: 8px;
  background: repeating-linear-gradient(90deg, var(--accent) 0 14px, transparent 14px 28px);
  opacity: .9;
}
.pg-${ID} .bp-brand {
  display: flex; align-items: center; gap: .55rem; margin: .4rem 0 1.1rem;
  font-family: ${MONO}; font-size: .66rem; letter-spacing: .18em; text-transform: uppercase; color: var(--muted);
}
.pg-${ID} .bp-brand .bp-logo {
  display: grid; place-items: center; width: 22px; height: 22px; border-radius: 6px;
  background: var(--accent); color: #fff; font-size: .8rem; flex: 0 0 auto;
}
.pg-${ID} .bp-brand .bp-airline { color: var(--ink); font-weight: 700; }
.pg-${ID} .bp-brand .bp-doc { margin-left: auto; }
.pg-${ID} .bp-stamp {
  position: absolute; top: 1.1rem; right: -0.4rem; transform: rotate(9deg);
  font-family: ${MONO}; font-size: .6rem; letter-spacing: .22em; font-weight: 700;
  color: var(--accent); border: 2px solid var(--accent); border-radius: 6px;
  padding: .18rem .5rem; opacity: .55;
}
.pg-${ID} .bp-route {
  display: flex; align-items: center; gap: .8rem; margin: 0 0 1.2rem;
  font-family: ${MONO}; font-weight: 700; letter-spacing: .06em;
}
.pg-${ID} .bp-route .bp-city { font-size: clamp(1.4rem,6vw,1.9rem); color: var(--ink); }
.pg-${ID} .bp-route .bp-plane { flex: 1; text-align: center; color: var(--accent); font-size: 1.1rem; position: relative; }
.pg-${ID} .bp-route .bp-plane::before,
.pg-${ID} .bp-route .bp-plane::after {
  content: ""; position: absolute; top: 50%; width: 30%; height: 2px;
  background: repeating-linear-gradient(90deg, var(--line) 0 4px, transparent 4px 8px);
}
.pg-${ID} .bp-route .bp-plane::before { left: 0; }
.pg-${ID} .bp-route .bp-plane::after { right: 0; }
.pg-${ID} .bp-flabel {
  display: block; font-family: ${MONO}; font-size: .58rem; letter-spacing: .18em;
  text-transform: uppercase; color: var(--muted); margin-bottom: .18rem;
}
.pg-${ID} .bp-passenger { margin-bottom: .35rem; }
.pg-${ID} .bp-passenger .bp-pname {
  font-size: clamp(1.3rem,5vw,1.6rem); font-weight: 800; letter-spacing: -.01em; line-height: 1.1; color: var(--ink);
}
.pg-${ID} .bp-tagline { margin: .1rem 0 .7rem; font-size: .82rem; font-weight: 600; color: var(--accent); }
.pg-${ID} .bp-handle {
  display: inline-flex; align-items: center; gap: .4rem; margin: 0 0 .8rem;
  padding: .28rem .65rem; border-radius: 999px; font-family: ${MONO}; font-size: .72rem; font-weight: 600;
  color: var(--ink); text-decoration: none; background: var(--paper-edge); border: 1px solid var(--line);
  transition: border-color .2s ease, color .2s ease, transform .2s ease;
}
.pg-${ID} .bp-handle .bp-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex: 0 0 auto; }
.pg-${ID} .bp-handle:hover { color: var(--accent); border-color: var(--accent); transform: translateY(-1px); }
.pg-${ID} .bp-bio { margin: 0 0 1.1rem; font-size: .9rem; line-height: 1.55; color: var(--muted); max-width: 32ch; }
.pg-${ID} .bp-fields {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: .7rem .5rem; margin: 0 0 .3rem;
  padding: .9rem 0 0; border-top: 1px solid var(--line);
}
.pg-${ID} .bp-fields .bp-val { font-family: ${MONO}; font-size: 1rem; font-weight: 700; color: var(--ink); }
.pg-${ID} .bp-section {
  font-family: ${MONO}; font-size: .62rem; letter-spacing: .2em; text-transform: uppercase;
  color: var(--muted); margin: 1.35rem 0 .55rem;
}
.pg-${ID} .bp-links { display: flex; flex-direction: column; gap: .6rem; margin: 1rem 0 0; }
.pg-${ID} .bp-seg {
  display: flex; align-items: center; gap: .8rem; min-height: 52px; padding: .6rem .85rem;
  border-radius: 12px; text-decoration: none; color: var(--ink); font-weight: 600; font-size: .95rem;
  background: var(--paper-edge); border: 1px solid var(--line);
  border-left: 4px solid var(--accent);
  transition: transform .18s ease, border-color .2s ease, box-shadow .2s ease;
}
.pg-${ID} .bp-seg .bp-ico {
  flex: 0 0 auto; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 8px;
  background: var(--paper); border: 1px solid var(--line); color: var(--accent); font-size: 1rem;
}
.pg-${ID} .bp-seg .bp-txt { flex: 1 1 auto; }
.pg-${ID} .bp-seg .bp-tag {
  flex: 0 0 auto; font-family: ${MONO}; font-size: .58rem; letter-spacing: .08em; color: var(--muted);
  border: 1px solid var(--line); border-radius: 6px; padding: .16rem .4rem; text-transform: uppercase;
}
.pg-${ID} .bp-seg:hover { transform: translateY(-2px); border-color: var(--accent); box-shadow: 0 8px 20px rgba(16,28,51,.14); }
.pg-${ID} .bp-seg:hover .bp-tag { color: var(--accent); border-color: var(--accent); }
.pg-${ID} .bp-text { margin: .9rem 0; font-size: .9rem; line-height: 1.55; color: var(--muted); }
.pg-${ID} .bp-figure { margin: 1rem 0 0; }
.pg-${ID} .bp-figure img {
  display: block; width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--line);
}
.pg-${ID} .bp-rule { height: 1px; border: 0; margin: 1.2rem 0; background: repeating-linear-gradient(90deg, var(--line) 0 5px, transparent 5px 10px); }
.pg-${ID} .bp-social { display: flex; flex-wrap: wrap; justify-content: flex-start; gap: .55rem; margin: 1rem 0 0; list-style: none; padding: 0; }
.pg-${ID} .bp-social a {
  width: 40px; height: 40px; display: grid; place-items: center; border-radius: 10px;
  color: var(--ink); text-decoration: none; font-family: ${MONO}; font-weight: 700; font-size: .82rem;
  background: var(--paper-edge); border: 1px solid var(--line);
  transition: transform .18s ease, border-color .2s ease, color .2s ease;
}
.pg-${ID} .bp-social a:hover { transform: translateY(-2px); color: var(--accent); border-color: var(--accent); }
.pg-${ID} .bp-perf {
  position: relative; height: 0; margin: 0 1.35rem; border-top: 2px dashed var(--line);
}
.pg-${ID} .bp-perf::before,
.pg-${ID} .bp-perf::after {
  content: ""; position: absolute; top: -11px; width: 22px; height: 22px; border-radius: 50%; background: var(--page);
}
.pg-${ID} .bp-perf::before { left: -1.35rem; transform: translateX(-50%); }
.pg-${ID} .bp-perf::after { right: -1.35rem; transform: translateX(50%); }
.pg-${ID} .bp-stub { padding: 1.15rem 1.35rem 1.4rem; border-radius: 0 0 20px 20px; }
.pg-${ID} .bp-stub-fields { display: grid; grid-template-columns: repeat(3, 1fr); gap: .6rem; margin: 0 0 1rem; }
.pg-${ID} .bp-stub-fields .bp-val { font-family: ${MONO}; font-size: .95rem; font-weight: 700; color: var(--ink); }
.pg-${ID} .bp-barcode {
  height: 54px; border-radius: 6px; margin: 0 0 .3rem;
  background: repeating-linear-gradient(90deg,
    var(--ink) 0 2px, transparent 2px 4px, var(--ink) 4px 7px, transparent 7px 9px,
    var(--ink) 9px 10px, transparent 10px 13px);
  opacity: .88;
}
.pg-${ID} .bp-barnum { font-family: ${MONO}; font-size: .62rem; letter-spacing: .34em; color: var(--muted); text-align: center; margin: .35rem 0 0; }
.pg-${ID} .bp-verify {
  display: inline-flex; align-items: center; gap: .45rem; margin: 1rem 0 0; text-decoration: none;
  font-family: ${MONO}; font-size: .64rem; letter-spacing: .12em; text-transform: uppercase; color: var(--muted);
  transition: color .2s ease;
}
.pg-${ID} .bp-verify .bp-lock {
  position: relative; display: inline-block; width: 11px; height: 8px; margin-top: 5px; border-radius: 2px; background: currentColor;
}
.pg-${ID} .bp-verify .bp-lock::before {
  content: ""; position: absolute; left: 50%; top: -6px; transform: translateX(-50%);
  width: 7px; height: 8px; border: 1.5px solid currentColor; border-bottom: none; border-radius: 6px 6px 0 0;
}
.pg-${ID} .bp-verify:hover { color: var(--accent); }
.pg-${ID} a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 10px; }
@media (prefers-color-scheme: dark) { .pg-${ID} { ${darkVars} } }
:root[data-theme="dark"] .pg-${ID} { ${darkVars} }
:root[data-theme="light"] .pg-${ID} { ${lightVars} }
@media (prefers-reduced-motion: reduce) {
  .pg-${ID} .bp-seg, .pg-${ID} .bp-social a, .pg-${ID} .bp-handle { transition: none; }
  .pg-${ID} .bp-seg:hover, .pg-${ID} .bp-social a:hover, .pg-${ID} .bp-handle:hover { transform: none; }
}
`.trim();
}

/** Up-to-two-letter uppercase initials for a social platform (falls back to a dot). */
function socialGlyph(platform: string): string {
  const letters = platform.trim().replace(/[^A-Za-z0-9]/g, '');
  if (!letters) return '·';
  const first = letters[0].toUpperCase();
  const second = letters.length > 1 ? letters[1].toLowerCase() : '';
  return `${first}${second}`;
}

const FIELDS =
  '<div class="bp-fields" aria-hidden="true">' +
  '<div><span class="bp-flabel">Flight</span><span class="bp-val">AR·IO</span></div>' +
  '<div><span class="bp-flabel">Gate</span><span class="bp-val">∞</span></div>' +
  '<div><span class="bp-flabel">Seat</span><span class="bp-val">01A</span></div>' +
  '<div><span class="bp-flabel">Boards</span><span class="bp-val">ALWAYS</span></div>' +
  '</div>';

function renderHeader(def: PageDef, ctx: RenderCtx): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  const parts: string[] = [
    '<div class="bp-brand"><span class="bp-logo" aria-hidden="true">✈</span>' +
      '<span class="bp-airline">Permaweb Airways</span><span class="bp-doc">Boarding Pass</span></div>',
    '<span class="bp-stamp" aria-hidden="true">Permanent</span>',
    '<div class="bp-route" aria-hidden="true">' +
      '<span class="bp-city">NOW</span><span class="bp-plane">✈</span><span class="bp-city">4EVER</span></div>',
    '<div class="bp-passenger"><span class="bp-flabel">Passenger</span>' +
      `<span class="bp-pname">${escapeHtml(p.displayName)}</span></div>`,
  ];
  if (p.tagline) parts.push(`<p class="bp-tagline">${escapeHtml(p.tagline)}</p>`);
  if (handle) {
    parts.push(
      `<a class="bp-handle" href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)} ` +
        `aria-label="${escapeAttr(`ArNS handle: ${handle.text}`)}">` +
        `<span class="bp-dot" aria-hidden="true"></span>${escapeHtml(handle.text)}</a>`,
    );
  }
  if (p.bio) parts.push(`<p class="bp-bio">${escapeHtml(p.bio)}</p>`);
  parts.push(FIELDS);
  return `<header>${parts.join('')}</header>`;
}

function renderSeg(link: LinkBlock, ctx: RenderCtx): string {
  const t = linkTarget(link.url, ctx);
  const ico = `<span class="bp-ico" aria-hidden="true">${escapeHtml(link.icon || '✈')}</span>`;
  const tag = t.isAr ? 'ar://' : 'board';
  return (
    `<a class="bp-seg" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    ico +
    `<span class="bp-txt">${escapeHtml(link.label)}</span>` +
    `<span class="bp-tag" aria-hidden="true">${tag}</span></a>`
  );
}

function renderLinks(group: LinkBlock[], ctx: RenderCtx): string {
  return `<nav class="bp-links" aria-label="Links">${group.map((l) => renderSeg(l, ctx)).join('')}</nav>`;
}

function renderSocial(block: SocialBlock, ctx: RenderCtx): string {
  const items = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      const label = item.platform ? escapeAttr(item.platform) : 'Social link';
      return (
        `<li><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)} aria-label="${label}">` +
        `<span aria-hidden="true">${escapeHtml(socialGlyph(item.platform))}</span></a></li>`
      );
    })
    .join('');
  return `<ul class="bp-social" aria-label="Social links">${items}</ul>`;
}

function renderEmbed(arweave: string, ctx: RenderCtx): string {
  const raw = arweave.trim();
  const url = raw.toLowerCase().startsWith('ar://') ? raw : `ar://${raw}`;
  const t = linkTarget(url, ctx);
  return (
    `<nav class="bp-links" aria-label="Embedded resource">` +
    `<a class="bp-seg" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
    `<span class="bp-ico" aria-hidden="true">✦</span>` +
    `<span class="bp-txt">${escapeHtml(raw)}</span>` +
    `<span class="bp-tag" aria-hidden="true">ar://</span></a></nav>`
  );
}

function renderStub(verifyBlock: VerifyBlock | undefined, ctx: RenderCtx): string {
  const v = verifyTarget(verifyBlock, ctx);
  const label = verifyBlock && verifyBlock.label ? verifyBlock.label : 'Permanent on Arweave';
  const verify = v
    ? `<a class="bp-verify" href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)}>` +
      `<span class="bp-lock" aria-hidden="true"></span>${escapeHtml(label)}</a>`
    : `<span class="bp-verify"><span class="bp-lock" aria-hidden="true"></span>${escapeHtml(label)}</span>`;
  return (
    '<section class="bp-stub">' +
    '<div class="bp-stub-fields" aria-hidden="true">' +
    '<div><span class="bp-flabel">Seat</span><span class="bp-val">01A</span></div>' +
    '<div><span class="bp-flabel">Gate</span><span class="bp-val">∞</span></div>' +
    '<div><span class="bp-flabel">Zone</span><span class="bp-val">01</span></div>' +
    '</div>' +
    '<div class="bp-barcode" aria-hidden="true"></div>' +
    '<p class="bp-barnum" aria-hidden="true">AR · IO · PERMAWEB</p>' +
    verify +
    '</section>'
  );
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const blocks = def.blocks;

  let verifyBlock: VerifyBlock | undefined;
  for (const b of blocks) {
    if (b.type === 'verify' && !verifyBlock) verifyBlock = b;
  }

  const out: string[] = [renderHeader(def, ctx)];

  let i = 0;
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
        out.push(`<p class="bp-section">${escapeHtml(block.text)}</p>`);
        break;
      case 'text':
        out.push(`<p class="bp-text">${multiline(block.text)}</p>`);
        break;
      case 'divider':
        out.push('<hr class="bp-rule" aria-hidden="true" />');
        break;
      case 'social':
        out.push(renderSocial(block, ctx));
        break;
      case 'image': {
        const src = safeImgSrc(block.src, ctx);
        if (src) {
          out.push(
            `<figure class="bp-figure"><img src="${escapeAttr(src)}" alt="${escapeAttr(block.alt || '')}" loading="lazy" /></figure>`,
          );
        }
        break;
      }
      case 'embed':
        out.push(renderEmbed(block.arweave, ctx));
        break;
      case 'verify':
        // Rendered in the ticket stub via the pre-scan above.
        break;
    }
    i++;
  }

  return (
    '<main class="bp-ticket">' +
    `<section class="bp-main">${out.join('')}</section>` +
    '<div class="bp-perf" aria-hidden="true"></div>' +
    renderStub(verifyBlock, ctx) +
    '</main>'
  );
}

export const boardingPassTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Boarding Pass',
    family: 'wildcard',
    description: 'An airline boarding pass for the permaweb — torn stub, monospaced fields, and a CSS barcode.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default boardingPassTemplate;
