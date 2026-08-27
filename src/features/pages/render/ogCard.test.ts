import { describe, it, expect } from 'vitest';
import { buildOgCardSvg, OG_WIDTH, OG_HEIGHT } from './ogCard';
import { listTemplates } from './renderPageHtml';
import type { PageDef } from '../schema';

/** A known-valid PageDef to mutate (deep-cloned so tests never share state). */
const base = (): PageDef => JSON.parse(JSON.stringify(listTemplates()[0].seed));

function make(profile: Partial<PageDef['profile']> = {}, theme?: Partial<PageDef['theme']>): PageDef {
  const d = base();
  d.profile = { ...d.profile, ...profile } as PageDef['profile'];
  if (theme) d.theme = { ...d.theme, ...theme } as PageDef['theme'];
  return d;
}

describe('buildOgCardSvg', () => {
  it('emits a well-formed 1200×630 SVG', () => {
    const svg = buildOgCardSvg(make());
    expect(OG_WIDTH).toBe(1200);
    expect(OG_HEIGHT).toBe(630);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
    expect(svg).toContain('viewBox="0 0 1200 630"');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    // balanced-ish: exactly one root svg
    expect(svg.match(/<svg/g)?.length).toBe(1);
    expect(svg.match(/<\/svg>/g)?.length).toBe(1);
  });

  it('renders the display name, tagline, and handle', () => {
    const svg = buildOgCardSvg(make({ displayName: 'Ada Lovelace', tagline: 'Computing pioneer', handle: 'ada.ar.io' }));
    expect(svg).toContain('Ada Lovelace');
    expect(svg).toContain('Computing pioneer');
    expect(svg).toContain('ada.ar.io');
  });

  it('strips ar:// and https:// prefixes from the handle', () => {
    expect(buildOgCardSvg(make({ handle: 'https://ada.ar.io' }))).toContain('>ada.ar.io<');
    expect(buildOgCardSvg(make({ handle: 'ar://ada.ar.io' }))).toContain('>ada.ar.io<');
  });

  it('escapes hostile content — no tag/attribute breakout', () => {
    const evil = '</text></svg><script>alert(1)</script>';
    const svg = buildOgCardSvg(make({ displayName: evil, tagline: evil, handle: evil }));
    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('</svg><script');
    // still exactly one closing svg (the real one)
    expect(svg.match(/<\/svg>/g)?.length).toBe(1);
    expect(svg).toContain('&lt;script&gt;');
  });

  it('escapes quotes so an avatar data URI cannot break out of the href attribute', () => {
    const svg = buildOgCardSvg(make({ avatar: 'data:image/png;base64,AAA"><script>alert(1)</script>' }));
    expect(svg).not.toContain('"><script>');
    expect(svg).toContain('&quot;');
  });

  it('sanitises theme colors (valid ones pass through, hostile ones fall back)', () => {
    const ok = buildOgCardSvg(make({}, { colors: { bg: '#FF00AA', surface: '#00FFAA', text: '#AA00FF', accent: '#FFAA00' } } as any));
    expect(ok).toContain('#FF00AA');
    expect(ok).toContain('#FFAA00');
    const evil = buildOgCardSvg(make({}, { colors: { bg: 'red;}</style><script>', surface: 'x', text: 'y', accent: 'url(evil)' } } as any));
    expect(evil).not.toContain('</style>');
    expect(evil).not.toContain('url(evil)');
    expect(evil).not.toContain('script>');
  });

  it('embeds a raster data-URI avatar as an <image>, else draws a monogram', () => {
    const withPhoto = buildOgCardSvg(make({ displayName: 'Ada Lovelace', avatar: 'data:image/png;base64,iVBORw0KGgo=' }));
    expect(withPhoto).toContain('<image');
    expect(withPhoto).toContain('data:image/png;base64,iVBORw0KGgo=');

    const noPhoto = buildOgCardSvg(make({ displayName: 'Ada Lovelace', avatar: '' }));
    expect(noPhoto).not.toContain('<image');
    expect(noPhoto).toContain('AL'); // monogram initials, uppercased
  });

  it('does NOT embed an SVG data URI or ar:// avatar (monogram fallback)', () => {
    expect(buildOgCardSvg(make({ avatar: 'data:image/svg+xml;base64,PHN2Zz4=' }))).not.toContain('<image');
    expect(buildOgCardSvg(make({ avatar: 'ar://abc' }))).not.toContain('<image');
    expect(buildOgCardSvg(make({ avatar: 'https://example.com/a.png' }))).not.toContain('<image');
  });

  it('clips overlong text and never overruns', () => {
    const long = 'x'.repeat(300);
    const svg = buildOgCardSvg(make({ displayName: long, tagline: long, handle: long }));
    expect(svg).not.toContain('x'.repeat(80));
    expect(svg).toContain('…');
  });

  it('handles a minimal/empty profile without throwing', () => {
    expect(() => buildOgCardSvg(make({ displayName: '', tagline: '', bio: '', handle: '', avatar: '' }))).not.toThrow();
    const svg = buildOgCardSvg(make({ displayName: '', tagline: '', handle: '' }));
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('handles unicode/emoji safely', () => {
    const svg = buildOgCardSvg(make({ displayName: '日本語 😀 Café', tagline: 'Ω≈ç√' }));
    expect(svg).toContain('日本語');
    expect(svg).toContain('😀');
  });

  it('is deterministic — same input, same output', () => {
    const d = make({ displayName: 'Repeat', tagline: 'Test', handle: 'r.ar.io' });
    expect(buildOgCardSvg(d)).toBe(buildOgCardSvg(d));
  });

  it('renders every template seed without throwing and stays self-contained', () => {
    for (const tpl of listTemplates()) {
      const svg = buildOgCardSvg(tpl.seed);
      expect(svg.startsWith('<svg'), tpl.id).toBe(true);
      // no external network references (data: is fine — it's inline)
      expect(/(?:href|src)\s*=\s*"https?:/i.test(svg), `${tpl.id} has external ref`).toBe(false);
    }
  });
});
