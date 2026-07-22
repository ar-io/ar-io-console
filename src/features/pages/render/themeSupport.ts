/**
 * Theme-capability detection for Pages templates.
 *
 * Templates vary in how much of the theme they honor: the classic ones respond to
 * every color/font/layout axis, while several "designed" templates bake parts of
 * their palette (a fixed gradient, a set surface) as part of their visual identity.
 * The editor uses this to show only the controls a template actually responds to,
 * instead of dead sliders.
 *
 * Detection is empirical, not declared: we render the template's seed, then render
 * it again with one axis changed to distinct value(s), strip the embedded PageDef
 * JSON island (which always echoes the theme as data), and compare the remaining
 * CSS/markup. If it changed, the template honors that axis. Empirical means it can
 * never drift out of sync with the template code — no per-template annotations to
 * maintain. Pure + deterministic; results are cached per template id.
 */
import { renderPageHtml, type RenderCtx } from './renderPageHtml';
import { templates } from '../templates';
import type { LinkBlock, PageDef, TemplateId } from '../schema';

export type ThemeAxis =
  | 'bg'
  | 'surface'
  | 'text'
  | 'accent'
  | 'font'
  | 'buttonShape'
  | 'background'
  | 'headerAlign'
  | 'linkStyle'
  | 'width';

export const THEME_AXES: readonly ThemeAxis[] = [
  'bg', 'surface', 'text', 'accent', 'font', 'buttonShape', 'background', 'headerAlign', 'linkStyle', 'width',
];

// Ctx values are irrelevant — we compare structural output, not resolved URLs.
const PROBE_CTX: RenderCtx = { gateway: 'https://g', arnsHost: 'ar.io' };

// Distinctive probe values, unlikely to collide with a template's own palette.
const COLOR_POISON: Record<'bg' | 'surface' | 'text' | 'accent', string> = {
  bg: '#FF00AA',
  surface: '#00FFAA',
  text: '#AA00FF',
  accent: '#FFAA00',
};
const FONT_POISON = 'Zilla Slab, serif';

// Enum axes: render across every option; if outputs differ the template honors it.
const ENUM_VALUES: Record<'buttonShape' | 'background' | 'headerAlign' | 'linkStyle' | 'width', string[]> = {
  buttonShape: ['pill', 'rounded', 'square'],
  background: ['gradient', 'solid'],
  headerAlign: ['center', 'left'],
  linkStyle: ['button', 'card', 'grid'],
  width: ['standard', 'wide'],
};

const clone = (d: PageDef): PageDef => JSON.parse(JSON.stringify(d));

function withAxis(seed: PageDef, axis: ThemeAxis, value: string): PageDef {
  const d = clone(seed);
  switch (axis) {
    case 'bg':
    case 'surface':
    case 'text':
    case 'accent':
      d.theme.colors[axis] = value;
      break;
    case 'font':
      d.theme.font = value;
      break;
    case 'buttonShape':
      d.theme.buttonShape = value as PageDef['theme']['buttonShape'];
      break;
    case 'background':
      d.theme.background = value;
      break;
    case 'headerAlign':
      d.layout.headerAlign = value as PageDef['layout']['headerAlign'];
      break;
    case 'linkStyle':
      d.layout.linkStyle = value as PageDef['layout']['linkStyle'];
      break;
    case 'width':
      d.layout.width = value as PageDef['layout']['width'];
      break;
  }
  return d;
}

// The embedded PageDef JSON island echoes theme/layout verbatim, so it always
// "changes" when we poison an axis. Strip it so we compare only rendered output.
const stripIsland = (html: string): string =>
  html.replace(/<script id="ario-pagedef"[^>]*>[\s\S]*?<\/script>/i, '');

const renderStructural = (d: PageDef): string => stripIsland(renderPageHtml(d, PROBE_CTX));

function axisHonored(seed: PageDef, axis: ThemeAxis): boolean {
  if (axis === 'bg' || axis === 'surface' || axis === 'text' || axis === 'accent') {
    return renderStructural(seed) !== renderStructural(withAxis(seed, axis, COLOR_POISON[axis]));
  }
  if (axis === 'font') {
    return renderStructural(seed) !== renderStructural(withAxis(seed, axis, FONT_POISON));
  }
  const outputs = new Set(ENUM_VALUES[axis].map((v) => renderStructural(withAxis(seed, axis, v))));
  return outputs.size > 1;
}

/**
 * Detect the set of theme axes a template's seed actually responds to.
 *
 * Probed against the seed's own blocks; an axis a template honors only when a
 * particular block type is present would read as unsupported if the seed lacks it.
 * Fine today — every seed carries representative (incl. link) blocks, and the
 * block-conditional axes aren't read by any template. Augment the probe blocks if
 * that changes.
 */
export function detectThemeSupport(seed: PageDef): Set<ThemeAxis> {
  const supported = new Set<ThemeAxis>();
  for (const axis of THEME_AXES) {
    if (axisHonored(seed, axis)) supported.add(axis);
  }
  return supported;
}

const cache = new Map<TemplateId, Set<ThemeAxis>>();

/** Cached theme support for a template id (probes the template's seed once). */
export function getThemeSupport(templateId: TemplateId): Set<ThemeAxis> {
  const hit = cache.get(templateId);
  if (hit) return hit;
  const tpl = templates[templateId];
  const support = tpl ? detectThemeSupport(tpl.seed) : new Set(THEME_AXES);
  cache.set(templateId, support);
  return support;
}

// --- Block-field capability: does a template render a link's emoji icon? -------

const iconCache = new Map<TemplateId, boolean>();

/**
 * Whether a template renders a link block's `icon` (emoji) field. Several
 * minimalist/terminal templates deliberately omit link icons, so the editor hides
 * the emoji field for them rather than offering a control that does nothing.
 *
 * Detected by whether the *chosen* icon changes the output: render one link with
 * two different icons and diff (island stripped). A verbatim-string check would
 * false-negative on templates that transform the icon (slice, humanise, map to a
 * glyph). Cached per template id; unknown templates default to showing the field.
 */
export function rendersLinkIcon(templateId: TemplateId): boolean {
  const hit = iconCache.get(templateId);
  if (hit !== undefined) return hit;
  const tpl = templates[templateId];
  let result = true;
  if (tpl) {
    const render = (icon: string): string => {
      const d = clone(tpl.seed);
      const link: LinkBlock = { type: 'link', label: 'Link', url: 'https://example.com', icon };
      d.blocks = [link];
      return renderStructural(d);
    };
    result = render('🔥') !== render('🎯');
  }
  iconCache.set(templateId, result);
  return result;
}
