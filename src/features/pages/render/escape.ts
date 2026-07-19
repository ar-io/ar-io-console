/**
 * HTML/attribute escaping and href sanitisation for the Pages renderer.
 *
 * The renderer emits a single self-contained HTML document from user-controlled
 * content, so every user string must be escaped and every href constrained to a
 * safe scheme allowlist. These helpers are pure and dependency-free.
 */

/** Escape text for safe insertion into HTML element content (& < > " '). */
export function escapeHtml(s: unknown): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape a string for safe insertion into a double-quoted HTML attribute value. */
export function escapeAttr(s: unknown): string {
  // Same character set as escapeHtml — enough to neutralise quote/tag breakout
  // in both single- and double-quoted attribute contexts.
  return escapeHtml(s);
}

/**
 * Constrain a URL to a safe scheme allowlist for use in an `href`/`src`.
 *
 * Allowed: `https:`, `http:` (already-resolved), `mailto:`, and in-page `#…`
 * anchors. Everything else — `javascript:`, `data:`, `vbscript:`, `file:`,
 * protocol-relative `//host`, bare/relative, `ar://` (must be resolved first) —
 * collapses to `#`.
 */
export function safeHref(url: unknown): string {
  if (typeof url !== 'string') return '#';
  const raw = url.trim();
  if (raw === '') return '#';
  if (raw.startsWith('#')) return raw;
  const lower = raw.toLowerCase();
  if (lower.startsWith('https://')) return raw;
  if (lower.startsWith('http://')) return raw;
  if (lower.startsWith('mailto:')) return raw;
  return '#';
}
