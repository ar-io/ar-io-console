/**
 * renderPageHtml — assemble a complete, self-contained HTML document from a
 * PageDef. The document embeds the PageDef (for re-hydration), includes SEO /
 * Open Graph / Twitter / favicon metadata, and carries the template's scoped
 * skin. Output is deterministic (no clocks, no randomness) and contains NO
 * external asset loads (PRD §7.6, §11).
 */

import type { PageDef, TemplateId } from '../schema';
import { escapeAttr, escapeHtml } from './escape';
import { resolveArUrl, type ResolveCtx } from './arResolve';
import { templates } from '../templates';

export type TemplateFamily = 'classic' | 'modern' | 'developer' | 'wildcard';

export interface TemplateMeta {
  name: string;
  family: TemplateFamily;
  description: string;
}

/** Resolution context plus the page's own identity, available to templates. */
export interface RenderCtx extends ResolveCtx {
  /** The page's own transaction id (for the verify/permalink affordance). */
  selfTxId?: string;
  /** The page's canonical ArNS name, e.g. `myname`. */
  arnsName?: string;
}

export interface RenderOutput {
  /** Inner body markup (rendered inside the `.pg-<id>` wrapper). */
  body: string;
  /** Scoped `<style>` contents for this template's skin. */
  style: string;
}

/**
 * A template is a self-describing render module: a seed PageDef plus a pure
 * `render` that turns any PageDef into its bespoke markup + scoped skin. New
 * templates are added by dropping a module into `../templates` — the renderer
 * needs no changes.
 */
export interface PagesTemplate {
  id: TemplateId;
  meta: TemplateMeta;
  seed: PageDef;
  render(def: PageDef, ctx: RenderCtx): RenderOutput;
}

/** Look up a template by id. Throws a clear error for unknown/unimplemented ids. */
export function getTemplate(id: TemplateId): PagesTemplate {
  const template = templates[id];
  if (!template) {
    throw new Error(`getTemplate: no Pages template registered for id "${id}"`);
  }
  return template;
}

/** All registered templates. */
export function listTemplates(): PagesTemplate[] {
  return Object.values(templates).filter((t): t is PagesTemplate => Boolean(t));
}

/** Render an emoji into a tiny inline SVG data-URI suitable for a favicon. */
function faviconDataUri(emoji: string): string {
  const glyph = escapeHtml(emoji);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<text x="50%" y="52%" dominant-baseline="central" text-anchor="middle" font-size="52">${glyph}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Serialise the PageDef for the embedded `<script type="application/json">`.
 * Escaping `<` as `<` prevents a `</script>` breakout while remaining valid
 * JSON that `JSON.parse` restores exactly.
 */
function embedPageDef(def: PageDef): string {
  return JSON.stringify(def).replace(/</g, '\\u003c');
}

export function renderPageHtml(def: PageDef, ctx: RenderCtx): string {
  const template = getTemplate(def.template);
  const { body, style } = template.render(def, ctx);

  const title = def.meta?.seoTitle || def.title || def.profile.displayName || 'Page';
  const description = def.meta?.description || def.profile.tagline || def.profile.bio || '';
  const favicon = faviconDataUri(def.meta?.faviconEmoji || '🔗');
  const ogImage = def.meta?.ogImage ? resolveArUrl(def.meta.ogImage, ctx) : '';

  const head: string[] = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
  ];
  if (description) head.push(`<meta name="description" content="${escapeAttr(description)}">`);

  // Open Graph
  head.push('<meta property="og:type" content="website">');
  head.push(`<meta property="og:title" content="${escapeAttr(title)}">`);
  if (description) head.push(`<meta property="og:description" content="${escapeAttr(description)}">`);
  if (ogImage) head.push(`<meta property="og:image" content="${escapeAttr(ogImage)}">`);

  // Twitter Card
  head.push(`<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">`);
  head.push(`<meta name="twitter:title" content="${escapeAttr(title)}">`);
  if (description) head.push(`<meta name="twitter:description" content="${escapeAttr(description)}">`);
  if (ogImage) head.push(`<meta name="twitter:image" content="${escapeAttr(ogImage)}">`);

  head.push(`<link rel="icon" href="${escapeAttr(favicon)}">`);
  head.push(`<style>${style}</style>`);
  head.push(`<script id="ario-pagedef" type="application/json">${embedPageDef(def)}</script>`);

  return (
    '<!doctype html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    head.join('\n') +
    '\n</head>\n' +
    '<body>\n' +
    `<div class="pg-${def.template}">${body}</div>\n` +
    '</body>\n' +
    '</html>'
  );
}
