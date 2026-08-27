/**
 * README.md — a developer's GitHub project page rendered as a personal profile:
 * identicon, status badges, a blockquote bio, a contribution graph, monospace
 * link cards and a permanent-on-Arweave permalink. Reproduces
 * docs/pages-templates/readme-md.html as a block-driven module.
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

const ID = 'readme-md';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-readme-md',
  template: 'readme-md',
  title: 'ada-lin — README.md',
  arnsName: 'ada-lin',
  profile: {
    avatar: 'identicon:ada-lin',
    displayName: 'Ada Lin',
    tagline: 'Staff engineer · distributed systems · open-source maintainer',
    bio: 'Well-maintained, actively developed, and accepting contributions. I build reliable systems, write honest docs, and review PRs within `48h`. Currently shipping developer tooling and mentoring first-time contributors.',
  },
  blocks: [
    { type: 'heading', text: 'Ada Lin  @ada-lin' },
    {
      type: 'text',
      text: 'badges: [build|passing] [coverage|98%] [version|v3.4.1] [license|MIT] [prs|welcome] [arns|ada-lin.ar.io]',
    },
    {
      type: 'text',
      text: '> Well-maintained, actively developed, and accepting contributions. I build reliable systems, write honest docs, and review PRs within `48h`. Currently shipping developer tooling and mentoring first-time contributors.',
    },
    { type: 'heading', text: 'Contribution activity' },
    { type: 'text', text: '1,204 commits in the last year — longest streak: 62 days.' },
    {
      type: 'image',
      src: 'css:contribution-graph',
      alt: 'Contribution graph showing steady activity over the past year',
    },
    { type: 'heading', text: 'Links' },
    { type: 'link', label: '$ git', url: 'https://github.com/ada-lin', icon: 'git' },
    { type: 'link', label: './blog', url: 'https://ada.dev/writing', icon: 'book' },
    { type: 'link', label: '~/talks', url: 'https://ada.dev/talks', icon: 'mic' },
    { type: 'link', label: 'npm i', url: 'https://npmjs.com/~ada-lin', icon: 'package' },
    { type: 'link', label: 'ar://', url: 'ar://ada-lin', icon: 'globe' },
    { type: 'link', label: '$ mail', url: 'mailto:ada@ada.dev', icon: 'mail' },
    { type: 'divider' },
    { type: 'heading', text: 'Connect' },
    {
      type: 'social',
      items: [
        { platform: 'github', url: 'https://github.com/ada-lin' },
        { platform: 'mastodon', url: 'https://fosstodon.org/@ada-lin' },
        { platform: 'bluesky', url: 'https://bsky.app/profile/ada.dev' },
        { platform: 'linkedin', url: 'https://linkedin.com/in/ada-lin' },
        { platform: 'rss', url: 'https://ada.dev/feed.xml' },
      ],
    },
    {
      type: 'text',
      text: 'README.md · Permanent on Arweave · verify permalink → ar://aZ9kR3mP7qT1xW5nB8vL2cY6dF0gH4jK7sN9uQ2eX5t',
    },
  ],
  theme: {
    colors: { bg: '#FFFFFF', surface: '#F6F8FA', text: '#1F2328', accent: '#0969DA' },
    font: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
    buttonShape: 'rounded',
    background: 'solid',
  },
  layout: { headerAlign: 'left', linkStyle: 'card', width: 'standard' },
};

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const bg = cssColor(c.bg, '#FFFFFF');
  const surface = cssColor(c.surface, '#F6F8FA');
  const text = cssColor(c.text, '#1F2328');
  const accent = cssColor(c.accent, '#0969DA');
  const border = hexToRgba(c.text, 0.16);
  const muted = hexToRgba(c.text, 0.6);
  const empty = hexToRgba(c.text, 0.08);
  const badgeLabel = hexToRgba(c.text, 0.55);
  const font = cssFontFamily(
    def.theme.font,
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
  );

  return `
:root { color-scheme: light dark; }
.pg-${ID} {
  --bg: ${bg}; --surface: ${surface}; --text: ${text}; --accent: ${accent};
  --border: ${border}; --muted: ${muted}; --empty: ${empty}; --badge-label: ${badgeLabel};
  --pass: #3FB950; --ver: #8250DF; --arns: #5427C8;
  --g1: #0E4429; --g2: #006D32; --g3: #26A641; --g4: #39D353;
  font-family: ${font};
  background: var(--bg); color: var(--text); min-height: 100vh;
  -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%;
}
:root[data-theme="light"] .pg-${ID} {
  --bg: ${bg}; --surface: ${surface}; --text: ${text}; --accent: ${accent};
  --border: ${border}; --muted: ${muted}; --empty: ${empty}; --badge-label: ${badgeLabel};
  --arns: #5427C8;
}
@media (prefers-color-scheme: dark) {
  .pg-${ID} {
    --bg: #0D1117; --surface: #161B22; --text: #E6EDF3; --accent: #58A6FF;
    --border: #30363D; --muted: #8B949E; --empty: #161B22; --badge-label: #8B949E;
    --arns: #8B6FE8;
  }
}
:root[data-theme="dark"] .pg-${ID} {
  --bg: #0D1117; --surface: #161B22; --text: #E6EDF3; --accent: #58A6FF;
  --border: #30363D; --muted: #8B949E; --empty: #161B22; --badge-label: #8B949E;
  --arns: #8B6FE8;
}
.pg-${ID} * { box-sizing: border-box; }
.pg-${ID} .rm-main {
  max-width: 840px; margin: 0 auto; padding: 32px 20px 64px;
  line-height: 1.6; font-size: 16px;
}
.pg-${ID} .mono {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
}

/* header */
.pg-${ID} .rm-head { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 4px; }
.pg-${ID} .ident {
  flex: 0 0 auto; width: 64px; height: 64px; border: 1px solid var(--border); border-radius: 50%;
  padding: 9px; background: var(--surface);
  display: grid; grid-template-columns: repeat(5, 1fr); grid-template-rows: repeat(5, 1fr); gap: 2px;
}
.pg-${ID} .ident i { border-radius: 1px; background: transparent; }
.pg-${ID} .ident i.on { background: var(--accent); }
.pg-${ID} .ident.ident-img { display: block; padding: 0; overflow: hidden; }
.pg-${ID} .ident.ident-img img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; }
.pg-${ID} .rm-head .who { min-width: 0; }
.pg-${ID} h1 { font-size: 2em; font-weight: 800; margin: 0; line-height: 1.25; letter-spacing: -0.01em; }
.pg-${ID} h1 .at { color: var(--muted); font-weight: 600; }
.pg-${ID} .tagline { color: var(--muted); font-size: 0.95em; margin: 2px 0 0; }
.pg-${ID} .arns-handle {
  display: inline-flex; align-items: center; gap: 6px; margin: 6px 0 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.8em;
  color: var(--arns); text-decoration: none;
}
.pg-${ID} .arns-handle .hex {
  width: 9px; height: 10px; flex: 0 0 auto; background: var(--arns);
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
}
.pg-${ID} .arns-handle:hover { text-decoration: underline; }
.pg-${ID} .arns-handle:focus-visible { outline: 2px solid var(--arns); outline-offset: 2px; border-radius: 3px; }
.pg-${ID} .h1-rule { border: 0; border-bottom: 1px solid var(--border); margin: 0.35em 0 1.1em; }

/* badges */
.pg-${ID} .badges { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 20px; padding: 0; list-style: none; }
.pg-${ID} .badge {
  display: inline-flex; height: 20px; border-radius: 3px; overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; line-height: 20px;
  text-decoration: none;
}
.pg-${ID} .badge span { padding: 0 7px; white-space: nowrap; }
.pg-${ID} .badge .lbl { background: var(--badge-label); color: #fff; }
.pg-${ID} .badge .val { color: #0D1117; font-weight: 600; }
.pg-${ID} .badge .val.pass { background: var(--pass); }
.pg-${ID} .badge .val.cov { background: var(--accent); color: #fff; }
.pg-${ID} .badge .val.ver { background: var(--ver); color: #fff; }
.pg-${ID} .badge .val.lic { background: var(--muted); color: #fff; }
.pg-${ID} .badge .val.arns { background: var(--arns); color: #fff; }
.pg-${ID} a.badge:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.3); border-radius: 3px; }

/* blockquote bio */
.pg-${ID} blockquote {
  margin: 0 0 24px; padding: 2px 0 2px 1em; border-left: 4px solid var(--border); color: var(--muted);
}
.pg-${ID} blockquote p { margin: 0.3em 0; }
.pg-${ID} blockquote code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.85em;
  background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 0.1em 0.35em; color: var(--text);
}

/* section headings */
.pg-${ID} h2 {
  font-size: 1.35em; font-weight: 800; margin: 32px 0 0; padding-bottom: 0.3em; border-bottom: 1px solid var(--border);
}
.pg-${ID} h2 + .sub { color: var(--muted); font-size: 0.9em; margin: 0.6em 0 1em; }
.pg-${ID} .sub { color: var(--muted); font-size: 0.9em; margin: 0.6em 0 1em; }

/* contribution graph */
.pg-${ID} .graph-wrap { overflow-x: auto; padding: 4px 0 6px; -webkit-overflow-scrolling: touch; }
.pg-${ID} .graph {
  display: grid; grid-template-rows: repeat(7, 10px); grid-auto-flow: column; grid-auto-columns: 10px;
  gap: 3px; width: max-content;
}
.pg-${ID} .graph i { width: 10px; height: 10px; border-radius: 2px; background: var(--empty); }
.pg-${ID} .graph i:nth-child(3n) { background: var(--g1); }
.pg-${ID} .graph i:nth-child(7n) { background: var(--g2); }
.pg-${ID} .graph i:nth-child(5n+2) { background: var(--g1); }
.pg-${ID} .graph i:nth-child(11n) { background: var(--g3); }
.pg-${ID} .graph i:nth-child(13n+4) { background: var(--g2); }
.pg-${ID} .graph i:nth-child(17n) { background: var(--g4); }
.pg-${ID} .graph i:nth-child(19n+7) { background: var(--g3); }
.pg-${ID} .graph i:nth-child(29n) { background: var(--g4); }
.pg-${ID} .graph i:nth-child(23n+3) { background: var(--g1); }
.pg-${ID} .graph-legend {
  display: flex; align-items: center; gap: 6px; justify-content: flex-end;
  color: var(--muted); font-size: 11px; margin-top: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.pg-${ID} .graph-legend i { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }

/* link cards */
.pg-${ID} ul.links { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 8px; }
.pg-${ID} ul.links a {
  display: flex; align-items: center; gap: 12px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 6px;
  padding: 12px 14px; text-decoration: none; color: var(--text);
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.pg-${ID} ul.links a .chip {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px;
  background: var(--bg); border: 1px solid var(--border); border-radius: 4px;
  padding: 2px 8px; color: var(--text); white-space: nowrap; flex: 0 0 auto;
}
.pg-${ID} ul.links a.ar .chip { border-color: var(--arns); color: var(--arns); }
.pg-${ID} ul.links a .url { color: var(--accent); font-size: 0.9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pg-${ID} ul.links a.ar .url { color: var(--arns); }
.pg-${ID} ul.links a .arrow { margin-left: auto; color: var(--muted); flex: 0 0 auto; }
.pg-${ID} ul.links a:hover { border-color: var(--accent); transform: translateX(2px); }
.pg-${ID} ul.links a.ar:hover { border-color: var(--arns); }
.pg-${ID} ul.links a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.3); }
.pg-${ID} ul.links a.ar:focus-visible { outline-color: var(--arns); box-shadow: 0 0 0 3px rgba(84, 39, 200, 0.3); }

/* socials */
.pg-${ID} .socials { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 0; padding: 0; list-style: none; }
.pg-${ID} .socials a {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px;
  text-decoration: none; color: var(--accent);
  background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 6px 12px;
  transition: border-color 0.15s ease;
}
.pg-${ID} .socials a:hover { border-color: var(--accent); }
.pg-${ID} .socials a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.3); }

/* divider */
.pg-${ID} hr.div { border: 0; border-top: 1px solid var(--border); margin: 34px 0; }

/* footer */
.pg-${ID} .foot { color: var(--muted); font-size: 12px; text-align: center; margin-top: 28px; }
.pg-${ID} .foot .mono { font-size: 11px; }
.pg-${ID} .foot.perma { margin-top: 10px; }
.pg-${ID} .foot.perma a {
  display: inline-flex; align-items: center; gap: 6px;
  color: var(--muted); text-decoration: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px;
  transition: color 0.15s ease;
}
.pg-${ID} .foot.perma a:hover { color: var(--arns); }
.pg-${ID} .foot.perma a:focus-visible { outline: 2px solid var(--arns); outline-offset: 2px; border-radius: 3px; }
.pg-${ID} .foot.perma .chain {
  width: 9px; height: 10px; flex: 0 0 auto; background: currentColor;
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
}

@media (max-width: 520px) {
  .pg-${ID} h1 { font-size: 1.6em; }
  .pg-${ID} ul.links a .url { font-size: 0.82em; }
}
@media (prefers-reduced-motion: reduce) {
  .pg-${ID} * { transition: none !important; animation: none !important; }
  .pg-${ID} ul.links a:hover { transform: none; }
}
`.trim();
}

// --- deterministic identicon --------------------------------------------------

/** FNV-ish string hash (deterministic, no clocks/randomness). */
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** A 5×5 horizontally-symmetric identicon derived deterministically from a seed. */
function renderIdenticon(seedSource: string): string {
  const seedStr = seedSource.replace(/^identicon:/i, '').trim() || 'permaweb';
  const h = hashStr(seedStr);
  const cells: boolean[] = [];
  for (let r = 0; r < 5; r++) {
    const row: boolean[] = [];
    for (let col = 0; col < 3; col++) {
      row[col] = ((h >>> (r * 3 + col)) & 1) === 1;
    }
    // mirror left half onto the right for a symmetric glyph
    cells.push(row[0], row[1], row[2], row[1], row[0]);
  }
  const dots = cells.map((on) => (on ? '<i class="on"></i>' : '<i></i>')).join('');
  return `<div class="ident" aria-hidden="true">${dots}</div>`;
}

/**
 * The avatar slot: an uploaded image (data:image / http(s) / resolved ar://) is
 * framed inside the same circular identicon slot; otherwise the deterministic
 * identicon glyph is kept exactly as-is.
 */
function renderAvatar(def: PageDef, ctx: RenderCtx): string {
  const p = def.profile;
  const src = p.avatar ? safeImgSrc(p.avatar, ctx) : '';
  if (src) {
    return (
      `<div class="ident ident-img">` +
      `<img src="${escapeAttr(src)}" alt="${escapeAttr(p.displayName)}" loading="lazy" /></div>`
    );
  }
  return renderIdenticon(p.avatar || p.displayName);
}

// --- contribution graph -------------------------------------------------------

const GRAPH_CELLS = 364; // 52 weeks × 7 days

function renderGraph(alt: string): string {
  const label = alt || 'Contribution activity graph';
  const dots = '<i></i>'.repeat(GRAPH_CELLS);
  const legend =
    `<div class="graph-legend" aria-hidden="true">Less` +
    `<i style="background:var(--empty)"></i>` +
    `<i style="background:var(--g1)"></i>` +
    `<i style="background:var(--g2)"></i>` +
    `<i style="background:var(--g3)"></i>` +
    `<i style="background:var(--g4)"></i>More</div>`;
  return (
    `<div class="graph-wrap"><div class="graph" role="img" aria-label="${escapeAttr(label)}">${dots}</div></div>` +
    legend
  );
}

// --- header -------------------------------------------------------------------

function renderHeader(def: PageDef, ctx: RenderCtx): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  const atName = handle ? handle.dataAr.replace(/^ar:\/\//i, '') : '';
  const parts: string[] = [
    renderAvatar(def, ctx),
    `<div class="who">`,
    `<h1>${escapeHtml(p.displayName)}${atName ? ` <span class="at mono">@${escapeHtml(atName)}</span>` : ''}</h1>`,
  ];
  if (p.tagline) parts.push(`<p class="tagline">${escapeHtml(p.tagline)}</p>`);
  if (handle) {
    parts.push(
      `<a class="arns-handle" href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)} ` +
        `aria-label="${escapeAttr(`Permaweb identity: ${handle.text}`)}">` +
        `<span class="hex" aria-hidden="true"></span>${escapeHtml(handle.text)}</a>`,
    );
  }
  parts.push(`</div>`);
  return `<header class="rm-head">${parts.join('')}</header><hr class="h1-rule">`;
}

// --- badges -------------------------------------------------------------------

interface Badge {
  label: string;
  value: string;
}

function parseBadges(text: string): Badge[] {
  const out: Badge[] = [];
  const re = /\[([^\]|]+)\|([^\]]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ label: m[1].trim(), value: m[2].trim() });
  }
  return out;
}

function badgeClass(label: string): 'pass' | 'cov' | 'ver' | 'lic' | 'arns' {
  const l = label.toLowerCase();
  if (l.includes('arns')) return 'arns';
  if (l.includes('cov')) return 'cov';
  if (l.includes('ver')) return 'ver';
  if (l.includes('lic')) return 'lic';
  return 'pass';
}

function renderBadges(text: string, def: PageDef, ctx: RenderCtx): string {
  const badges = parseBadges(text);
  if (badges.length === 0) return '';
  const handle = resolveHandle(def, ctx);
  const items = badges
    .map((b) => {
      const cls = badgeClass(b.label);
      let href = '#';
      let dataAr = '';
      let value = b.value;
      if (cls === 'arns' && handle) {
        href = safeHref(handle.href);
        dataAr = handle.dataAr;
        value = handle.text;
      }
      return (
        `<li><a class="badge" href="${escapeAttr(href)}"${dataArAttr(dataAr)}>` +
        `<span class="lbl">${escapeHtml(b.label)}</span>` +
        `<span class="val ${cls}">${escapeHtml(value)}</span></a></li>`
      );
    })
    .join('');
  return `<ul class="badges" aria-label="Repository status badges">${items}</ul>`;
}

// --- blockquote bio -----------------------------------------------------------

/** Escape prose while turning `…` inline-code spans into <code>. */
function inlineCode(text: string): string {
  return text
    .split('`')
    .map((part, i) => (i % 2 === 1 ? `<code>${escapeHtml(part)}</code>` : escapeHtml(part)))
    .join('');
}

function renderBlockquote(text: string): string {
  const body = text.replace(/^>\s?/gm, '');
  const html = inlineCode(body).replace(/\r?\n/g, '<br>');
  return `<blockquote><p>${html}</p></blockquote>`;
}

// --- links / socials ----------------------------------------------------------

function displayUrl(raw: string, ctx: RenderCtx): string {
  const t = linkTarget(raw, ctx);
  const base = t.isAr ? t.href : raw.trim();
  return base
    .replace(/^mailto:/i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
}

function renderLinks(group: LinkBlock[], ctx: RenderCtx): string {
  const items = group
    .map((link) => {
      const t = linkTarget(link.url, ctx);
      const cls = t.isAr ? ' class="ar"' : '';
      const chip = link.label || (t.isAr ? 'ar://' : 'link');
      return (
        `<li><a${cls} href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
        `<span class="chip">${escapeHtml(chip)}</span>` +
        `<span class="url">${escapeHtml(displayUrl(link.url, ctx))}</span>` +
        `<span class="arrow" aria-hidden="true">→</span></a></li>`
      );
    })
    .join('');
  return `<ul class="links">${items}</ul>`;
}

function renderSocials(block: SocialBlock, ctx: RenderCtx): string {
  const items = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      return `<li><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>${escapeHtml(item.platform)}</a></li>`;
    })
    .join('');
  return `<ul class="socials">${items}</ul>`;
}

// --- footer / permalink -------------------------------------------------------

const AR_TOKEN_RE = /(ar:\/\/[A-Za-z0-9_-]+|https?:\/\/\S+)/i;

function isFooterText(text: string): boolean {
  // Anchor to the footer's own phrasing, not a bare URL — otherwise an ordinary
  // prose block that merely mentions a link would be pulled out of the body (and,
  // with "last one wins", earlier such blocks would vanish entirely).
  return /verify permalink|permanent on arweave/i.test(text);
}

function renderFooter(footText: string | undefined, ctx: RenderCtx): string {
  let label = 'Permanent on Arweave · verify permalink';
  let verifyUrl = '';
  if (footText) {
    const m = AR_TOKEN_RE.exec(footText);
    if (m) verifyUrl = m[1];
    const left = footText.split(/→|->/)[0];
    const afterName = left.replace(/^[^·]*·\s*/, '').trim();
    if (afterName && afterName !== left.trim()) label = afterName;
  }
  const block: VerifyBlock | undefined = verifyUrl
    ? { type: 'verify', label, url: verifyUrl }
    : undefined;
  const v = verifyTarget(block, ctx);

  const foot =
    `<p class="foot"><span class="mono">README.md</span> · built with commit &amp; coffee</p>`;
  const perma = v
    ? `<p class="foot perma"><a href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)} ` +
      `aria-label="Permanent on Arweave — verify this page's transaction">` +
      `<span class="chain" aria-hidden="true"></span>${escapeHtml(label)}</a></p>`
    : '';
  return foot + perma;
}

// --- body ---------------------------------------------------------------------

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const blocks = def.blocks;
  const name = def.profile.displayName.trim().toLowerCase();
  const consumed = new Set<Block>();

  // Pre-scan for chrome pulled out of the main flow.
  let badgesBlock: TextBlock | undefined;
  let footText: string | undefined;
  let titleConsumed = false;
  for (const b of blocks) {
    if (!titleConsumed && b.type === 'heading' && name && b.text.trim().toLowerCase().startsWith(name)) {
      consumed.add(b);
      titleConsumed = true;
    } else if (!badgesBlock && b.type === 'text' && /^\s*badges\s*:/i.test(b.text)) {
      badgesBlock = b;
      consumed.add(b);
    } else if (b.type === 'text' && isFooterText(b.text)) {
      footText = b.text; // last one wins
      consumed.add(b);
    } else if (b.type === 'verify') {
      footText = `${b.label} → ${b.url}`;
      consumed.add(b);
    }
  }

  const out: string[] = [renderHeader(def, ctx)];
  if (badgesBlock) out.push(renderBadges(badgesBlock.text, def, ctx));

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
      out.push(renderLinks(group, ctx));
      continue;
    }
    switch (block.type) {
      case 'heading':
        out.push(`<h2 id="${escapeAttr(slug(block.text))}">${escapeHtml(block.text)}</h2>`);
        break;
      case 'text':
        if (/^\s*>/.test(block.text)) {
          out.push(renderBlockquote(block.text));
        } else {
          out.push(`<p class="sub">${inlineCode(block.text).replace(/\r?\n/g, '<br>')}</p>`);
        }
        break;
      case 'image':
        if (/^css:/i.test(block.src.trim())) {
          out.push(renderGraph(block.alt || ''));
        } else {
          const src = safeImgSrc(block.src, ctx);
          if (src) {
            out.push(
              `<p><img src="${escapeAttr(src)}" alt="${escapeAttr(block.alt || '')}" style="max-width:100%;height:auto;border-radius:6px" loading="lazy" /></p>`,
            );
          }
        }
        break;
      case 'divider':
        out.push(`<hr class="div">`);
        break;
      case 'social':
        out.push(renderSocials(block, ctx));
        break;
      case 'embed': {
        const t = linkTarget(block.arweave, ctx);
        out.push(
          `<p class="sub"><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>${escapeHtml(block.arweave)}</a></p>`,
        );
        break;
      }
      case 'verify':
        // Handled via footer (pre-scan).
        break;
    }
    i++;
  }

  out.push(renderFooter(footText, ctx));
  return `<div class="rm-main">${out.join('')}</div>`;
}

export const readmeMdTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'README.md',
    family: 'developer',
    description: "A developer's GitHub project page: identicon, status badges, contribution graph, monospace link cards.",
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default readmeMdTemplate;
