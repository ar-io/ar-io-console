import { describe, it, expect } from 'vitest';
import { listTemplates, renderPageHtml, type RenderCtx } from '../render/renderPageHtml';
import { validatePageDef, type PageDef, type Block } from '../schema';

/**
 * Template robustness matrix. Users edit freely inside every template, so each
 * template's render() must never throw, never emit unsafe/external-loading HTML,
 * and always produce a well-formed self-contained page — no matter the content
 * (empty, huge, many blocks, unicode/RTL, missing fields, weird theme, etc.).
 * This guards against any of the 16 templates breaking on real user input.
 */

const ctx: RenderCtx = { gateway: 'https://arweave.net', arnsHost: 'ar.io', selfTxId: 'a'.repeat(43) };

const EVERY_BLOCK: Block[] = [
  { type: 'heading', text: 'Section' },
  { type: 'text', text: 'Some prose here.' },
  { type: 'link', label: 'My site', url: 'https://example.com', icon: 'globe' },
  { type: 'link', label: 'Permaweb', url: 'ar://myname' },
  { type: 'social', items: [{ platform: 'x', url: 'https://x.com/a' }, { platform: 'github', url: 'https://github.com/a' }] },
  { type: 'image', src: 'data:image/svg+xml;base64,PHN2Zy8+', alt: 'pic', link: 'https://example.com' },
  { type: 'embed', arweave: 'ar://someothername' },
  { type: 'divider' },
  { type: 'verify', label: 'Permanent', url: 'ar://' + 'b'.repeat(43) },
];

const LONG = 'x'.repeat(4000);
const UNICODE = '日本語 🎉 مرحبا שלום 🇺🇸 é́́ ​';

function mk(id: string, over: Partial<PageDef>): PageDef {
  return validatePageDef({ template: id, id: 'p', title: 'T', profile: { displayName: 'D' }, blocks: [], ...over });
}

/** Content cases exercised against every template. */
const CASES: Record<string, (id: string) => PageDef> = {
  'empty (all deleted)': (id) => mk(id, { title: '', profile: { displayName: '' }, blocks: [] }),
  minimal: (id) => mk(id, { profile: { displayName: 'A' }, blocks: [{ type: 'link', label: 'x', url: 'https://x.com' }] }),
  'every block type': (id) => mk(id, { blocks: EVERY_BLOCK }),
  'many blocks (40)': (id) => mk(id, { blocks: Array.from({ length: 40 }, (_, i) => ({ type: 'link', label: 'Link ' + i, url: 'https://example.com/' + i })) }),
  'unicode / rtl / emoji': (id) => mk(id, { title: UNICODE, profile: { displayName: UNICODE, tagline: UNICODE, bio: UNICODE, handle: UNICODE }, blocks: [{ type: 'heading', text: UNICODE }, { type: 'text', text: UNICODE }, { type: 'link', label: UNICODE, url: 'https://x.com' }] }),
  'very long strings': (id) => mk(id, { title: LONG, profile: { displayName: LONG, tagline: LONG, bio: LONG }, blocks: [{ type: 'text', text: LONG }, { type: 'link', label: LONG, url: 'https://example.com/' + LONG }] }),
  'missing optional fields': (id) => mk(id, { profile: { displayName: 'N' }, blocks: [{ type: 'link', label: '', url: '' }, { type: 'social', items: [] }, { type: 'heading', text: '' }, { type: 'text', text: '' }] }),
  'unknown block dropped': (id) => mk(id, { blocks: [{ type: 'link', label: 'ok', url: 'https://x.com' }, { type: 'bogus', foo: 1 } as unknown as Block] }),
  'weird theme values': (id) => {
    const d = mk(id, { blocks: EVERY_BLOCK });
    return validatePageDef({ ...d, theme: { ...d.theme, colors: { bg: 'red;}x{', surface: '', text: 'not-a-color', accent: '#GGG' }, font: 'a;} @import "x"' } });
  },
  'data-uri avatar': (id) => mk(id, { profile: { displayName: 'A', avatar: 'data:image/svg+xml;base64,PHN2Zy8+' }, blocks: EVERY_BLOCK }),
};

const ASSET = [
  /<link\b[^>]*\brel=["']?stylesheet/i,
  /<script\b[^>]*\bsrc\s*=/i,
  /@import/i,
  /@font-face/i,
  /url\(\s*["']?https?:/i,
  /<script[\s>]/i, // templates never emit a real <script> in the body
];

function stripIsland(html: string): string {
  return html.replace(/<script id="ario-pagedef"[^>]*>[\s\S]*?<\/script>/i, '');
}

describe('template robustness — every template survives every content case', () => {
  for (const tpl of listTemplates()) {
    for (const [label, build] of Object.entries(CASES)) {
      it(`${tpl.id} — ${label}`, () => {
        const def = build(tpl.id);

        let html = '';
        expect(() => { html = renderPageHtml(def, ctx); }).not.toThrow();

        // well-formed, non-empty, correctly wrapped, responsive
        expect(html.length).toBeGreaterThan(150);
        expect(html).toContain(`<div class="pg-${tpl.id}">`);
        expect(html).toContain('name="viewport"');
        expect(html).toContain('<!doctype html>');
        // balanced-ish: never leaves the <style> or the embedded island open
        expect(html).toContain('</style>');
        expect(html.match(/<script id="ario-pagedef"/g)?.length ?? 0).toBe(1);
        expect(html).toContain('</html>');

        // self-contained: no external asset loads (nav hrefs are fine)
        const outside = stripIsland(html);
        for (const pat of ASSET) expect(outside).not.toMatch(pat);

        // no injection escaped the sanitizers even with hostile-ish content
        expect(outside).not.toMatch(/<img[^>]+\son\w+\s*=/i);
        expect(outside).not.toMatch(/(?:href|src)\s*=\s*["']?\s*javascript:/i);
        expect(outside).not.toMatch(/\}\s*body\s*\{/i);
      });
    }
  }
});
