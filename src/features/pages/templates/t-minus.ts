/**
 * T-Minus — a mission-control launch console: radar-void backdrop, HUD ticks,
 * a decorative T-minus countdown, and monospace flight-deck rows.
 * Reproduces docs/pages-templates/t-minus.html as a block-driven module.
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
  hexToRgba,
  linkTarget,
  multiline,
  resolveHandle,
  safeImgSrc,
  verifyTarget,
} from './shared';

const ID = 't-minus';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-t-minus',
  template: 't-minus',
  title: 'NOVA-7',
  arnsName: 'nova-7',
  profile: {
    displayName: 'NOVA-7',
    tagline: 'Orbital drop — 500 signal keys. Boarding opens the instant the clock hits zero.',
    bio: 'NOVA-7 is a 500-piece generative signal collection broadcasting from low orbit. Holders unlock the full audio manifest, mission patches, and priority boarding for the next drop.',
  },
  blocks: [
    { type: 'heading', text: 'Mission Brief' },
    {
      type: 'text',
      text: 'NOVA-7 is a 500-piece generative signal collection broadcasting from low orbit. Holders unlock the full audio manifest, mission patches, and priority boarding for the next drop.',
    },
    { type: 'heading', text: 'Flight Deck' },
    { type: 'link', label: 'Secure your slot', url: '#', icon: 'rocket' },
    { type: 'link', label: 'View the manifest', url: 'ar://nova7-manifest', icon: 'list' },
    { type: 'link', label: 'Join mission comms', url: '#', icon: 'radio' },
    { type: 'divider' },
    { type: 'heading', text: 'Telemetry' },
    {
      type: 'social',
      items: [
        { platform: 'x', url: '#' },
        { platform: 'discord', url: '#' },
        { platform: 'instagram', url: '#' },
      ],
    },
    {
      type: 'verify',
      label: 'Permanent on Arweave · Verify permalink',
      url: 'ar://K7mQ2vN9xR4wL8sT3aYc6dF1gH5jB0nZ_pQ2rW8xV3-',
    },
  ],
  theme: {
    colors: { bg: '#05060A', surface: '#0C111C', text: '#E8F4FF', accent: '#38E1FF' },
    font: 'ui-monospace, "SF Mono", "Cascadia Mono", "Segoe UI Mono", Menlo, Consolas, "Roboto Mono", "Liberation Mono", monospace',
    buttonShape: 'square',
    background: 'radar-void',
  },
  layout: { headerAlign: 'center', linkStyle: 'button', width: 'standard' },
};

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const bg = cssColor(c.bg, '#05060A');
  const surface = cssColor(c.surface, '#0C111C');
  const text = cssColor(c.text, '#E8F4FF');
  const accent = cssColor(c.accent, '#38E1FF');
  const dim = hexToRgba(c.text, 0.62);
  const hair = hexToRgba(c.text, 0.14);
  const raised = hexToRgba(c.text, 0.06);
  const glow = hexToRgba(c.accent, 0.16);
  const ring = hexToRgba(c.accent, 0.16);
  const font = cssFontFamily(
    def.theme.font,
    'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, "Roboto Mono", monospace',
  );

  return `
:root { color-scheme: light dark; }
.pg-${ID} {
  --bg: ${bg}; --surface: ${surface}; --surface-raised: ${raised};
  --text: ${text}; --accent: ${accent}; --dim: ${dim};
  --hairline: ${hair}; --glow: ${glow}; --ring: ${ring};
  --go: #7CFFB0; --abort: #FF5C7A;
  font-family: ${font};
  color: var(--text);
  background: radial-gradient(130% 80% at 50% -8%, var(--glow), transparent 58%), var(--bg);
  min-height: 100vh; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  padding: 0 0 8px;
}
:root[data-theme="dark"] .pg-${ID} {
  --bg: ${bg}; --surface: ${surface}; --surface-raised: ${raised};
  --text: ${text}; --accent: ${accent}; --dim: ${dim};
  --hairline: ${hair}; --glow: ${glow}; --ring: ${ring};
  --go: #7CFFB0; --abort: #FF5C7A;
}
@media (prefers-color-scheme: light) {
  .pg-${ID} {
    --bg: #EAF1F8; --surface: #FFFFFF; --surface-raised: #F1F6FB;
    --text: #0A1420; --accent: #0090B8; --dim: #4A5C70;
    --hairline: #C3D2E0; --glow: rgba(0,144,184,0.10); --ring: rgba(0,144,184,0.12);
    --go: #1F8F55; --abort: #D23A55;
  }
}
:root[data-theme="light"] .pg-${ID} {
  --bg: #EAF1F8; --surface: #FFFFFF; --surface-raised: #F1F6FB;
  --text: #0A1420; --accent: #0090B8; --dim: #4A5C70;
  --hairline: #C3D2E0; --glow: rgba(0,144,184,0.10); --ring: rgba(0,144,184,0.12);
  --go: #1F8F55; --abort: #D23A55;
}
.pg-${ID} * { box-sizing: border-box; }

.pg-${ID} .tm-hud { position: fixed; inset: 14px; pointer-events: none; z-index: 5; }
.pg-${ID} .tm-tick { position: absolute; width: 15px; height: 15px; border: 0 solid var(--accent); opacity: .55; }
.pg-${ID} .tm-tick.tl { top: 0; left: 0; border-top-width: 1px; border-left-width: 1px; }
.pg-${ID} .tm-tick.tr { top: 0; right: 0; border-top-width: 1px; border-right-width: 1px; }
.pg-${ID} .tm-tick.bl { bottom: 0; left: 0; border-bottom-width: 1px; border-left-width: 1px; }
.pg-${ID} .tm-tick.br { bottom: 0; right: 0; border-bottom-width: 1px; border-right-width: 1px; }

.pg-${ID} .tm-header { position: relative; text-align: center; padding: 56px 20px 26px; overflow: visible; }
.pg-${ID} .tm-header::before {
  content: ""; position: absolute; left: 50%; top: 96px; transform: translate(-50%, -50%);
  width: min(600px, 128vw); height: min(600px, 128vw); border-radius: 50%;
  background:
    radial-gradient(circle, transparent 21.6%, var(--ring) 22%, transparent 22.4%),
    radial-gradient(circle, transparent 39.6%, var(--ring) 40%, transparent 40.4%),
    radial-gradient(circle, transparent 61.6%, var(--ring) 62%, transparent 62.4%),
    radial-gradient(circle, transparent 83.6%, var(--ring) 84%, transparent 84.4%);
  -webkit-mask: radial-gradient(circle, #000 26%, transparent 74%);
          mask: radial-gradient(circle, #000 26%, transparent 74%);
  pointer-events: none; z-index: 0;
}
.pg-${ID} .tm-header::after {
  content: ""; position: absolute; left: 50%; top: 96px; transform: translate(-50%, -50%);
  width: min(300px, 66vw); height: min(300px, 66vw); border-radius: 50%;
  border: 1px solid var(--accent); opacity: 0; animation: tm-ping-${ID} 4s cubic-bezier(0, 0, .2, 1) infinite;
  pointer-events: none; z-index: 0;
}
.pg-${ID} .tm-header > * { position: relative; z-index: 1; }

.pg-${ID} .tm-avatar { width: 74px; height: 74px; margin: 0 auto 22px; position: relative; background: var(--surface-raised); border: 1px solid var(--hairline); box-shadow: 0 0 0 4px var(--bg), 0 0 26px var(--glow); }
.pg-${ID} .tm-avatar::before { content: ""; position: absolute; inset: 9px; background: linear-gradient(var(--accent), var(--accent)) center/1px 100% no-repeat, linear-gradient(var(--accent), var(--accent)) center/100% 1px no-repeat; opacity: .28; }
.pg-${ID} .tm-cs { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); text-shadow: 0 0 10px var(--glow); }
.pg-${ID} .tm-avatar.tm-has-img::before { display: none; }
.pg-${ID} .tm-avatar-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }

.pg-${ID} .tm-microlabel { font-size: 11px; letter-spacing: .36em; text-transform: uppercase; color: var(--dim); margin: 0 0 10px; }
.pg-${ID} .tm-name { font-size: clamp(2rem, 8.5vw, 3.3rem); font-weight: 700; letter-spacing: .08em; margin: 0 0 12px; color: var(--text); text-shadow: 0 0 22px var(--glow); }

.pg-${ID} .tm-callsign { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; letter-spacing: .24em; text-transform: uppercase; color: var(--accent); margin: 0 0 16px; padding: 5px 12px; background: var(--surface); border: 1px solid var(--hairline); text-decoration: none; transition: border-color .15s ease, box-shadow .15s ease; }
.pg-${ID} a.tm-callsign:hover { border-color: var(--accent); box-shadow: 0 0 0 3px var(--glow); }
.pg-${ID} a.tm-callsign:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.pg-${ID} .tm-callsign::before { content: ""; width: 5px; height: 5px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px var(--accent); flex: 0 0 auto; }

.pg-${ID} .tm-tagline { font-size: 13px; color: var(--dim); letter-spacing: .1em; line-height: 1.65; max-width: 40ch; margin: 0 auto 22px; }
.pg-${ID} .tm-status { display: inline-flex; align-items: center; gap: 9px; font-size: 12px; letter-spacing: .22em; color: var(--go); padding: 8px 15px; background: var(--surface); border: 1px solid var(--hairline); }
.pg-${ID} .tm-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--go); box-shadow: 0 0 10px var(--go); animation: tm-pulse-${ID} 1.6s ease-in-out infinite; }

.pg-${ID} .tm-countdown { max-width: 660px; margin: 6px auto 0; padding: 0 16px; text-align: center; }
.pg-${ID} .tm-clock { display: flex; align-items: flex-start; justify-content: center; gap: clamp(5px, 1.8vw, 13px); margin-top: 14px; }
.pg-${ID} .tm-group { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.pg-${ID} .tm-digits { display: flex; gap: 6px; }
.pg-${ID} .tm-seg { display: inline-flex; align-items: center; justify-content: center; width: clamp(2.3rem, 13vw, 4rem); height: clamp(2.9rem, 15.5vw, 5rem); font-size: clamp(1.7rem, 8.6vw, 3.15rem); font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; color: var(--accent); background: var(--surface); border: 1px solid var(--hairline); box-shadow: inset 0 1px 0 var(--ring), 0 6px 20px rgba(0, 0, 0, .45); }
.pg-${ID} .tm-colon { display: flex; align-items: center; justify-content: center; height: clamp(2.9rem, 15.5vw, 5rem); font-size: clamp(1.5rem, 7vw, 2.6rem); font-weight: 700; color: var(--accent); animation: tm-blink-${ID} 1s steps(1, end) infinite; }
.pg-${ID} .tm-unit { font-size: 10px; letter-spacing: .28em; text-transform: uppercase; color: var(--dim); }

.pg-${ID} .tm-horizon { border: 0; height: 1px; max-width: 560px; margin: 38px auto; background: linear-gradient(90deg, transparent, var(--hairline) 18%, var(--accent) 50%, var(--hairline) 82%, transparent); opacity: .55; }

.pg-${ID} .tm-blocks { max-width: 540px; margin: 0 auto; padding: 0 18px 72px; }
.pg-${ID} .tm-heading { display: flex; align-items: center; gap: 10px; font-size: 12px; letter-spacing: .3em; text-transform: uppercase; color: var(--dim); margin: 30px 0 14px; }
.pg-${ID} .tm-heading::before { content: ""; width: 14px; height: 1px; background: var(--accent); flex: 0 0 auto; }
.pg-${ID} .tm-text { font-size: 14px; line-height: 1.75; color: var(--text); letter-spacing: .01em; margin: 0 0 18px; opacity: .92; }

.pg-${ID} .tm-rule { border: 0; height: 1px; margin: 26px 0; background: var(--hairline); opacity: .8; }

.pg-${ID} .tm-figure { margin: 18px 0; }
.pg-${ID} .tm-img { display: block; max-width: 100%; height: auto; border: 1px solid var(--hairline); }

.pg-${ID} .tm-link { display: flex; align-items: center; gap: 14px; width: 100%; padding: 16px 18px; margin: 10px 0; text-decoration: none; background: var(--surface); border: 1px solid var(--hairline); color: var(--text); font-size: 13px; letter-spacing: .14em; text-transform: uppercase; transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease, background .15s ease; }
.pg-${ID} .tm-idx { font-size: 11px; color: var(--dim); letter-spacing: .1em; flex: 0 0 auto; font-variant-numeric: tabular-nums; }
.pg-${ID} .tm-label { flex: 1 1 auto; text-align: left; }
.pg-${ID} .tm-arrow { color: var(--accent); flex: 0 0 auto; transition: transform .15s ease; }
.pg-${ID} .tm-link:hover { transform: translateY(-2px); background: var(--surface-raised); border-color: var(--accent); box-shadow: 0 8px 26px rgba(0, 0, 0, .5); }
.pg-${ID} .tm-link:hover .tm-arrow { transform: translateX(4px); }
.pg-${ID} .tm-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; box-shadow: 0 0 0 4px var(--glow); }

.pg-${ID} .tm-tag { font-size: 9px; letter-spacing: .16em; color: var(--accent); border: 1px solid var(--hairline); padding: 3px 6px; flex: 0 0 auto; text-transform: lowercase; opacity: .85; }
.pg-${ID} .tm-link:hover .tm-tag { border-color: var(--accent); }

.pg-${ID} .tm-social { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
.pg-${ID} .tm-social a { flex: 1 1 90px; text-align: center; padding: 12px 8px; text-decoration: none; background: var(--surface); border: 1px solid var(--hairline); color: var(--dim); font-size: 11px; letter-spacing: .2em; text-transform: uppercase; transition: color .15s ease, border-color .15s ease; }
.pg-${ID} .tm-social a:hover { color: var(--accent); border-color: var(--accent); }
.pg-${ID} .tm-social a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.pg-${ID} .tm-foot { text-align: center; font-size: 10px; letter-spacing: .28em; text-transform: uppercase; color: var(--dim); margin-top: 34px; opacity: .7; }

.pg-${ID} .tm-verify-row { text-align: center; }
.pg-${ID} .tm-verify { display: inline-flex; align-items: center; gap: 8px; margin: 16px auto 0; font-size: 10px; letter-spacing: .24em; text-transform: uppercase; color: var(--dim); text-decoration: none; padding: 7px 13px; background: var(--surface); border: 1px solid var(--hairline); transition: color .15s ease, border-color .15s ease, box-shadow .15s ease; }
.pg-${ID} .tm-verify:hover { color: var(--accent); border-color: var(--accent); box-shadow: 0 0 0 3px var(--glow); }
.pg-${ID} .tm-verify:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.pg-${ID} .tm-verify svg { width: 12px; height: 12px; flex: 0 0 auto; stroke: currentColor; fill: none; stroke-width: 1.6; }

@keyframes tm-ping-${ID} { 0% { transform: translate(-50%, -50%) scale(.6); opacity: .65; } 80%, 100% { transform: translate(-50%, -50%) scale(1.7); opacity: 0; } }
@keyframes tm-blink-${ID} { 0%, 50% { opacity: 1; } 51%, 100% { opacity: .12; } }
@keyframes tm-pulse-${ID} { 0%, 100% { opacity: 1; box-shadow: 0 0 10px var(--go); } 50% { opacity: .55; box-shadow: 0 0 4px var(--go); } }

@media (prefers-reduced-motion: reduce) {
  .pg-${ID} .tm-header::after { animation: none; opacity: 0; }
  .pg-${ID} .tm-colon { animation: none; opacity: 1; }
  .pg-${ID} .tm-dot { animation: none; }
  .pg-${ID} .tm-link, .pg-${ID} .tm-arrow { transition: none; }
  .pg-${ID} .tm-link:hover { transform: none; }
}
`.trim();
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Decorative, deterministic T-minus clock (chrome only — carries no def data). */
function renderCountdown(): string {
  const seg = (d: string) => `<span class="tm-seg">${d}</span>`;
  const group = (a: string, b: string, unit: string) =>
    `<div class="tm-group"><span class="tm-digits">${seg(a)}${seg(b)}</span><span class="tm-unit">${unit}</span></div>`;
  const colon = `<span class="tm-colon">:</span>`;
  return (
    `<section class="tm-countdown" aria-label="Time to launch window: 7 days, 14 hours, 32 minutes, 9 seconds">` +
    `<p class="tm-microlabel">T&ndash;Minus to launch window</p>` +
    `<div class="tm-clock" aria-hidden="true">` +
    group('0', '7', 'Days') +
    colon +
    group('1', '4', 'Hrs') +
    colon +
    group('3', '2', 'Min') +
    colon +
    group('0', '9', 'Sec') +
    `</div></section>`
  );
}

function renderHeader(def: PageDef, ctx: RenderCtx): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  const avatarSrc = p.avatar ? safeImgSrc(p.avatar, ctx) : '';
  const avatarInner = avatarSrc
    ? `<img class="tm-avatar-img" src="${escapeAttr(avatarSrc)}" alt="${escapeAttr(p.displayName)}" loading="lazy" />`
    : `<span class="tm-cs">${escapeHtml(avatarInitials(def).toUpperCase())}</span>`;
  const avatarCls = avatarSrc ? 'tm-avatar tm-has-img' : 'tm-avatar';
  const parts: string[] = [
    `<div class="${avatarCls}" aria-hidden="true">${avatarInner}</div>`,
    `<p class="tm-microlabel">Mission</p>`,
    `<h1 class="tm-name">${escapeHtml(p.displayName)}</h1>`,
  ];
  if (handle) {
    parts.push(
      `<a class="tm-callsign" href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)}>${escapeHtml(handle.text)}</a>`,
    );
  }
  if (p.tagline) parts.push(`<p class="tm-tagline">${escapeHtml(p.tagline)}</p>`);
  parts.push(`<p class="tm-status"><span class="tm-dot" aria-hidden="true"></span>Status: GO</p>`);
  return `<header class="tm-header">${parts.join('')}</header>`;
}

function renderLinks(group: LinkBlock[], ctx: RenderCtx): string {
  return group
    .map((link, i) => {
      const t = linkTarget(link.url, ctx);
      const tag = t.isAr ? `<span class="tm-tag" aria-hidden="true">ar://</span>` : '';
      return (
        `<a class="tm-link" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
        `<span class="tm-idx">${pad2(i + 1)}</span>` +
        `<span class="tm-label">${escapeHtml(link.label)}</span>` +
        tag +
        `<span class="tm-arrow" aria-hidden="true">&#9654;</span>` +
        `</a>`
      );
    })
    .join('');
}

function renderSocial(block: SocialBlock, ctx: RenderCtx): string {
  const links = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      return `<a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>${escapeHtml(item.platform)}</a>`;
    })
    .join('');
  return `<nav class="tm-social" aria-label="Social channels">${links}</nav>`;
}

function renderVerify(block: VerifyBlock, ctx: RenderCtx): string {
  const v = verifyTarget(block, ctx);
  const label = block.label || 'Permanent on Arweave · Verify permalink';
  const icon =
    `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="1.5"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg>`;
  const inner = v
    ? `<a class="tm-verify" href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)}>${icon}${escapeHtml(label)}</a>`
    : `<span class="tm-verify">${icon}${escapeHtml(label)}</span>`;
  return (
    `<p class="tm-foot">All systems nominal &middot; Range clear</p>` +
    `<div class="tm-verify-row">${inner}</div>`
  );
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const out: string[] = [
    `<div class="tm-hud" aria-hidden="true"><span class="tm-tick tl"></span><span class="tm-tick tr"></span><span class="tm-tick bl"></span><span class="tm-tick br"></span></div>`,
    renderHeader(def, ctx),
    renderCountdown(),
    `<hr class="tm-horizon">`,
  ];

  const inner: string[] = [];
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
      inner.push(renderLinks(group, ctx));
      continue;
    }
    switch (block.type) {
      case 'heading':
        inner.push(`<h2 class="tm-heading">${escapeHtml(block.text)}</h2>`);
        break;
      case 'text':
        inner.push(`<p class="tm-text">${multiline(block.text)}</p>`);
        break;
      case 'divider':
        inner.push(`<hr class="tm-rule">`);
        break;
      case 'social':
        inner.push(renderSocial(block, ctx));
        break;
      case 'verify':
        inner.push(renderVerify(block, ctx));
        break;
      case 'image': {
        const src = safeImgSrc(block.src, ctx);
        if (src) {
          inner.push(
            `<figure class="tm-figure"><img class="tm-img" src="${escapeAttr(src)}" alt="${escapeAttr(block.alt || '')}" loading="lazy" /></figure>`,
          );
        }
        break;
      }
      case 'embed': {
        const t = linkTarget(block.arweave, ctx);
        const tag = t.isAr ? `<span class="tm-tag" aria-hidden="true">ar://</span>` : '';
        inner.push(
          `<a class="tm-link" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
            `<span class="tm-idx">&#9673;</span>` +
            `<span class="tm-label">${escapeHtml(block.arweave)}</span>` +
            tag +
            `<span class="tm-arrow" aria-hidden="true">&#9654;</span>` +
            `</a>`,
        );
        break;
      }
    }
    i++;
  }

  out.push(`<div class="tm-blocks">${inner.join('')}</div>`);
  return out.join('');
}

export const tMinusTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'T-Minus',
    family: 'wildcard',
    description: 'Mission-control launch console — radar void, HUD ticks, and a T-minus countdown.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default tMinusTemplate;
