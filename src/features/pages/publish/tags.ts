/**
 * Pure tag builder for published Pages (PRD §7.8 / §7.12).
 *
 * Produces the standardized Arweave data-item tags for a page HTML upload and
 * merges any user-supplied custom tags over the defaults (custom wins on a name
 * collision — the same convention useFileUpload's private `mergeTags` uses,
 * replicated here because that helper is not exported).
 */

import { APP_NAME, APP_VERSION } from '@/constants';
import type { PageDef } from '../schema';

export interface Tag {
  name: string;
  value: string;
}

/** Merge custom tags over defaults; a custom tag overrides a default of the same name. */
export function mergePageTags(defaultTags: Tag[], customTags: Tag[]): Tag[] {
  const customNames = new Set(customTags.map((t) => t.name));
  const nonOverridden = defaultTags.filter((dt) => !customNames.has(dt.name));
  // Custom tags first, then the defaults they did not override.
  return [...customTags, ...nonOverridden];
}

/** Standardized Pages tags (+ merged custom tags) for an HTML page upload. */
export function buildPageTags(def: PageDef, version: number, customTags: Tag[] = []): Tag[] {
  const defaults: Tag[] = [
    { name: 'Deployed-By', value: APP_NAME },
    { name: 'Deployed-By-Version', value: APP_VERSION },
    { name: 'App-Feature', value: 'Pages' },
    { name: 'Content-Type', value: 'text/html' },
    { name: 'Type', value: 'page' },
    { name: 'Page-Id', value: def.id },
    { name: 'Page-Version', value: String(version) },
    { name: 'Page-Title', value: def.title },
    { name: 'Page-Template', value: def.template },
    { name: 'Render-With', value: 'ario-console-pages@1' },
  ];
  return mergePageTags(defaults, customTags);
}
