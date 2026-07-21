import { describe, it, expect } from 'vitest';
import { buildPageFile, canonicalJson, computeDefHash, slugify } from './pageFile';
import { validatePageDef, type PageDef } from '../schema';

const baseDef: PageDef = validatePageDef({
  template: 'grid-system',
  id: 'page-1',
  title: 'My Page',
  profile: { displayName: 'Me', tagline: 'hi' },
  blocks: [
    { type: 'heading', text: 'Links' },
    { type: 'link', label: 'Site', url: 'https://example.com' },
  ],
});

describe('computeDefHash', () => {
  it('is deterministic for the same def', () => {
    expect(computeDefHash(baseDef)).toBe(computeDefHash(baseDef));
  });

  it('returns a 16-char hex digest', () => {
    expect(computeDefHash(baseDef)).toMatch(/^[0-9a-f]{16}$/);
  });

  it('changes when the def content changes', () => {
    const edited: PageDef = { ...baseDef, title: 'My Page (edited)' };
    expect(computeDefHash(edited)).not.toBe(computeDefHash(baseDef));
  });

  it('ignores volatile timestamps (edit-then-revert dedups correctly)', () => {
    const touched: PageDef = { ...baseDef, createdAt: 111, updatedAt: 999 };
    const other: PageDef = { ...baseDef, createdAt: 222, updatedAt: 1000 };
    expect(computeDefHash(touched)).toBe(computeDefHash(other));
  });

  it('changes when a block is added', () => {
    const withBlock: PageDef = {
      ...baseDef,
      blocks: [...baseDef.blocks, { type: 'divider' }],
    };
    expect(computeDefHash(withBlock)).not.toBe(computeDefHash(baseDef));
  });

  it('is stable across object key insertion order', () => {
    // Same logical content, keys inserted in a different order.
    const a = { id: 'x', title: 'T', profile: { displayName: 'D', tagline: 't' } };
    const b = { profile: { tagline: 't', displayName: 'D' }, title: 'T', id: 'x' };
    const defA = validatePageDef({ template: 'grid-system', blocks: [], ...a });
    const defB = validatePageDef({ template: 'grid-system', blocks: [], ...b });
    expect(computeDefHash(defA)).toBe(computeDefHash(defB));
  });
});

describe('canonicalJson', () => {
  it('sorts keys recursively so key order does not matter', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(
      canonicalJson({ a: { c: 3, d: 2 }, b: 1 }),
    );
  });

  it('preserves array order (arrays are order-significant)', () => {
    expect(canonicalJson([1, 2, 3])).not.toBe(canonicalJson([3, 2, 1]));
  });
});

describe('slugify', () => {
  it('lowercases and dash-separates', () => {
    expect(slugify("Ariana's Links")).toBe('ariana-s-links');
  });

  it('trims leading/trailing separators', () => {
    expect(slugify('  Hello World!  ')).toBe('hello-world');
  });

  it('falls back to "page" for empty/symbol-only titles', () => {
    expect(slugify('')).toBe('page');
    expect(slugify('!!!')).toBe('page');
  });

  it('caps the length at 60 chars with no trailing dash', () => {
    const s = slugify('a'.repeat(80));
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith('-')).toBe(false);
  });
});

describe('buildPageFile', () => {
  it('produces a text/html File named `${slug}.html`', () => {
    const file = buildPageFile('<!doctype html><html></html>', 'my-page');
    expect(file.name).toBe('my-page.html');
    expect(file.type).toBe('text/html');
    expect(file.size).toBeGreaterThan(0);
  });

  it('sanitises an unslugged title passed as the slug', () => {
    const file = buildPageFile('<html></html>', "Ariana's Links");
    expect(file.name).toBe('ariana-s-links.html');
  });

  it('embeds the html bytes', async () => {
    const html = '<!doctype html><title>hi</title>';
    const file = buildPageFile(html, 'x');
    expect(await file.text()).toBe(html);
  });
});
