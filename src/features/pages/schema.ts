/**
 * Pages — PageDef schema (the source of truth for a permaweb link-in-bio page).
 *
 * A PageDef is a single, versioned, self-describing JSON object. It is embedded
 * inside every published HTML document (so a page can rebuild its own editor on
 * any device) and cached locally. This module defines the model plus a small set
 * of dependency-free runtime helpers (validate / migrate / empty) so it is safe
 * to import from both browser and node (test) contexts.
 *
 * See docs/PRD-Pages.md §7.2 (schema), §7.3 (blocks), §7.12 (ar.io-native).
 */

export const SCHEMA = 'ario-console/page';
export const SCHEMA_VERSION = 1;

/** Provenance marker only — which template a page started from. Never a constraint. */
export type TemplateId =
  | 'dial-up-homestead'
  | 'midnight-tower-bbs'
  | 'chrome-dreams'
  | 'top-eight'
  | 'bento-deck'
  | 'aurora-glass'
  | 'raw-concrete'
  | 'the-masthead'
  | 'grid-system'
  | 'shell-session'
  | 'readme-md'
  | 'man-page'
  | 'side-a'
  | 'xerox-riot'
  | 't-minus'
  | 'the-arcana'
  // v3.1 expansion — modern
  | 'sunset-gradient'
  | 'mesh-noir'
  | 'spotlight'
  | 'pastel-pop'
  | 'neo-brutalist'
  // v3.1 expansion — creator
  | 'link-classic'
  | 'creator-hub'
  | 'music-drop'
  | 'reel'
  // v3.1 expansion — pro
  | 'business-card'
  | 'resume'
  | 'portfolio-grid'
  // v3.1 expansion — classic
  | 'desktop-95'
  | 'teletext'
  // v3.1 expansion — wildcard
  | 'boarding-pass'
  | 'trading-card';

/** All template ids (16 launch + v3.1 expansion). */
export const TEMPLATE_IDS: readonly TemplateId[] = [
  'dial-up-homestead',
  'midnight-tower-bbs',
  'chrome-dreams',
  'top-eight',
  'bento-deck',
  'aurora-glass',
  'raw-concrete',
  'the-masthead',
  'grid-system',
  'shell-session',
  'readme-md',
  'man-page',
  'side-a',
  'xerox-riot',
  't-minus',
  'the-arcana',
  // v3.1 expansion — modern
  'sunset-gradient',
  'mesh-noir',
  'spotlight',
  'pastel-pop',
  'neo-brutalist',
  // v3.1 expansion — creator
  'link-classic',
  'creator-hub',
  'music-drop',
  'reel',
  // v3.1 expansion — pro
  'business-card',
  'resume',
  'portfolio-grid',
  // v3.1 expansion — classic
  'desktop-95',
  'teletext',
  // v3.1 expansion — wildcard
  'boarding-pass',
  'trading-card',
];

/** Fallback template used when a def arrives without a usable template id. */
export const DEFAULT_TEMPLATE: TemplateId = 'grid-system';

// --- Blocks (discriminated union on `type`) ------------------------------------

export interface LinkBlock {
  type: 'link';
  id?: string;
  label: string;
  url: string;
  icon?: string;
}

export interface SocialItem {
  platform: string;
  url: string;
}

export interface SocialBlock {
  type: 'social';
  id?: string;
  items: SocialItem[];
}

export interface HeadingBlock {
  type: 'heading';
  id?: string;
  text: string;
}

export interface TextBlock {
  type: 'text';
  id?: string;
  text: string;
}

export interface ImageBlock {
  type: 'image';
  id?: string;
  src: string;
  alt?: string;
  link?: string;
}

export interface EmbedBlock {
  type: 'embed';
  id?: string;
  arweave: string;
}

export interface DividerBlock {
  type: 'divider';
  id?: string;
}

export interface VerifyBlock {
  type: 'verify';
  id?: string;
  label: string;
  url: string;
}

export type Block =
  | LinkBlock
  | SocialBlock
  | HeadingBlock
  | TextBlock
  | ImageBlock
  | EmbedBlock
  | DividerBlock
  | VerifyBlock;

export type BlockType = Block['type'];

/** Block `type` values this renderer understands. Unknown types are dropped. */
export const KNOWN_BLOCK_TYPES: readonly BlockType[] = [
  'link',
  'social',
  'heading',
  'text',
  'image',
  'embed',
  'divider',
  'verify',
];

// --- Profile / Theme / Layout / Meta -------------------------------------------

export interface Profile {
  displayName: string;
  tagline?: string;
  bio?: string;
  /** Data URI, `ar://…`, or short initials/emoji fallback. */
  avatar?: string;
  /** Canonical ArNS handle, e.g. `myname.ar.io`. */
  handle?: string;
}

export type ButtonShape = 'pill' | 'rounded' | 'square';

export interface ThemeColors {
  bg: string;
  surface: string;
  text: string;
  accent: string;
}

export interface Theme {
  colors: ThemeColors;
  font: string;
  buttonShape: ButtonShape;
  /** Free-form background descriptor a template may interpret (e.g. `starfield`). */
  background?: string;
}

export type HeaderAlign = 'center' | 'left';
export type LinkStyle = 'button' | 'card' | 'grid';
export type PageWidth = 'standard' | 'wide';

export interface Layout {
  headerAlign: HeaderAlign;
  linkStyle: LinkStyle;
  width: PageWidth;
}

export interface PageMeta {
  seoTitle?: string;
  description?: string;
  /** OG image — data URI or `ar://…`. */
  ogImage?: string;
  faviconEmoji?: string;
}

export interface PageDef {
  schema: string;
  schemaVersion: number;
  id: string;
  template: TemplateId;
  title: string;
  profile: Profile;
  blocks: Block[];
  theme: Theme;
  layout: Layout;
  meta?: PageMeta;
  arnsName?: string;
  createdAt?: number;
  updatedAt?: number;
}

// --- Defaults ------------------------------------------------------------------

export const DEFAULT_THEME: Theme = {
  colors: { bg: '#FFFFFF', surface: '#F0F0F0', text: '#23232D', accent: '#5427C8' },
  font: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  buttonShape: 'rounded',
};

export const DEFAULT_LAYOUT: Layout = {
  headerAlign: 'center',
  linkStyle: 'button',
  width: 'standard',
};

// --- Coercion helpers ----------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Return a trimmed string only when the value is genuinely a string (keeps ''). */
function strOpt(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function strOr(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

function numOpt(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function generateId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto && typeof g.crypto.randomUUID === 'function') {
    return g.crypto.randomUUID();
  }
  return `pg-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

// --- Block validation ----------------------------------------------------------

function validateBlock(raw: unknown): Block | null {
  if (!isObject(raw)) return null;
  const type = raw.type;
  const id = strOpt(raw.id);
  const withId = <B extends Block>(block: B): B => (id !== undefined ? ({ ...block, id } as B) : block);

  switch (type) {
    case 'link':
      return withId({
        type: 'link',
        label: strOr(raw.label, ''),
        url: strOr(raw.url, '#'),
        ...(strOpt(raw.icon) !== undefined ? { icon: strOpt(raw.icon) as string } : {}),
      });
    case 'social': {
      const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
      const items: SocialItem[] = itemsRaw
        .filter(isObject)
        .map((it) => ({ platform: strOr(it.platform, ''), url: strOr(it.url, '#') }));
      return withId({ type: 'social', items });
    }
    case 'heading':
      return withId({ type: 'heading', text: strOr(raw.text, '') });
    case 'text':
      return withId({ type: 'text', text: strOr(raw.text, '') });
    case 'image': {
      const src = strOpt(raw.src);
      if (src === undefined) return null; // an image without a source is unusable
      return withId({
        type: 'image',
        src,
        ...(strOpt(raw.alt) !== undefined ? { alt: strOpt(raw.alt) as string } : {}),
        ...(strOpt(raw.link) !== undefined ? { link: strOpt(raw.link) as string } : {}),
      });
    }
    case 'embed': {
      const arweave = strOpt(raw.arweave);
      if (arweave === undefined) return null;
      return withId({ type: 'embed', arweave });
    }
    case 'divider':
      return withId({ type: 'divider' });
    case 'verify':
      return withId({ type: 'verify', label: strOr(raw.label, ''), url: strOr(raw.url, '#') });
    default:
      // Unknown block type — drop it for forward-compatibility (older renderers
      // must ignore blocks introduced by newer schema versions).
      return null;
  }
}

// --- Sub-object validation -----------------------------------------------------

function validateProfile(raw: unknown): Profile {
  const src = isObject(raw) ? raw : {};
  const profile: Profile = { displayName: strOr(src.displayName, 'Untitled') };
  const tagline = strOpt(src.tagline);
  const bio = strOpt(src.bio);
  const avatar = strOpt(src.avatar);
  const handle = strOpt(src.handle);
  if (tagline !== undefined) profile.tagline = tagline;
  if (bio !== undefined) profile.bio = bio;
  if (avatar !== undefined) profile.avatar = avatar;
  if (handle !== undefined) profile.handle = handle;
  return profile;
}

function validateTheme(raw: unknown): Theme {
  const src = isObject(raw) ? raw : {};
  const colorsRaw = isObject(src.colors) ? src.colors : {};
  const theme: Theme = {
    colors: {
      bg: strOr(colorsRaw.bg, DEFAULT_THEME.colors.bg),
      surface: strOr(colorsRaw.surface, DEFAULT_THEME.colors.surface),
      text: strOr(colorsRaw.text, DEFAULT_THEME.colors.text),
      accent: strOr(colorsRaw.accent, DEFAULT_THEME.colors.accent),
    },
    font: strOr(src.font, DEFAULT_THEME.font),
    buttonShape: oneOf<ButtonShape>(src.buttonShape, ['pill', 'rounded', 'square'], DEFAULT_THEME.buttonShape),
  };
  const background = strOpt(src.background);
  if (background !== undefined) theme.background = background;
  return theme;
}

function validateLayout(raw: unknown): Layout {
  const src = isObject(raw) ? raw : {};
  return {
    headerAlign: oneOf<HeaderAlign>(src.headerAlign, ['center', 'left'], DEFAULT_LAYOUT.headerAlign),
    linkStyle: oneOf<LinkStyle>(src.linkStyle, ['button', 'card', 'grid'], DEFAULT_LAYOUT.linkStyle),
    width: oneOf<PageWidth>(src.width, ['standard', 'wide'], DEFAULT_LAYOUT.width),
  };
}

function validateMeta(raw: Record<string, unknown>): PageMeta {
  const meta: PageMeta = {};
  const seoTitle = strOpt(raw.seoTitle);
  const description = strOpt(raw.description);
  const ogImage = strOpt(raw.ogImage);
  const faviconEmoji = strOpt(raw.faviconEmoji);
  if (seoTitle !== undefined) meta.seoTitle = seoTitle;
  if (description !== undefined) meta.description = description;
  if (ogImage !== undefined) meta.ogImage = ogImage;
  if (faviconEmoji !== undefined) meta.faviconEmoji = faviconEmoji;
  return meta;
}

// --- Public API ----------------------------------------------------------------

/**
 * Coerce arbitrary input into a valid PageDef, filling sane defaults and dropping
 * unknown/invalid blocks (forward-compat). This is a normalizer: applying it twice
 * yields the same result. Throws only when the input is fundamentally unusable
 * (not an object).
 */
export function validatePageDef(x: unknown): PageDef {
  if (!isObject(x)) {
    throw new Error('validatePageDef: input must be an object');
  }

  const blocksRaw = Array.isArray(x.blocks) ? x.blocks : [];
  const blocks = blocksRaw
    .map(validateBlock)
    .filter((b): b is Block => b !== null);

  const template = oneOf<TemplateId>(x.template, TEMPLATE_IDS, DEFAULT_TEMPLATE);
  const profile = validateProfile(x.profile);

  const def: PageDef = {
    schema: SCHEMA,
    schemaVersion: numOpt(x.schemaVersion) ?? SCHEMA_VERSION,
    id: strOr(x.id, '') || generateId(),
    template,
    title: strOr(x.title, '') || profile.displayName,
    profile,
    blocks,
    theme: validateTheme(x.theme),
    layout: validateLayout(x.layout),
  };

  if (isObject(x.meta)) def.meta = validateMeta(x.meta);
  const arnsName = strOpt(x.arnsName);
  if (arnsName !== undefined) def.arnsName = arnsName;
  const createdAt = numOpt(x.createdAt);
  if (createdAt !== undefined) def.createdAt = createdAt;
  const updatedAt = numOpt(x.updatedAt);
  if (updatedAt !== undefined) def.updatedAt = updatedAt;

  return def;
}

/**
 * Migrate an older PageDef to the current schema version, then normalize it.
 * v1 is the first version, so this is currently a version stamp + pass-through;
 * future stepwise migrations slot in before the final normalization.
 */
export function migratePageDef(x: any): PageDef {
  const raw: Record<string, unknown> = isObject(x) ? { ...x } : {};
  const version = numOpt(raw.schemaVersion) ?? 0;
  if (version < SCHEMA_VERSION) {
    // Future: apply ordered migration steps here (v1 -> v2 -> …).
    raw.schemaVersion = SCHEMA_VERSION;
  }
  return validatePageDef(raw);
}

/** A minimal, valid PageDef seeded from a template id. */
export function emptyPageDef(template: TemplateId): PageDef {
  const now = Date.now();
  return {
    schema: SCHEMA,
    schemaVersion: SCHEMA_VERSION,
    id: generateId(),
    template,
    title: 'Untitled Page',
    profile: { displayName: 'Untitled' },
    blocks: [],
    theme: {
      colors: { ...DEFAULT_THEME.colors },
      font: DEFAULT_THEME.font,
      buttonShape: DEFAULT_THEME.buttonShape,
    },
    layout: { ...DEFAULT_LAYOUT },
    createdAt: now,
    updatedAt: now,
  };
}
