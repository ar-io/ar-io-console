import { describe, it, expect } from 'vitest';
import { templates } from './index';
import { getTemplate, listTemplates, renderPageHtml, type RenderCtx } from '../render/renderPageHtml';
import { validatePageDef, type TemplateId } from '../schema';

const ctx: RenderCtx = { gateway: 'https://turbo-gateway.com', arnsHost: 'ar.io' };

const all = listTemplates();

describe('template registry', () => {
  it('registers all 32 templates', () => {
    expect(all.length).toBe(32);
    const ids = all.map((t) => t.id);
    expect(ids).toContain('grid-system');
    expect(ids).toContain('dial-up-homestead');
    expect(ids).toContain('the-arcana');
    expect(ids).toContain('t-minus');
  });

  it('has unique ids that match their registry keys', () => {
    const ids = all.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [key, tpl] of Object.entries(templates)) {
      expect(tpl?.id).toBe(key);
    }
  });

  it('every seed validates and keeps its id/template', () => {
    for (const tpl of all) {
      const validated = validatePageDef(tpl.seed);
      expect(validated.template).toBe(tpl.id);
      // seeds are authored in canonical form, so validation is a no-op
      expect(validated).toEqual(tpl.seed);
    }
  });

  it('every template renders a non-empty, self-contained body', () => {
    for (const tpl of all) {
      const out = tpl.render(validatePageDef(tpl.seed), ctx);
      expect(out.body.length).toBeGreaterThan(0);
      expect(out.style.length).toBeGreaterThan(0);
      expect(out.style).toContain(`.pg-${tpl.id}`);

      const html = renderPageHtml(validatePageDef(tpl.seed), ctx);
      expect(html).toContain(`<div class="pg-${tpl.id}">`);
      expect(html).not.toMatch(/<link[^>]+rel=["']?stylesheet/i);
      expect(html).not.toMatch(/<script[^>]+src=/i);
      expect(html).not.toContain('@import');
      expect(html).not.toMatch(/url\(/i);
    }
  });

  it('exposes template metadata (name, family, description)', () => {
    for (const tpl of all) {
      expect(tpl.meta.name).toBeTruthy();
      expect(['classic', 'modern', 'creator', 'pro', 'developer', 'wildcard']).toContain(tpl.meta.family);
      expect(tpl.meta.description).toBeTruthy();
    }
  });

  it('getTemplate throws for an unregistered id', () => {
    expect(() => getTemplate('not-a-real-template' as unknown as TemplateId)).toThrow();
  });
});
