import { describe, it, expect } from 'vitest';
import { getTemplate, listTemplates, renderPageHtml, type RenderCtx } from './renderPageHtml';
import { validatePageDef, type PageDef, type TemplateId } from '../schema';
import { gridSystemTemplate } from '../templates/grid-system';
import { dialUpHomesteadTemplate } from '../templates/dial-up-homestead';

const ctx: RenderCtx = { gateway: 'https://turbo-gateway.com', arnsHost: 'ar.io' };

const gridDef = validatePageDef(gridSystemTemplate.seed);
const dialDef = validatePageDef(dialUpHomesteadTemplate.seed);

describe('renderPageHtml — document shell', () => {
  const html = renderPageHtml(gridDef, ctx);

  it('is a complete document', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
  });

  it('includes a responsive viewport meta', () => {
    expect(html).toMatch(/<meta name="viewport" content="width=device-width, initial-scale=1">/);
  });

  it('includes SEO + Open Graph + Twitter metadata', () => {
    expect(html).toContain('<meta name="description"');
    expect(html).toContain('<meta property="og:title"');
    expect(html).toContain('<meta property="og:type" content="website">');
    expect(html).toContain('<meta name="twitter:card"');
  });

  it('embeds an emoji favicon as an inline SVG data URI', () => {
    expect(html).toMatch(/<link rel="icon" href="data:image\/svg\+xml,/);
  });

  it('embeds the PageDef as an application/json script (with < escaped)', () => {
    expect(html).toContain('<script id="ario-pagedef" type="application/json">');
    // no unescaped `<` may appear inside the embedded JSON payload
    const start = html.indexOf('type="application/json">') + 'type="application/json">'.length;
    const end = html.indexOf('</script>', start);
    const json = html.slice(start, end);
    expect(json.includes('<')).toBe(false);
  });
});

describe('renderPageHtml — self-contained (no external asset loads)', () => {
  const samples = [renderPageHtml(gridDef, ctx), renderPageHtml(dialDef, ctx)];

  it('loads no external stylesheet', () => {
    for (const html of samples) expect(html).not.toMatch(/<link[^>]+rel=["']?stylesheet/i);
  });
  it('loads no external script', () => {
    for (const html of samples) expect(html).not.toMatch(/<script[^>]+src=/i);
  });
  it('uses no @import or url() asset references', () => {
    for (const html of samples) {
      expect(html).not.toContain('@import');
      expect(html).not.toMatch(/url\(/i);
    }
  });
});

describe('renderPageHtml — applies the correct template', () => {
  it('wraps the body in the template id class and emits template markup', () => {
    const grid = renderPageHtml(gridDef, ctx);
    expect(grid).toContain('<div class="pg-grid-system">');
    expect(grid).toContain('class="pg-shell"');
    expect(grid).toContain('class="pg-rows"');

    const dial = renderPageHtml(dialDef, ctx);
    expect(dial).toContain('<div class="pg-dial-up-homestead">');
    expect(dial).toContain('class="construction"');
    expect(dial).toContain('class="btn"');
  });

  it('resolves ar:// links to gateway/ArNS urls and preserves native intent', () => {
    const grid = renderPageHtml(gridDef, ctx);
    // seed link ar://akkurat -> https://akkurat.ar.io + preserved data-ar
    expect(grid).toContain('href="https://akkurat.ar.io"');
    expect(grid).toContain('data-ar="ar://akkurat"');
    // the verify block tx resolves against the gateway
    expect(grid).toContain('https://turbo-gateway.com/a34Zp9Kd1QmXv7Ns2Rt5Lb8Yz3Fc6Hg0Jw4Ue1Oi9Pq');
  });
});

describe('renderPageHtml — escaping / XSS', () => {
  const evil: PageDef = validatePageDef({
    template: 'grid-system',
    profile: { displayName: 'Mallory' },
    blocks: [
      {
        type: 'link',
        label: "<script>alert('xss')</script>",
        url: "javascript:alert('xss')",
      },
    ],
  });
  const html = renderPageHtml(evil, ctx);

  it('escapes a malicious link label in the rendered markup', () => {
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain("<script>alert('xss')</script>");
  });

  it('neutralises a javascript: href via the scheme allowlist', () => {
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('href="#"');
  });
});

describe('renderPageHtml — deterministic', () => {
  it('produces identical output for identical input', () => {
    expect(renderPageHtml(gridDef, ctx)).toBe(renderPageHtml(gridDef, ctx));
    expect(renderPageHtml(dialDef, ctx)).toBe(renderPageHtml(dialDef, ctx));
  });
});

describe('template registry accessors', () => {
  it('lists all 32 templates and looks them up by id', () => {
    expect(listTemplates().length).toBe(32);
    expect(getTemplate('grid-system').id).toBe('grid-system');
    expect(getTemplate('dial-up-homestead').id).toBe('dial-up-homestead');
    expect(getTemplate('the-arcana').id).toBe('the-arcana');
  });
  it('throws a clear error for an unregistered template id', () => {
    expect(() => getTemplate('not-a-real-template' as unknown as TemplateId)).toThrow(
      /no Pages template/i,
    );
  });
});
