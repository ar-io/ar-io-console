/**
 * Social-preview (OG) card generator for Pages.
 *
 * Produces a 1200×630 SVG that mirrors the page's theme. At publish time it is
 * rasterised to PNG and uploaded so a shared page link renders a real preview
 * image — social crawlers require a hosted https image (a `data:` URI won't do),
 * hence the upload. This module is PURE + DETERMINISTIC: every user string is
 * escaped and every theme value is sanitised (via the shared template helpers),
 * so hostile content can never break out of the SVG (same safety model as the
 * page templates). The avatar is embedded only when it is a `data:image` URI;
 * anything else (ar:// / https / initials) renders as an initials monogram, which
 * keeps the SVG self-contained and safe to rasterise without cross-origin taint.
 */
import type { PageDef } from '../schema';
import { escapeHtml, cssColor, initials } from '../templates/shared';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Collapse whitespace, trim, and ellipsise so text can't overrun the card. */
function clip(s: string | undefined, max: number): string {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + '…';
}

/** Build the social-preview card for a page as a 1200×630 SVG string. */
export function buildOgCardSvg(def: PageDef): string {
  const colors = def.theme?.colors;
  const bg = cssColor(colors?.bg ?? '', '#0B1026');
  const surface = cssColor(colors?.surface ?? '', '#1A2142');
  const text = cssColor(colors?.text ?? '', '#FFFFFF');
  const accent = cssColor(colors?.accent ?? '', '#5427C8');

  const name = clip(def.profile?.displayName || def.title, 24) || 'Untitled page';
  const tagline = clip(def.profile?.tagline || def.profile?.bio, 72);
  const handle = clip((def.profile?.handle || '').replace(/^https?:\/\//i, '').replace(/^ar:\/\//i, ''), 34);
  const inits = escapeHtml(initials(def.profile?.displayName || name).slice(0, 2).toUpperCase());

  const avatar = (def.profile?.avatar || '').trim();
  // Embed only raster data-URI avatars: they rasterise cleanly and can't pull an
  // external resource. SVG data URIs / ar:// / https fall back to the monogram.
  const isDataImg = /^data:image\/(png|jpe?g|gif|webp|avif)[;,]/i.test(avatar);
  const cx = 168, cy = 300, r = 104;

  const avatarEl = isDataImg
    ? `<clipPath id="pfp"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>` +
      // both xlink:href + href so the embedded image rasterises across browsers
      `<image xlink:href="${escapeHtml(avatar)}" href="${escapeHtml(avatar)}" x="${cx - r}" y="${cy - r}" ` +
      `width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#pfp)"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${accent}" stroke-width="5"/>`
    : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${accent}"/>` +
      `<text x="${cx}" y="${cy + 6}" fill="${text}" font-family="${FONT}" font-size="80" font-weight="800" ` +
      `text-anchor="middle" dominant-baseline="central">${inits}</text>`;

  const bodyX = 316;
  const nameEl = `<text x="${bodyX}" y="278" fill="${text}" font-family="${FONT}" font-size="58" font-weight="800">${escapeHtml(name)}</text>`;
  const taglineEl = tagline
    ? `<text x="${bodyX}" y="336" fill="${text}" fill-opacity="0.72" font-family="${FONT}" font-size="32">${escapeHtml(tagline)}</text>`
    : '';
  const handleEl = handle
    ? `<rect x="${bodyX}" y="${tagline ? 372 : 320}" width="${Math.min(760, handle.length * 18 + 48)}" height="52" rx="26" fill="${accent}" fill-opacity="0.2"/>` +
      `<text x="${bodyX + 28}" y="${(tagline ? 372 : 320) + 34}" fill="${accent}" font-family="${FONT}" font-size="27" font-weight="700">${escapeHtml(handle)}</text>`
    : '';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">` +
    `<defs><linearGradient id="ogbg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${surface}"/>` +
    `</linearGradient></defs>` +
    `<rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#ogbg)"/>` +
    `<circle cx="1060" cy="110" r="260" fill="${accent}" fill-opacity="0.14"/>` +
    avatarEl +
    nameEl +
    taglineEl +
    handleEl +
    `<text x="60" y="582" fill="${text}" fill-opacity="0.5" font-family="${FONT}" font-size="24" font-weight="600">Permanent on ar.io</text>` +
    `</svg>`
  );
}
