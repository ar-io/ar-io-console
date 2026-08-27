import { describe, it, expect } from 'vitest';
import { parsePageHtml } from './parsePageHtml';
import { renderPageHtml, type RenderCtx } from './renderPageHtml';
import { validatePageDef } from '../schema';
import { gridSystemTemplate } from '../templates/grid-system';
import { dialUpHomesteadTemplate } from '../templates/dial-up-homestead';

const ctx: RenderCtx = { gateway: 'https://turbo-gateway.com', arnsHost: 'ar.io' };

describe('parsePageHtml — round-trip with renderPageHtml', () => {
  it('recovers the grid-system def exactly', () => {
    const def = validatePageDef(gridSystemTemplate.seed);
    const html = renderPageHtml(def, ctx);
    expect(parsePageHtml(html)).toEqual(def);
  });

  it('recovers the dial-up def exactly (including < in content)', () => {
    const def = validatePageDef(dialUpHomesteadTemplate.seed);
    const html = renderPageHtml(def, ctx);
    const parsed = parsePageHtml(html);
    expect(parsed).toEqual(def);
    // sanity: the seed content that contains "<3" round-trips through the < escaping
    const hasLtContent = def.blocks.some((b) => b.type === 'text' && b.text.includes('<'));
    expect(hasLtContent).toBe(true);
  });
});

describe('parsePageHtml — failure modes', () => {
  it('returns null when the pagedef marker is absent', () => {
    expect(parsePageHtml('<!doctype html><html><body>no pagedef here</body></html>')).toBeNull();
  });

  it('returns null when the embedded JSON is malformed', () => {
    const html =
      '<script id="ario-pagedef" type="application/json">{ not valid json </script>';
    expect(parsePageHtml(html)).toBeNull();
  });

  it('returns null for non-string input', () => {
    // @ts-expect-error — exercising defensive runtime guard
    expect(parsePageHtml(undefined)).toBeNull();
  });
});
