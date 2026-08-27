/**
 * Pure arweave/paths manifest builder for a published page.
 *
 * A page is deployed as a manifest so the page HTML and its social-preview image
 * share one tx and resolve by clean, ArNS-friendly paths — `<name>.ar.io/` for the
 * page and `<name>.ar.io/social.png` for the preview — rather than raw tx ids.
 * That future-proofs the preview URL for a world where gateways may serve only
 * ArNS names and their manifest paths, not bare transaction ids. Matches the
 * arweave/paths v0.2.0 manifest that the Deploy feature produces.
 */
import { APP_NAME, APP_VERSION } from '@/constants';
import type { PageDef } from '../schema';

/** In-manifest path for the page document (served at the manifest root via `index`). */
export const INDEX_PATH = 'index.html';
/** In-manifest path for the social-preview image (referenced as og:image). */
export const OG_IMAGE_PATH = 'social.png';
/** Content-Type the gateway requires to treat a tx as a path manifest. */
export const MANIFEST_CONTENT_TYPE = 'application/x.arweave-manifest+json';

export interface PagesManifest {
  manifest: 'arweave/paths';
  version: '0.2.0';
  index: { path: string };
  paths: Record<string, { id: string }>;
}

/** Build the arweave/paths manifest mapping the page (and optional preview) tx ids. */
export function buildPagesManifest(entries: { indexTxId: string; socialTxId?: string }): PagesManifest {
  const paths: Record<string, { id: string }> = { [INDEX_PATH]: { id: entries.indexTxId } };
  if (entries.socialTxId) paths[OG_IMAGE_PATH] = { id: entries.socialTxId };
  return { manifest: 'arweave/paths', version: '0.2.0', index: { path: INDEX_PATH }, paths };
}

/** Wrap a manifest as an upload-ready File with the manifest Content-Type. */
export function buildManifestFile(manifest: PagesManifest): File {
  const json = JSON.stringify(manifest, null, 2);
  const blob = new Blob([json], { type: MANIFEST_CONTENT_TYPE });
  return new File([blob], 'manifest.json', { type: MANIFEST_CONTENT_TYPE });
}

/**
 * Resolve the absolute og:image URL for a page's preview image.
 *  - Named page → the page's own manifest path (`https://<label>.<host>/social.png`),
 *    future-proof and same-origin with og:url.
 *  - Unnamed page → the raw data-item URL (`<gateway>/<tx>`); a manifest path isn't
 *    available since the manifest tx isn't known before the HTML is rendered.
 */
export function ogImageUrlFor(args: {
  socialTxId: string;
  arnsLabel?: string;
  arnsHost: string;
  gateway: string;
}): string {
  if (args.arnsLabel) return `https://${args.arnsLabel}.${args.arnsHost}/${OG_IMAGE_PATH}`;
  return `${args.gateway.replace(/\/+$/, '')}/${args.socialTxId}`;
}

/** Manifest data-item tags for a published page. */
export function buildManifestTags(def: PageDef, version: number): { name: string; value: string }[] {
  return [
    { name: 'Deployed-By', value: APP_NAME },
    { name: 'Deployed-By-Version', value: APP_VERSION },
    { name: 'App-Feature', value: 'Pages' },
    { name: 'Content-Type', value: MANIFEST_CONTENT_TYPE },
    { name: 'Type', value: 'manifest' },
    { name: 'Page-Id', value: def.id },
    { name: 'Page-Version', value: String(version) },
    { name: 'Page-Title', value: def.title },
    { name: 'Render-With', value: 'ario-console-pages@1' },
  ];
}
