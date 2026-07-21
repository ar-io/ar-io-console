/**
 * parsePageHtml — recover a PageDef from a published Pages document.
 *
 * Every page embeds its own PageDef in a `<script id="ario-pagedef">` block,
 * which makes pages self-describing and portable (edit-from-any-device, import
 * from TX/ArNS — PRD §7.2). This extracts that JSON and runs it through the
 * migrate -> validate pipeline. Round-trips with `renderPageHtml`.
 */

import { migratePageDef, validatePageDef, type PageDef } from '../schema';

const PAGEDEF_RE =
  /<script\s+id="ario-pagedef"\s+type="application\/json">([\s\S]*?)<\/script>/i;

/**
 * Extract and validate the embedded PageDef from a page's HTML. Returns null if
 * the marker is absent or the payload is not a usable PageDef.
 */
export function parsePageHtml(html: string): PageDef | null {
  if (typeof html !== 'string') return null;
  const match = PAGEDEF_RE.exec(html);
  if (!match) return null;

  const json = match[1];
  try {
    const raw = JSON.parse(json);
    return validatePageDef(migratePageDef(raw));
  } catch {
    return null;
  }
}
