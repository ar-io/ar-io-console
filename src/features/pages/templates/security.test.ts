import { describe, it, expect } from 'vitest';
import { listTemplates, renderPageHtml, type RenderCtx } from '../render/renderPageHtml';
import { validatePageDef, type PageDef, type Block } from '../schema';

/**
 * Adversarial safety net for ALL templates. Each template module is authored
 * independently, so this guards the invariant that hostile PageDef content can
 * never produce executable script, event handlers, javascript: urls, CSS/markup
 * breakout, or external asset loads in the published HTML.
 */

const ctx: RenderCtx = { gateway: 'https://turbo-gateway.com', arnsHost: 'ar.io', selfTxId: 'a'.repeat(43) };

const XSS = '</script></style></title><script>alert(1)</script><img src=x onerror=alert(2)>';
const XSS_URL = 'javascript:alert(3)';
const XSS_URL2 = '"><img src=x onerror=alert(4)>';
const CSS_INJ = 'red;}body{display:none}.x{color:';
const FONT_INJ = 'evil;} @import "x"; a{';

function poisonBlock(b: Block): Block {
  switch (b.type) {
    case 'link': return { ...b, label: XSS, url: XSS_URL };
    case 'social': return { ...b, items: b.items.map((i) => ({ ...i, platform: XSS, url: XSS_URL2 })) };
    case 'heading': return { ...b, text: XSS };
    case 'text': return { ...b, text: XSS };
    case 'image': return { ...b, src: XSS_URL, alt: XSS, link: XSS_URL2 };
    case 'embed': return { ...b, arweave: XSS_URL };
    case 'verify': return { ...b, label: XSS, url: XSS_URL };
    default: return b;
  }
}

function poison(seed: PageDef): PageDef {
  const def = validatePageDef(seed);
  return validatePageDef({
    ...def,
    title: XSS,
    profile: { ...def.profile, displayName: XSS, tagline: XSS, bio: XSS, handle: XSS },
    blocks: def.blocks.map(poisonBlock),
    theme: { ...def.theme, colors: { bg: CSS_INJ, surface: CSS_INJ, text: CSS_INJ, accent: CSS_INJ }, font: FONT_INJ },
    meta: { seoTitle: XSS, description: XSS, faviconEmoji: '"><x>' },
  });
}

/** Strip the embedded PageDef JSON island (it legitimately holds raw strings as data). */
function stripIsland(html: string): string {
  return html.replace(/<script id="ario-pagedef"[^>]*>[\s\S]*?<\/script>/i, '');
}

describe('template security — hostile content across all templates', () => {
  for (const tpl of listTemplates()) {
    it(`${tpl.id} neutralises XSS + stays self-contained`, () => {
      const html = renderPageHtml(poison(tpl.seed), ctx);
      const outside = stripIsland(html);

      // The injected markup must be neutralised (escaped), never live. Note the
      // escaped display text legitimately CONTAINS "onerror=" / "javascript:" as
      // inert characters — so we assert the *unescaped* tokens are absent, and that
      // no attribute carries a javascript: url.
      expect(outside).not.toMatch(/<script[\s>]/i); // templates never emit real <script>
      expect(outside).not.toContain('<script>alert'); // injected script neutralised
      expect(outside).not.toContain('<img src=x onerror'); // injected onerror img neutralised
      expect(outside).not.toMatch(/(?:href|src)\s*=\s*["']?\s*javascript:/i); // no js: url in an attr
      // CSS injection through theme colors/font must be sanitised away: a leaked
      // color value would break out of its declaration and inject a new rule
      // (e.g. `color:red;}body{display:none}`). Detect that breakout signature
      // rather than any `display:none` (which templates use legitimately).
      expect(outside).not.toMatch(/\}\s*body\s*\{/i);
      expect(outside).not.toContain('body{display:none');
      expect(outside).not.toContain('@import');
      // Self-contained: no external asset loads.
      expect(html).not.toMatch(/<link[^>]+rel=["']?stylesheet/i);
      expect(html).not.toMatch(/<script[^>]+src=/i);
      expect(html).not.toMatch(/@font-face/i);
      expect(html).not.toMatch(/url\(\s*["']?https?:/i);
    });
  }
});

describe('template hooks + basics on clean seeds', () => {
  for (const tpl of listTemplates()) {
    it(`${tpl.id} renders viewport, ArNS handle, ar:// intent, and is deterministic`, () => {
      const def = validatePageDef(tpl.seed);
      const a = renderPageHtml(def, ctx);
      const b = renderPageHtml(def, ctx);
      expect(a).toBe(b); // deterministic
      expect(a).toContain('name="viewport"');
      expect(a).toContain('.ar.io'); // ArNS identity/handle surfaced
      expect(a).toContain('data-ar'); // native ar:// intent marker
    });
  }
});
