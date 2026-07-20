/**
 * man-page — a Unix manual page rendered as a link-in-bio. Reverse-video header
 * band, sectioned prose (NAME / SYNOPSIS / DESCRIPTION / OPTIONS / BUGS / SEE
 * ALSO), flag-button links and a manpage-style footer. Reproduces
 * docs/pages-templates/man-page.html as a block-driven module.
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
  resolveHandle,
  safeImgSrc,
  verifyTarget,
} from './shared';

const ID = 'man-page';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-man-page',
  template: 'man-page',
  title: 'yourname(1) — General Commands Manual',
  arnsName: 'yourname',
  profile: {
    avatar: '',
    displayName: 'yourname',
    tagline: 'full-stack developer & permaweb tinkerer',
    handle: 'yourname.ar.io',
    bio: 'yourname is a long-running process that takes vague requirements on standard input and emits working software on standard output. Idempotent under coffee. Handles interrupts gracefully; recovers from most panics. Ten years uptime, minimal unplanned restarts.',
  },
  blocks: [
    { type: 'heading', text: 'NAME' },
    { type: 'text', text: 'yourname — builds things that stay up, ships things that stay shipped' },
    { type: 'heading', text: 'SYNOPSIS' },
    { type: 'text', text: 'yourname [-w|--work] [-c|--contact] [-s|--stack] [--hire] [-v|--verbose] [idea ...]' },
    { type: 'heading', text: 'DESCRIPTION' },
    {
      type: 'text',
      text: 'yourname is a long-running process that takes vague requirements on standard input and emits working software on standard output. Idempotent under coffee. Runs on the open permaweb. Prefers boring technology, honest commit messages, and interfaces you can read with man.',
    },
    { type: 'heading', text: 'OPTIONS' },
    { type: 'link', label: '-w, --work', url: 'ar://works', icon: 'flag' },
    { type: 'link', label: '-s, --stack', url: '#stack', icon: 'flag' },
    { type: 'link', label: '-c, --contact', url: '#contact', icon: 'flag' },
    { type: 'link', label: '--hire', url: '#hire', icon: 'flag' },
    { type: 'divider' },
    { type: 'heading', text: 'BUGS' },
    {
      type: 'text',
      text: "Refactors code that was, on reflection, fine (won't fix). Underestimates task duration by a constant factor of 1.8x. Cannot resist a good man page. Occasionally answers 'it depends' without being asked a question.",
    },
    { type: 'heading', text: 'SEE ALSO' },
    { type: 'text', text: 'git-log(1), coffee(1), ship-it(8), sleep(3)' },
    {
      type: 'link',
      label: 'permanent on arweave',
      url: 'ar://lM3xQ8vT2pR5wY1jZ7nB4cF9gH0sN6dK-aErUiOpXyZ',
      icon: 'lock',
    },
    {
      type: 'social',
      items: [
        { platform: 'github', url: '#' },
        { platform: 'email', url: '#' },
      ],
    },
  ],
  theme: {
    colors: { bg: '#FAFAF7', surface: '#F0F0EA', text: '#1A1A1A', accent: '#005F87' },
    font: '"SFMono-Regular", "SF Mono", "Menlo", "Consolas", "Liberation Mono", "DejaVu Sans Mono", ui-monospace, monospace',
    buttonShape: 'square',
    background: 'paper',
  },
  layout: { headerAlign: 'left', linkStyle: 'button', width: 'standard' },
};

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const bg = cssColor(c.bg, '#FAFAF7');
  const surface = cssColor(c.surface, '#F0F0EA');
  const text = cssColor(c.text, '#1A1A1A');
  const accent = cssColor(c.accent, '#005F87');
  const muted = hexToRgba(c.text, 0.72);
  const tint = hexToRgba(c.accent, 0.55);
  const hairline = hexToRgba(c.text, 0.12);
  const font = cssFontFamily(
    def.theme.font,
    '"SFMono-Regular", "SF Mono", Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", ui-monospace, monospace',
  );

  const lightVars =
    `--bg:${bg};--surface:${surface};--text:${text};--accent:${accent};` +
    `--muted:${muted};--accent-dark:${accent};--accent-tint:${tint};` +
    `--hairline:${hairline};--band:${surface};--reverse-text:${bg};--reverse-bg:${accent};`;

  const darkVars =
    `--bg:#12130F;--surface:#1A1B16;--text:#E6E6DE;--accent:#4FB8DE;` +
    `--muted:#9A9A8E;--accent-dark:#4FB8DE;--accent-tint:#7F9AA6;` +
    `--hairline:rgba(230,230,222,0.18);--band:#1A1B16;--reverse-text:#12130F;--reverse-bg:#4FB8DE;`;

  return `
.pg-${ID}{
  ${lightVars}
  background:var(--bg);color:var(--text);
  font-family:${font};
  line-height:1.65;
  font-size:clamp(0.9rem,0.86rem+0.35vw,1rem);
  min-height:100vh;padding:1.5rem 1rem 3rem;
  -webkit-font-smoothing:antialiased;
}
.pg-${ID} *{box-sizing:border-box;}
.pg-${ID} .man{max-width:72ch;margin:0 auto;}
.pg-${ID} .man-head,
.pg-${ID} .man-foot{
  display:flex;flex-wrap:wrap;gap:0.25rem 1rem;
  align-items:baseline;font-size:0.82rem;letter-spacing:0.02em;
}
.pg-${ID} .man-head{
  background:var(--reverse-bg);color:var(--reverse-text);
  padding:0.5rem 0.85rem;justify-content:space-between;
  text-transform:uppercase;font-weight:700;border-radius:0;
}
.pg-${ID} .man-head .mh-mid{flex:1 1 auto;text-align:center;opacity:0.95;}
.pg-${ID} .man-head .mh-r{text-align:right;}
.pg-${ID} .man-avatar{
  width:84px;height:84px;margin:1.5rem 0 0;
  border:1.5px solid var(--accent);background:var(--band);
  padding:3px;overflow:hidden;
}
.pg-${ID} .man-avatar img{
  display:block;width:100%;height:100%;object-fit:cover;
}
.pg-${ID} .title{
  margin:2rem 0 0.35rem;
  font-size:clamp(1.5rem,1.2rem+2vw,2.1rem);
  font-weight:800;letter-spacing:-0.01em;line-height:1.15;
}
.pg-${ID} .title .caret{
  display:inline-block;width:0.62ch;height:1.05em;
  margin-left:0.15ch;vertical-align:-0.14em;
  background:var(--accent);animation:pg-blink-${ID} 1.05s steps(1) infinite;
}
.pg-${ID} .tagline{color:var(--muted);font-size:0.95rem;margin:0 0 0.4rem;}
.pg-${ID} .handle{margin:0 0 1.75rem;font-size:0.85rem;letter-spacing:0.02em;}
.pg-${ID} .handle a{color:var(--accent);text-decoration:none;}
.pg-${ID} .handle a::before{content:"@ ";color:var(--accent-tint);}
.pg-${ID} .handle a:hover{color:var(--accent-dark);text-decoration:underline;text-underline-offset:2px;}
.pg-${ID} h2.sec{
  font-size:0.95rem;font-weight:700;text-transform:uppercase;
  letter-spacing:0.08em;color:var(--text);
  margin:2rem 0 0.75rem;padding-bottom:0.3rem;
  border-bottom:2px solid var(--accent);
}
.pg-${ID} p{margin:0 0 0.9rem;}
.pg-${ID} .indent{padding-left:2ch;}
.pg-${ID} .muted{color:var(--muted);}
.pg-${ID} .synopsis{
  background:var(--band);border:1px solid var(--hairline);
  padding:0.85rem 1ch;overflow-x:auto;white-space:pre-wrap;
  font-size:0.9rem;line-height:1.7;margin:0 0 0.9rem;
}
.pg-${ID} .synopsis b{color:var(--text);font-weight:700;}
.pg-${ID} nav.options{margin:0.5rem 0 0;}
.pg-${ID} .opt-row{margin:0 0 1.4rem;}
.pg-${ID} .opt-flags{display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;margin-bottom:0.5rem;}
.pg-${ID} .flag-btn{
  display:inline-flex;align-items:center;justify-content:center;
  min-height:44px;padding:0.4rem 0.9rem;
  background:transparent;color:var(--accent);
  border:1.5px solid var(--accent);border-radius:0;
  font:inherit;font-weight:700;font-size:0.9rem;
  text-decoration:none;cursor:pointer;
  transition:background-color 0.12s ease,color 0.12s ease;
}
.pg-${ID} .flag-btn:hover,
.pg-${ID} .flag-btn:focus-visible{background:var(--accent-dark);color:var(--reverse-text);}
.pg-${ID} a:focus-visible,
.pg-${ID} .flag-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
.pg-${ID} .opt-ar{
  font-size:0.72rem;font-weight:700;letter-spacing:0.04em;
  color:var(--accent-tint);text-transform:none;
}
.pg-${ID} hr.rule{border:0;border-top:1px solid var(--hairline);margin:2rem 0;}
.pg-${ID} .bugs{margin:0 0 0.9rem;padding-left:2ch;}
.pg-${ID} .bugs li{margin:0 0 0.6rem;color:var(--muted);}
.pg-${ID} .man-social{
  display:flex;flex-wrap:wrap;gap:0.5rem;margin:0.5rem 0 0.9rem;
}
.pg-${ID} .man-social a{
  display:inline-flex;align-items:center;min-height:44px;
  padding:0.35rem 0.8rem;color:var(--accent);text-decoration:none;
  border:1px solid var(--hairline);font-weight:700;font-size:0.85rem;
  transition:border-color 0.12s ease,color 0.12s ease;
}
.pg-${ID} .man-social a:hover,
.pg-${ID} .man-social a:focus-visible{border-color:var(--accent);color:var(--accent-dark);}
.pg-${ID} .man-foot{
  margin-top:2.5rem;padding:0.55rem 0.85rem;
  background:var(--surface);border-top:2px solid var(--accent);
  color:var(--muted);justify-content:space-between;
  text-transform:uppercase;font-weight:600;
}
.pg-${ID} .man-foot .mf-mid{flex:1 1 auto;text-align:center;}
.pg-${ID} .man-foot .mf-r{text-align:right;}
.pg-${ID} .permalink{
  margin:0.85rem 0 0;text-align:center;
  font-size:0.78rem;letter-spacing:0.02em;color:var(--muted);
}
.pg-${ID} .permalink a{
  color:var(--muted);text-decoration:none;
  display:inline-flex;align-items:center;gap:0.5ch;
}
.pg-${ID} .permalink a:hover{color:var(--accent);}
.pg-${ID} .permalink .lock{
  display:inline-block;width:0.72em;height:0.6em;position:relative;
  border:1.5px solid currentColor;border-radius:1px;
  vertical-align:-0.08em;flex:0 0 auto;
}
.pg-${ID} .permalink .lock::before{
  content:"";position:absolute;left:50%;top:-0.4em;
  transform:translateX(-50%);
  width:0.42em;height:0.4em;
  border:1.5px solid currentColor;border-bottom:0;
  border-radius:0.42em 0.42em 0 0;
}
@keyframes pg-blink-${ID}{50%{opacity:0;}}
@media (prefers-color-scheme:dark){
  .pg-${ID}{${darkVars}}
  .pg-${ID} .flag-btn:hover,
  .pg-${ID} .flag-btn:focus-visible{color:#12130F;}
}
:root[data-theme="dark"] .pg-${ID}{${darkVars}}
:root[data-theme="dark"] .pg-${ID} .flag-btn:hover,
:root[data-theme="dark"] .pg-${ID} .flag-btn:focus-visible{color:#12130F;}
:root[data-theme="light"] .pg-${ID}{${lightVars}}
@media (prefers-reduced-motion:reduce){
  .pg-${ID} .title .caret{animation:none;}
  .pg-${ID} *{transition:none !important;}
}
`.trim();
}

function sectionSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'sec';
}

/** Bold the leading term of a `name — summary` line, mirroring a manpage NAME. */
function renderNameLine(textVal: string): string {
  const m = /^(.*?)(\s+[—–-]\s+)([\s\S]*)$/.exec(textVal);
  if (m) {
    return `<b>${escapeHtml(m[1])}</b>${escapeHtml(m[2])}${escapeHtml(m[3])}`;
  }
  return escapeHtml(textVal);
}

/** Split prose into sentence-sized items for a BUGS list. */
function splitSentences(textVal: string): string[] {
  return textVal
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function renderText(textVal: string, section: string, textIndex: number): string {
  switch (section) {
    case 'NAME':
      return `<p class="indent">${renderNameLine(textVal)}</p>`;
    case 'SYNOPSIS':
      return `<div class="synopsis">${escapeHtml(textVal)}</div>`;
    case 'BUGS': {
      const items = splitSentences(textVal);
      if (items.length === 0) return '';
      const lis = items.map((s) => `<li>${escapeHtml(s)}</li>`).join('');
      return `<ul class="bugs">${lis}</ul>`;
    }
    case 'SEE ALSO':
      return `<p class="indent muted">${escapeHtml(textVal)}</p>`;
    default:
      return `<p class="indent${textIndex > 0 ? ' muted' : ''}">${escapeHtml(textVal)}</p>`;
  }
}

function renderOption(link: LinkBlock, ctx: RenderCtx): string {
  const t = linkTarget(link.url, ctx);
  const href = escapeAttr(safeHref(t.href));
  const dataAr = dataArAttr(t.dataAr);
  const flags = link.label
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
  const labels = flags.length > 0 ? flags : [link.label];
  const buttons = labels
    .map((f) => `<a class="flag-btn" href="${href}"${dataAr}>${escapeHtml(f)}</a>`)
    .join('');
  const ar = t.isAr ? `<span class="opt-ar" aria-hidden="true">ar://</span>` : '';
  return `<div class="opt-row"><div class="opt-flags">${buttons}${ar}</div></div>`;
}

function renderSocial(block: SocialBlock, ctx: RenderCtx): string {
  const links = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      return `<a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>${escapeHtml(item.platform)}</a>`;
    })
    .join('');
  return `<nav class="man-social" aria-label="Social links">${links}</nav>`;
}

function renderHeader(def: PageDef, ctx: RenderCtx): string {
  const p = def.profile;
  const upper = p.displayName.toUpperCase();
  const handle = resolveHandle(def, ctx);
  const parts: string[] = [
    `<div class="man-head">` +
      `<span class="mh-l">${escapeHtml(upper)}(1)</span>` +
      `<span class="mh-mid">General Commands Manual</span>` +
      `<span class="mh-r">${escapeHtml(upper)}(1)</span>` +
      `</div>`,
  ];
  // Optional avatar: only render when a real image is supplied. With no image
  // the header keeps its original title-first layout unchanged.
  const avatarSrc = safeImgSrc(p.avatar || '', ctx);
  if (avatarSrc) {
    parts.push(
      `<div class="man-avatar" aria-hidden="true"><img src="${escapeAttr(avatarSrc)}" alt="" loading="lazy" /></div>`,
    );
  }
  parts.push(
    `<h1 class="title">${escapeHtml(p.displayName)}<span class="caret" aria-hidden="true"></span></h1>`,
  );
  if (p.tagline) parts.push(`<p class="tagline">${escapeHtml(p.tagline)}</p>`);
  if (handle) {
    parts.push(
      `<p class="handle"><a href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)}>${escapeHtml(handle.text)}</a></p>`,
    );
  }
  return parts.join('');
}

function renderFooter(def: PageDef, permalink: LinkBlock | undefined, ctx: RenderCtx): string {
  const upper = def.profile.displayName.toUpperCase();
  const parts: string[] = [
    `<div class="man-foot">` +
      `<span class="mf-l">ar.io Console</span>` +
      `<span class="mf-mid">record</span>` +
      `<span class="mf-r">${escapeHtml(upper)}(1)</span>` +
      `</div>`,
  ];

  const synthetic: VerifyBlock | undefined = permalink
    ? { type: 'verify', label: permalink.label, url: permalink.url }
    : undefined;
  const v = verifyTarget(synthetic, ctx);
  if (v) {
    const label = permalink && permalink.label ? permalink.label : 'permanent on arweave — verify permalink';
    parts.push(
      `<p class="permalink"><a href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)} title="Verify this page on Arweave">` +
        `<span class="lock" aria-hidden="true"></span>${escapeHtml(label)}</a></p>`,
    );
  }
  return parts.join('');
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const blocks = def.blocks;

  // Pull the manpage permalink (a lock-marked ar:// link) out of the main flow.
  let permalink: LinkBlock | undefined;
  for (const b of blocks) {
    if (b.type === 'link' && b.icon === 'lock') {
      permalink = b;
      break;
    }
  }

  const out: string[] = [renderHeader(def, ctx)];
  let section = '';
  let textIndex = 0;

  let i = 0;
  while (i < blocks.length) {
    const block: Block = blocks[i];
    if (block === permalink) {
      i++;
      continue;
    }

    // Group consecutive links into a single OPTIONS nav (skipping the permalink).
    if (block.type === 'link') {
      const rows: string[] = [];
      while (i < blocks.length) {
        const b = blocks[i];
        if (b.type !== 'link' || b === permalink) break;
        rows.push(renderOption(b as LinkBlock, ctx));
        i++;
      }
      if (rows.length > 0) {
        out.push(`<nav class="options" aria-label="Sections and links">${rows.join('')}</nav>`);
      }
      continue;
    }

    switch (block.type) {
      case 'heading':
        section = block.text.trim().toUpperCase();
        textIndex = 0;
        out.push(`<h2 class="sec" id="${escapeAttr(sectionSlug(block.text))}">${escapeHtml(block.text)}</h2>`);
        break;
      case 'text':
        out.push(renderText(block.text, section, textIndex));
        textIndex++;
        break;
      case 'divider':
        out.push(`<hr class="rule">`);
        break;
      case 'social':
        out.push(renderSocial(block, ctx));
        break;
      case 'image': {
        const src = safeImgSrc(block.src, ctx);
        if (src) {
          out.push(
            `<p class="indent"><img src="${escapeAttr(src)}" alt="${escapeAttr(block.alt || '')}" style="max-width:100%;height:auto" loading="lazy" /></p>`,
          );
        }
        break;
      }
      case 'embed': {
        const t = linkTarget(block.arweave, ctx);
        out.push(
          `<p class="indent"><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>${escapeHtml(block.arweave)}</a></p>`,
        );
        break;
      }
      case 'verify': {
        // A first-class verify block also renders as the manpage permalink footer.
        if (!permalink) {
          permalink = { type: 'link', label: block.label, url: block.url };
        }
        break;
      }
    }
    i++;
  }

  out.push(renderFooter(def, permalink, ctx));
  return `<main class="man">${out.join('')}</main>`;
}

export const manPageTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'man yourname',
    family: 'developer',
    description: 'A Unix manual page as a link-in-bio: reverse-video header, sectioned prose, flag-button links.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default manPageTemplate;
