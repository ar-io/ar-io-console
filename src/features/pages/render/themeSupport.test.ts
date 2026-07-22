import { describe, it, expect } from 'vitest';
import { listTemplates } from './renderPageHtml';
import { detectThemeSupport, getThemeSupport, rendersLinkIcon, type ThemeAxis } from './themeSupport';

const seedOf = (id: string) => listTemplates().find((t) => t.id === id)!.seed;

describe('detectThemeSupport', () => {
  it('is deterministic for a given seed', () => {
    const seed = seedOf('link-classic');
    expect([...detectThemeSupport(seed)].sort()).toEqual([...detectThemeSupport(seed)].sort());
  });

  it('every template honors at least accent + font (no fully-dead theme controls)', () => {
    for (const tpl of listTemplates()) {
      const s = detectThemeSupport(tpl.seed);
      expect(s.has('accent'), `${tpl.id} must honor accent`).toBe(true);
      expect(s.has('font'), `${tpl.id} must honor font`).toBe(true);
    }
  });

  it('a fully-themeable template honors all color axes', () => {
    const s = detectThemeSupport(seedOf('link-classic'));
    for (const axis of ['bg', 'surface', 'text', 'accent', 'font'] as ThemeAxis[]) {
      expect(s.has(axis), `link-classic should honor ${axis}`).toBe(true);
    }
  });

  it('a designed template honors accent + font but bakes bg/surface/text', () => {
    const s = detectThemeSupport(seedOf('sunset-gradient'));
    expect(s.has('accent')).toBe(true);
    expect(s.has('font')).toBe(true);
    expect(s.has('bg')).toBe(false);
    expect(s.has('surface')).toBe(false);
    expect(s.has('text')).toBe(false);
  });

  it('spotlight + pastel-pop honor accent + font (regression for the theming fix)', () => {
    for (const id of ['spotlight', 'pastel-pop']) {
      const s = detectThemeSupport(seedOf(id));
      expect(s.has('accent'), `${id} accent`).toBe(true);
      expect(s.has('font'), `${id} font`).toBe(true);
    }
  });
});

describe('rendersLinkIcon', () => {
  // Templates that don't render a link's emoji icon — the editor hides the field.
  // man-page is included: it only acts on a 'lock' sentinel, not arbitrary emoji.
  const NO_ICON = new Set([
    'grid-system', 'man-page', 'raw-concrete', 'readme-md', 'shell-session',
    't-minus', 'teletext', 'the-arcana', 'top-eight', 'xerox-riot',
  ]);

  it('classifies every template correctly (true unless it ignores the emoji)', () => {
    for (const tpl of listTemplates()) {
      expect(rendersLinkIcon(tpl.id), tpl.id).toBe(!NO_ICON.has(tpl.id));
    }
  });

  it('detects templates that transform the icon (slice/humanise/map), not just verbatim', () => {
    // These render the emoji but reshape it — a verbatim check would wrongly hide them.
    for (const id of ['business-card', 'chrome-dreams', 'the-masthead']) {
      expect(rendersLinkIcon(id as never), id).toBe(true);
    }
  });
});

describe('getThemeSupport', () => {
  it('matches detectThemeSupport and caches by template id', () => {
    const tpl = listTemplates()[0];
    const direct = detectThemeSupport(tpl.seed);
    const viaId = getThemeSupport(tpl.id);
    expect([...viaId].sort()).toEqual([...direct].sort());
    // Cached: repeat call returns the same Set instance.
    expect(getThemeSupport(tpl.id)).toBe(viaId);
  });
});
