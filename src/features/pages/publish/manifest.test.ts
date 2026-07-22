import { describe, it, expect } from 'vitest';
import {
  buildPagesManifest,
  buildManifestFile,
  buildManifestTags,
  ogImageUrlFor,
  INDEX_PATH,
  OG_IMAGE_PATH,
  MANIFEST_CONTENT_TYPE,
} from './manifest';
import type { PageDef } from '../schema';

const tx = (c: string) => c.repeat(43);

describe('buildPagesManifest', () => {
  it('maps index + social into an arweave/paths v0.2.0 manifest', () => {
    const m = buildPagesManifest({ indexTxId: tx('a'), socialTxId: tx('b') });
    expect(m.manifest).toBe('arweave/paths');
    expect(m.version).toBe('0.2.0');
    expect(m.index).toEqual({ path: INDEX_PATH });
    expect(m.paths[INDEX_PATH]).toEqual({ id: tx('a') });
    expect(m.paths[OG_IMAGE_PATH]).toEqual({ id: tx('b') });
    expect(Object.keys(m.paths)).toHaveLength(2);
  });

  it('omits the social path when there is no preview image', () => {
    const m = buildPagesManifest({ indexTxId: tx('a') });
    expect(m.paths[INDEX_PATH]).toEqual({ id: tx('a') });
    expect(m.paths[OG_IMAGE_PATH]).toBeUndefined();
    expect(Object.keys(m.paths)).toHaveLength(1);
  });
});

describe('buildManifestFile', () => {
  it('serialises to a File with the manifest content-type and valid JSON', async () => {
    const m = buildPagesManifest({ indexTxId: tx('a'), socialTxId: tx('b') });
    const file = buildManifestFile(m);
    expect(file.type).toBe(MANIFEST_CONTENT_TYPE);
    expect(file.name).toBe('manifest.json');
    const parsed = JSON.parse(await file.text());
    expect(parsed).toEqual(m);
  });
});

describe('ogImageUrlFor', () => {
  const common = { arnsHost: 'ar.io', gateway: 'https://turbo-gateway.com' };

  it('uses the page manifest path for a named page (future-proof, same-origin)', () => {
    expect(ogImageUrlFor({ socialTxId: tx('b'), arnsLabel: 'ada', ...common })).toBe(
      'https://ada.ar.io/social.png',
    );
  });

  it('supports undername labels', () => {
    expect(ogImageUrlFor({ socialTxId: tx('b'), arnsLabel: 'blog_ada', ...common })).toBe(
      'https://blog_ada.ar.io/social.png',
    );
  });

  it('falls back to the raw data-item URL for an unnamed page', () => {
    expect(ogImageUrlFor({ socialTxId: tx('b'), ...common })).toBe(
      `https://turbo-gateway.com/${tx('b')}`,
    );
  });

  it('strips a trailing slash on the gateway', () => {
    expect(ogImageUrlFor({ socialTxId: tx('b'), gateway: 'https://turbo-gateway.com/', arnsHost: 'ar.io' })).toBe(
      `https://turbo-gateway.com/${tx('b')}`,
    );
  });

  it('honors a testnet arns host', () => {
    expect(ogImageUrlFor({ socialTxId: tx('b'), arnsLabel: 'ada', arnsHost: 'ar-io.dev', gateway: 'https://ar-io.dev' })).toBe(
      'https://ada.ar-io.dev/social.png',
    );
  });
});

describe('buildManifestTags', () => {
  const def = { id: 'pg_1', title: 'My Page' } as PageDef;
  it('tags the manifest as a manifest data item', () => {
    const tags = buildManifestTags(def, 3);
    const byName = Object.fromEntries(tags.map((t) => [t.name, t.value]));
    expect(byName['Content-Type']).toBe(MANIFEST_CONTENT_TYPE);
    expect(byName['Type']).toBe('manifest');
    expect(byName['App-Feature']).toBe('Pages');
    expect(byName['Page-Id']).toBe('pg_1');
    expect(byName['Page-Version']).toBe('3');
    expect(byName['Page-Title']).toBe('My Page');
  });
});
