/**
 * Chrome Dreams — vaporwave mall at dusk: conic-chrome avatar, neon glass links,
 * a scrolling perspective grid horizon. Reproduces
 * docs/pages-templates/chrome-dreams.html as a block-driven module.
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

const ID = 'chrome-dreams';

const seed: PageDef = {
  schema: 'ario-console/page',
  schemaVersion: 1,
  id: 'seed-chrome-dreams',
  template: 'chrome-dreams',
  title: 'Neon Mirage — Chrome Dreams',
  arnsName: 'neonmirage',
  profile: {
    avatar: 'NM',
    displayName: 'Neon Mirage',
    tagline: 'Slowed & Reverbed · Est. 20XX',
    bio: 'Broadcasting from the last open storefront in an infinite dusk. Late-night synth loops, chrome ballads, and mall-fountain ambience for the terminally nostalgic. Pull up a bench by the dry fountain and stay a while.',
  },
  blocks: [
    { type: 'heading', text: 'Now Playing' },
    { type: 'link', label: 'Listen · Fountain Court (LP)', url: 'https://example.com/listen', icon: 'play' },
    { type: 'link', label: 'Latest Mix · Escalator Descent', url: 'ar://escalator-descent', icon: 'diamond' },
    { type: 'link', label: 'Merch · Chrome Cassette', url: 'https://example.com/merch', icon: 'star' },
    { type: 'link', label: 'Booking & Sync Licensing', url: 'mailto:booking@example.com', icon: 'mail' },
    { type: 'divider' },
    { type: 'heading', text: 'Liner Notes' },
    {
      type: 'text',
      text: 'All tracks recorded after hours between closing announcements. Mastered on a dying food-court PA. Dedicated to everyone still waiting for the arcade to reopen.',
    },
    {
      type: 'social',
      items: [
        { platform: 'bandcamp', url: 'https://bandcamp.com/neonmirage' },
        { platform: 'soundcloud', url: 'https://soundcloud.com/neonmirage' },
        { platform: 'youtube', url: 'https://youtube.com/@neonmirage' },
        { platform: 'instagram', url: 'https://instagram.com/neonmirage' },
      ],
    },
    {
      type: 'verify',
      label: 'Permanent on Arweave · verify',
      url: 'ar://K7mZvR3nP9xWqL2bYt8FcJ4dH6sA1eR5uG0iO8nP3xW',
    },
  ],
  theme: {
    colors: { bg: '#150036', surface: '#2A0A5E', text: '#F3EFFF', accent: '#01CDFE' },
    font: '"Century Gothic", "Futura", "Avenir Next", "Segoe UI", system-ui, -apple-system, sans-serif',
    buttonShape: 'pill',
    background: 'vaporwave-sunset-grid',
  },
  layout: { headerAlign: 'center', linkStyle: 'button', width: 'standard' },
};

function styleFor(def: PageDef): string {
  const c = def.theme.colors;
  const bg = cssColor(c.bg, '#150036');
  const surface = cssColor(c.surface, '#2A0A5E');
  const text = cssColor(c.text, '#F3EFFF');
  const accent = cssColor(c.accent, '#01CDFE');
  const font = cssFontFamily(
    def.theme.font,
    '"Century Gothic", "Futura", "Avenir Next", "Segoe UI", system-ui, -apple-system, sans-serif',
  );

  return `
.pg-${ID}{
  --cd-bg:${bg}; --cd-surface:${surface}; --cd-text:${text};
  --cd-accent:${accent}; --cd-pink:#FF71CE; --cd-mint:#05FFA1;
  --cd-lav:#B892FF; --cd-deep:#0A0022; --cd-purple:#3D1580; --cd-chrome:#E8DFFF;
  --cd-font:${font};
  position:relative;
  min-height:100vh;
  margin:0;
  color:var(--cd-text);
  font-family:var(--cd-font);
  background:linear-gradient(180deg,var(--cd-bg) 0%,var(--cd-surface) 42%,#7A1E8C 72%,var(--cd-pink) 100%) fixed;
  overflow-x:hidden;
  -webkit-font-smoothing:antialiased;
}
.pg-${ID} *{box-sizing:border-box;}
.pg-${ID} .cd-grid{
  position:fixed;
  left:-25%; right:-25%; bottom:0;
  height:45vh;
  z-index:0;
  pointer-events:none;
  perspective:320px;
  -webkit-mask-image:linear-gradient(to top,#000 0%,#000 22%,transparent 100%);
          mask-image:linear-gradient(to top,#000 0%,#000 22%,transparent 100%);
}
.pg-${ID} .cd-grid::before{
  content:"";
  position:absolute; inset:-20% -10% -60% -10%;
  background:
    repeating-linear-gradient(90deg,transparent 0 39px,rgba(1,205,254,0.5) 39px 40px),
    repeating-linear-gradient(0deg,transparent 0 39px,rgba(1,205,254,0.35) 39px 40px);
  transform:rotateX(68deg);
  transform-origin:bottom center;
  animation:cd-scroll 6s linear infinite;
}
@keyframes cd-scroll{
  from{background-position:0 0,0 0;}
  to{background-position:0 0,0 40px;}
}
.pg-${ID} .cd-wrap{
  position:relative;
  z-index:1;
  width:100%;
  max-width:34rem;
  margin:0 auto;
  padding:clamp(2.5rem,8vw,4.5rem) 1.25rem 8rem;
  box-sizing:border-box;
  text-align:center;
}
.pg-${ID} .cd-avatar{
  width:6rem; height:6rem;
  margin:0 auto 1.4rem;
  border-radius:999px;
  padding:3px;
  background:conic-gradient(from 210deg,#01CDFE,#05FFA1,#B892FF,#FF71CE,#01CDFE);
  box-shadow:0 0 26px rgba(1,205,254,0.55),0 0 8px rgba(255,113,206,0.5);
}
.pg-${ID} .cd-avatar span{
  display:flex; align-items:center; justify-content:center;
  width:100%; height:100%;
  border-radius:999px;
  background:radial-gradient(circle at 32% 28%,var(--cd-purple),var(--cd-deep));
  font-size:1.9rem; font-weight:700;
  letter-spacing:0.05em;
  text-transform:uppercase;
  color:var(--cd-chrome);
  text-shadow:0 1px 0 rgba(255,113,206,0.8);
}
.pg-${ID} .cd-avatar .cd-avatar-img{
  overflow:hidden;
  background:var(--cd-deep);
}
.pg-${ID} .cd-avatar .cd-avatar-img img{
  display:block;
  width:100%; height:100%;
  border-radius:999px;
  object-fit:cover;
}
.pg-${ID} .cd-name{
  margin:0 0 .5rem;
  font-size:clamp(2rem,9vw,2.9rem);
  font-weight:700;
  line-height:1.05;
  text-transform:uppercase;
  letter-spacing:0.18em;
  color:var(--cd-text);
  background:linear-gradient(180deg,#FFFFFF 0%,#E8DFFF 38%,#B892FF 50%,#01CDFE 100%);
  -webkit-background-clip:text; background-clip:text;
  -webkit-text-fill-color:transparent;
  text-shadow:0 1px 0 rgba(255,113,206,0.7);
}
@supports not ((-webkit-background-clip:text) or (background-clip:text)){
  .pg-${ID} .cd-name{-webkit-text-fill-color:var(--cd-text);color:var(--cd-text);}
}
.pg-${ID} .cd-tagline{
  margin:0 auto;
  max-width:24rem;
  font-size:.82rem;
  letter-spacing:0.28em;
  text-transform:uppercase;
  color:var(--cd-accent);
  text-shadow:0 0 10px rgba(1,205,254,0.5);
}
.pg-${ID} .cd-arns{
  display:inline-flex; align-items:center; gap:.45rem;
  margin:1.1rem auto 0;
  padding:.32rem .9rem;
  border-radius:999px;
  border:1px solid rgba(5,255,161,0.45);
  background:linear-gradient(180deg,rgba(255,255,255,0.12),rgba(42,10,94,0.5));
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.28),0 0 12px rgba(5,255,161,0.22);
  font-size:.72rem; font-weight:600;
  letter-spacing:0.14em;
  color:var(--cd-mint);
  text-decoration:none;
  text-shadow:0 0 8px rgba(5,255,161,0.4);
}
.pg-${ID} .cd-arns .cd-arns-dot{
  width:.5rem; height:.5rem;
  border-radius:999px;
  background:var(--cd-mint);
  box-shadow:0 0 8px var(--cd-mint),0 0 3px #fff;
  animation:cd-pulse 2.4s ease-in-out infinite;
}
@keyframes cd-pulse{ 0%,100%{opacity:1;} 50%{opacity:.45;} }
.pg-${ID} .cd-bio{
  margin:1.6rem auto 0;
  max-width:28rem;
  padding-top:1.1rem;
  border-top:1px solid rgba(184,146,255,0.35);
  font-size:.92rem;
  line-height:1.7;
  color:rgba(243,239,255,0.82);
}
.pg-${ID} .cd-heading{
  margin:2.6rem 0 1.1rem;
  font-size:.78rem;
  font-weight:700;
  letter-spacing:0.34em;
  text-transform:uppercase;
  color:var(--cd-pink);
  text-shadow:0 0 12px rgba(255,113,206,0.45);
}
.pg-${ID} .cd-link{
  position:relative;
  display:flex; align-items:center; gap:.75rem;
  width:100%;
  min-height:44px;
  margin:.7rem 0;
  padding:.85rem 1.35rem;
  box-sizing:border-box;
  border-radius:999px;
  border:1px solid rgba(1,205,254,0.5);
  background:linear-gradient(180deg,rgba(255,255,255,0.16),rgba(42,10,94,0.55));
  -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px);
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.35),inset 0 -1px 0 rgba(1,205,254,0.25),0 4px 18px rgba(10,0,34,0.45);
  color:var(--cd-text);
  font-size:1rem; font-weight:600;
  letter-spacing:0.06em;
  text-decoration:none;
  overflow:hidden;
  transition:transform .2s ease,box-shadow .2s ease;
}
.pg-${ID} .cd-link::before{
  content:"";
  position:absolute; inset:0;
  background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.65) 50%,transparent 60%);
  background-size:250% 100%;
  background-position:-120% 0;
  pointer-events:none;
}
.pg-${ID} .cd-link:hover,
.pg-${ID} .cd-link:focus-visible{
  transform:translateY(-2px);
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.5),inset 0 -1px 0 rgba(1,205,254,0.4),0 0 22px rgba(1,205,254,0.55);
}
.pg-${ID} .cd-link:hover::before,
.pg-${ID} .cd-link:focus-visible::before{
  animation:cd-sheen .9s ease forwards;
}
@keyframes cd-sheen{ from{background-position:-120% 0;} to{background-position:120% 0;} }
.pg-${ID} .cd-link .cd-ico{
  flex:0 0 1.25rem; width:1.25rem; height:1.25rem;
  display:inline-flex; align-items:center; justify-content:center;
  color:var(--cd-accent);
}
.pg-${ID} .cd-link .cd-label{flex:1 1 auto;text-align:center;}
.pg-${ID} .cd-link .cd-arrow{flex:0 0 auto;color:var(--cd-mint);opacity:.85;}
.pg-${ID} .cd-link--ar{
  border-color:rgba(5,255,161,0.55);
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.35),inset 0 -1px 0 rgba(5,255,161,0.3),0 4px 18px rgba(10,0,34,0.45);
}
.pg-${ID} .cd-link--ar:hover,
.pg-${ID} .cd-link--ar:focus-visible{
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.5),inset 0 -1px 0 rgba(5,255,161,0.45),0 0 22px rgba(5,255,161,0.55);
}
.pg-${ID} .cd-link .cd-perma{
  flex:0 0 auto;
  padding:.14rem .5rem;
  border-radius:999px;
  border:1px solid rgba(5,255,161,0.55);
  background:rgba(5,255,161,0.1);
  font-size:.6rem; font-weight:700;
  letter-spacing:0.08em;
  color:var(--cd-mint);
  text-shadow:0 0 6px rgba(5,255,161,0.5);
}
.pg-${ID} .cd-divider{
  height:1px; border:0;
  margin:2.4rem auto;
  max-width:20rem;
  background:linear-gradient(90deg,transparent,#01CDFE,#05FFA1,transparent);
  box-shadow:0 0 8px rgba(1,205,254,0.6);
}
.pg-${ID} .cd-text{
  margin:1.4rem auto;
  max-width:28rem;
  font-size:.9rem;
  line-height:1.7;
  color:rgba(243,239,255,0.82);
}
.pg-${ID} .cd-figure{margin:1.6rem auto;max-width:28rem;}
.pg-${ID} .cd-figure img{display:block;max-width:100%;height:auto;border-radius:14px;box-shadow:0 0 18px rgba(1,205,254,0.3);}
.pg-${ID} .cd-social{
  display:flex; justify-content:center; gap:.9rem;
  margin:1.6rem 0 0;
  padding:0; list-style:none;
}
.pg-${ID} .cd-social a{
  display:inline-flex; align-items:center; justify-content:center;
  width:44px; height:44px;
  border-radius:999px;
  border:1px solid rgba(1,205,254,0.5);
  background:linear-gradient(180deg,rgba(255,255,255,0.14),rgba(42,10,94,0.55));
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.3),0 0 12px rgba(1,205,254,0.25);
  color:var(--cd-accent);
  transition:transform .2s ease,box-shadow .2s ease;
}
.pg-${ID} .cd-social a:hover,
.pg-${ID} .cd-social a:focus-visible{
  transform:translateY(-2px);
  box-shadow:0 0 18px rgba(5,255,161,0.5);
  color:var(--cd-mint);
}
.pg-${ID} .cd-social svg{width:20px;height:20px;fill:currentColor;}
.pg-${ID} .cd-verify{
  display:inline-flex; align-items:center; gap:.5rem;
  margin:2.2rem auto 0;
  padding:.42rem 1rem;
  border-radius:999px;
  border:1px solid rgba(1,205,254,0.4);
  background:linear-gradient(180deg,rgba(255,255,255,0.09),rgba(42,10,94,0.42));
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.22),0 0 10px rgba(1,205,254,0.18);
  color:var(--cd-accent);
  font-size:.68rem; font-weight:600;
  letter-spacing:0.2em;
  text-transform:uppercase;
  text-decoration:none;
  text-shadow:0 0 8px rgba(1,205,254,0.4);
  transition:transform .2s ease,box-shadow .2s ease,color .2s ease;
}
.pg-${ID} .cd-verify:hover,
.pg-${ID} .cd-verify:focus-visible{
  transform:translateY(-1px);
  color:var(--cd-mint);
  box-shadow:0 0 16px rgba(5,255,161,0.4);
}
.pg-${ID} .cd-verify .cd-seal{
  font-size:.9rem; line-height:1;
  color:var(--cd-mint);
  text-shadow:0 0 8px rgba(5,255,161,0.6);
}
.pg-${ID} .cd-foot{
  margin-top:1.6rem;
  font-size:.72rem;
  letter-spacing:0.24em;
  text-transform:uppercase;
  color:rgba(243,239,255,0.55);
}
.pg-${ID} a:focus-visible,
.pg-${ID} button:focus-visible{
  outline:2px solid #05FFA1;
  outline-offset:2px;
}
@media (prefers-color-scheme:light){
  .pg-${ID}:not([data-theme="dark"]){
    background:linear-gradient(180deg,#2A0A5E 0%,#4E1E8C 40%,#B892FF 74%,#FF71CE 100%) fixed;
  }
  .pg-${ID}:not([data-theme="dark"]) .cd-link{
    background:linear-gradient(180deg,rgba(255,255,255,0.22),rgba(42,10,94,0.68));
  }
  .pg-${ID}:not([data-theme="dark"]) .cd-grid{opacity:.75;}
  .pg-${ID}:not([data-theme="dark"]) .cd-bio,
  .pg-${ID}:not([data-theme="dark"]) .cd-text{color:rgba(243,239,255,0.9);}
}
.pg-${ID}[data-theme="light"]{
  background:linear-gradient(180deg,#2A0A5E 0%,#4E1E8C 40%,#B892FF 74%,#FF71CE 100%) fixed;
}
.pg-${ID}[data-theme="light"] .cd-grid{opacity:.75;}
@media (prefers-reduced-motion:reduce){
  .pg-${ID} .cd-grid::before{animation:none;}
  .pg-${ID} .cd-arns .cd-arns-dot{animation:none;}
  .pg-${ID} .cd-link::before{display:none;}
  .pg-${ID} .cd-link,
  .pg-${ID} .cd-verify,
  .pg-${ID} .cd-social a{transition:none;}
  .pg-${ID} .cd-link:hover,
  .pg-${ID} .cd-link:focus-visible{transform:none;filter:brightness(1.12);}
}
`.trim();
}

// --- Icon + social glyph maps (static, safe markup) ----------------------------

const ICON_GLYPHS: Record<string, string> = {
  play: '▶',
  diamond: '◆',
  star: '✦',
  mail: '✉',
  music: '♫',
  note: '♪',
  heart: '♥',
  link: '↗',
  square: '▪',
  circle: '●',
  bolt: '⚡',
  sparkle: '✦',
};

function iconGlyph(name?: string): string {
  const raw = (name || '').trim();
  const key = raw.toLowerCase();
  if (key && ICON_GLYPHS[key]) return ICON_GLYPHS[key];
  // Allow a short literal glyph/emoji (non-word) to pass through as-is.
  if (raw && raw.length <= 2 && !/[a-z0-9]/i.test(raw)) return raw;
  return '◆';
}

const SOCIAL_FALLBACK =
  '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2c1.7 0 3.2 2.6 3.7 6H8.3C8.8 6.6 10.3 4 12 4zM4.1 11h3.1c.1-2 .5-3.8 1.1-5.2A8 8 0 0 0 4.1 11zm0 2a8 8 0 0 0 4.3 5.2c-.6-1.4-1-3.2-1.1-5.2H4.1zm4.2 0c.1 3.4 1.6 6 3.7 6s3.6-2.6 3.7-6H8.3zm7.5 0c-.1 2-.5 3.8-1.1 5.2A8 8 0 0 0 19.9 13h-3.1zm3.1-2a8 8 0 0 0-4.3-5.2c.6 1.4 1 3.2 1.1 5.2h3.2z"/>';

const SOCIAL_SVGS: Record<string, string> = {
  bandcamp: '<path d="M3 15l5-8h13l-5 8H3z"/>',
  soundcloud:
    '<path d="M4 17V11l1.5-.5V17H4zm3 0V9l1.5-.5V17H7zm3 0V8l1.5.6V17H10zm3 0V9.2c0-2.3 1.9-4.2 4.2-4.2 2 0 3.7 1.4 4.1 3.3 1.4.2 2.4 1.4 2.4 2.8 0 1.6-1.3 2.9-2.9 2.9H13z"/>',
  youtube:
    '<path d="M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.7-1.7C19.4 5.2 12 5.2 12 5.2s-7.4 0-8.9.4A2.5 2.5 0 0 0 1.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.7 1.7c1.5.4 8.9.4 8.9.4s7.4 0 8.9-.4a2.5 2.5 0 0 0 1.7-1.7C23 15.2 23 12 23 12zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z"/>',
  instagram:
    '<path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 3.2A6.6 6.6 0 1 0 18.6 12 6.6 6.6 0 0 0 12 5.4zm0 10.9A4.3 4.3 0 1 1 16.3 12 4.3 4.3 0 0 1 12 16.3zm6.9-11.1a1.5 1.5 0 1 1-1.5-1.5 1.5 1.5 0 0 1 1.5 1.5z"/>',
};

function socialSvg(platform: string): string {
  const key = platform.trim().toLowerCase();
  return SOCIAL_SVGS[key] || SOCIAL_FALLBACK;
}

// --- Block renderers -----------------------------------------------------------

function renderHeader(def: PageDef, ctx: RenderCtx): string {
  const p = def.profile;
  const handle = resolveHandle(def, ctx);
  const avatarSrc = p.avatar ? safeImgSrc(p.avatar, ctx) : '';
  const avatarInner = avatarSrc
    ? `<span class="cd-avatar-img"><img src="${escapeAttr(avatarSrc)}" alt="${escapeAttr(p.displayName)}" loading="lazy" /></span>`
    : `<span>${escapeHtml(avatarInitials(def))}</span>`;
  const parts: string[] = [
    `<div class="cd-avatar" aria-hidden="true">${avatarInner}</div>`,
    `<h1 class="cd-name">${escapeHtml(p.displayName)}</h1>`,
  ];
  if (p.tagline) parts.push(`<p class="cd-tagline">${escapeHtml(p.tagline)}</p>`);
  if (handle) {
    parts.push(
      `<a class="cd-arns" href="${escapeAttr(safeHref(handle.href))}"${dataArAttr(handle.dataAr)}>` +
        `<span class="cd-arns-dot" aria-hidden="true"></span>` +
        `<span>${escapeHtml(handle.text)}</span></a>`,
    );
  }
  if (p.bio) parts.push(`<p class="cd-bio">${escapeHtml(p.bio)}</p>`);
  return parts.join('');
}

function renderLink(link: LinkBlock, ctx: RenderCtx): string {
  const t = linkTarget(link.url, ctx);
  const arrow = `<span class="cd-arrow" aria-hidden="true">&#8599;</span>`;
  const label = `<span class="cd-label">${escapeHtml(link.label)}</span>`;
  const lead = t.isAr
    ? `<span class="cd-perma" aria-hidden="true">ar://</span>`
    : `<span class="cd-ico" aria-hidden="true">${escapeHtml(iconGlyph(link.icon))}</span>`;
  const cls = t.isAr ? 'cd-link cd-link--ar' : 'cd-link';
  return `<a class="${cls}" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>${lead}${label}${arrow}</a>`;
}

function renderSocial(block: SocialBlock, ctx: RenderCtx): string {
  const items = block.items
    .map((item) => {
      const t = linkTarget(item.url, ctx);
      return (
        `<li><a href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)} aria-label="${escapeAttr(item.platform)}">` +
        `<svg viewBox="0 0 24 24" aria-hidden="true">${socialSvg(item.platform)}</svg></a></li>`
      );
    })
    .join('');
  return `<ul class="cd-social">${items}</ul>`;
}

function renderVerify(block: VerifyBlock, ctx: RenderCtx): string {
  const seal = `<span class="cd-seal" aria-hidden="true">&#9672;</span>`;
  const label = `<span>${escapeHtml(block.label)}</span>`;
  const v = verifyTarget(block, ctx);
  if (!v) return `<span class="cd-verify">${seal}${label}</span>`;
  return `<a class="cd-verify" href="${escapeAttr(safeHref(v.href))}"${dataArAttr(v.dataAr)}>${seal}${label}</a>`;
}

function renderBody(def: PageDef, ctx: RenderCtx): string {
  const out: string[] = [renderHeader(def, ctx)];
  for (const block of def.blocks as Block[]) {
    switch (block.type) {
      case 'heading':
        out.push(`<h2 class="cd-heading">${escapeHtml(block.text)}</h2>`);
        break;
      case 'link':
        out.push(renderLink(block, ctx));
        break;
      case 'text':
        out.push(`<p class="cd-text">${multiline(block.text)}</p>`);
        break;
      case 'divider':
        out.push(`<hr class="cd-divider" />`);
        break;
      case 'social':
        out.push(renderSocial(block, ctx));
        break;
      case 'verify':
        out.push(renderVerify(block, ctx));
        break;
      case 'image': {
        const src = safeImgSrc(block.src, ctx);
        if (src) {
          out.push(
            `<figure class="cd-figure"><img src="${escapeAttr(src)}" alt="${escapeAttr(block.alt || '')}" loading="lazy" /></figure>`,
          );
        }
        break;
      }
      case 'embed': {
        const t = linkTarget(block.arweave, ctx);
        out.push(
          `<a class="cd-link cd-link--ar" href="${escapeAttr(safeHref(t.href))}"${dataArAttr(t.dataAr)}>` +
            `<span class="cd-perma" aria-hidden="true">ar://</span>` +
            `<span class="cd-label">${escapeHtml(block.arweave)}</span>` +
            `<span class="cd-arrow" aria-hidden="true">&#8599;</span></a>`,
        );
        break;
      }
    }
  }
  out.push(`<p class="cd-foot">&#9651; Chrome Dreams &#9651;</p>`);
  return `<div class="cd-grid" aria-hidden="true"></div><main class="cd-wrap">${out.join('')}</main>`;
}

export const chromeDreamsTemplate: PagesTemplate = {
  id: ID,
  meta: {
    name: 'Chrome Dreams',
    family: 'classic',
    description: 'Vaporwave mall at dusk: chrome avatar, neon glass links, a scrolling grid horizon.',
  },
  seed,
  render(def: PageDef, ctx: RenderCtx): RenderOutput {
    return { body: renderBody(def, ctx), style: styleFor(def) };
  },
};

export default chromeDreamsTemplate;
