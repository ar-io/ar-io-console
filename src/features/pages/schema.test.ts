import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TEMPLATE,
  SCHEMA,
  SCHEMA_VERSION,
  emptyPageDef,
  migratePageDef,
  validatePageDef,
  type PageDef,
} from './schema';

const minimal = () => ({
  template: 'grid-system',
  profile: { displayName: 'Ada' },
});

describe('validatePageDef', () => {
  it('fills sane defaults for minimal input', () => {
    const def = validatePageDef(minimal());
    expect(def.schema).toBe(SCHEMA);
    expect(def.schemaVersion).toBe(SCHEMA_VERSION);
    expect(def.template).toBe('grid-system');
    expect(def.title).toBe('Ada'); // falls back to displayName
    expect(def.id).toBeTruthy();
    expect(Array.isArray(def.blocks)).toBe(true);
    expect(def.theme.buttonShape).toBeDefined();
    expect(def.layout.headerAlign).toBeDefined();
  });

  it('throws only when the input is fundamentally unusable', () => {
    expect(() => validatePageDef(null)).toThrow();
    expect(() => validatePageDef(42)).toThrow();
    expect(() => validatePageDef('nope')).toThrow();
    expect(() => validatePageDef([])).toThrow();
  });

  it('drops unknown block types but keeps known ones (forward-compat)', () => {
    const def = validatePageDef({
      ...minimal(),
      blocks: [
        { type: 'heading', text: 'Hi' },
        { type: 'future-widget', payload: { x: 1 } }, // unknown -> dropped
        { type: 'link', label: 'Site', url: 'https://example.com' },
        { type: 'divider' },
      ],
    });
    expect(def.blocks.map((b) => b.type)).toEqual(['heading', 'link', 'divider']);
  });

  it('drops structurally-invalid known blocks (image without src, embed without arweave)', () => {
    const def = validatePageDef({
      ...minimal(),
      blocks: [
        { type: 'image', alt: 'no source' },
        { type: 'embed' },
        { type: 'text', text: 'kept' },
      ],
    });
    expect(def.blocks.map((b) => b.type)).toEqual(['text']);
  });

  it('coerces invalid enum values to defaults', () => {
    const def = validatePageDef({
      ...minimal(),
      theme: { buttonShape: 'hexagon', colors: {} },
      layout: { headerAlign: 'diagonal', linkStyle: 'nope', width: 'gigantic' },
    });
    expect(def.theme.buttonShape).toBe('rounded');
    expect(def.layout).toEqual({ headerAlign: 'center', linkStyle: 'button', width: 'standard' });
  });

  it('falls back to the default template for an unknown template id', () => {
    const def = validatePageDef({ template: 'not-a-template', profile: { displayName: 'X' } });
    expect(def.template).toBe(DEFAULT_TEMPLATE);
  });

  it('preserves optional string fields including empty strings', () => {
    const def = validatePageDef({
      ...minimal(),
      profile: { displayName: 'Ada', avatar: '', tagline: 'hi', bio: 'b', handle: 'ada.ar.io' },
    });
    expect(def.profile).toEqual({
      displayName: 'Ada',
      avatar: '',
      tagline: 'hi',
      bio: 'b',
      handle: 'ada.ar.io',
    });
  });

  it('is idempotent (validate . validate = validate)', () => {
    const once = validatePageDef({
      ...minimal(),
      blocks: [
        { type: 'link', label: 'A', url: 'https://a.example', icon: 'globe' },
        { type: 'social', items: [{ platform: 'x', url: 'https://x.example' }] },
        { type: 'verify', label: 'perma', url: 'ar://abc' },
      ],
      meta: { seoTitle: 'T', faviconEmoji: '🔗' },
      createdAt: 123,
      updatedAt: 456,
    });
    expect(validatePageDef(once)).toEqual(once);
  });
});

describe('migratePageDef', () => {
  it('bumps a missing/old schemaVersion to the current version', () => {
    const fromMissing = migratePageDef({ ...minimal() });
    expect(fromMissing.schemaVersion).toBe(SCHEMA_VERSION);

    const fromZero = migratePageDef({ ...minimal(), schemaVersion: 0 });
    expect(fromZero.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('returns a fully-valid PageDef', () => {
    const def = migratePageDef({ template: 'grid-system', profile: { displayName: 'Z' } });
    expect(def.schema).toBe(SCHEMA);
    expect(def.template).toBe('grid-system');
  });
});

describe('emptyPageDef', () => {
  it('produces a minimal valid def for the given template', () => {
    const def: PageDef = emptyPageDef('dial-up-homestead');
    expect(def.template).toBe('dial-up-homestead');
    expect(def.schema).toBe(SCHEMA);
    expect(def.blocks).toEqual([]);
    expect(def.id).toBeTruthy();
    // an empty def must itself validate cleanly and unchanged
    expect(validatePageDef(def)).toEqual(def);
  });
});
