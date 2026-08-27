/**
 * ar.io-native URL resolution for the Pages renderer.
 *
 * The PageDef stores portable `ar://` targets; the published HTML must emit
 * resolved gateway/ArNS URLs so the page works in any browser without a
 * resolver extension (PRD §7.12). Resolution is deterministic and pure.
 *
 *   ar://<txId>            -> `${gateway}/<txId>`            (43-char base64url)
 *   ar://<name>            -> `https://<name>.<arnsHost>`
 *   ar://<under>_<name>    -> `https://<under>_<name>.<arnsHost>`
 *   anything else          -> passed through unchanged
 */

export interface ResolveCtx {
  /** Gateway origin for tx resolution, e.g. `https://turbo-gateway.com`. */
  gateway: string;
  /** ArNS host suffix for name resolution, e.g. `ar.io`. */
  arnsHost: string;
}

/** Sensible defaults matching the app's default config (turbo-gateway.com / ar.io). */
export const DEFAULT_RESOLVE_CTX: ResolveCtx = {
  gateway: 'https://turbo-gateway.com',
  arnsHost: 'ar.io',
};

const AR_PREFIX = 'ar://';
/** A 43-character base64url string is treated as an Arweave transaction id. */
const TX_RE = /^[A-Za-z0-9_-]{43}$/;

export interface ParsedAr {
  kind: 'tx' | 'name';
  value: string;
  undername?: string;
}

/** True when the value is an `ar://…` URL (scheme is case-insensitive). */
export function isArUrl(u: unknown): boolean {
  return typeof u === 'string' && u.trim().toLowerCase().startsWith(AR_PREFIX);
}

/**
 * Parse an `ar://…` URL into its target. Returns null for non-ar or empty input.
 * An `<under>_<name>` name is split into `{ value: name, undername: under }`.
 */
export function parseArUrl(u: unknown): ParsedAr | null {
  if (!isArUrl(u)) return null;
  // `isArUrl` guarantees a string here.
  const trimmed = (u as string).trim();
  const rest = trimmed.slice(AR_PREFIX.length).replace(/\/+$/, '');
  if (rest === '') return null;

  if (TX_RE.test(rest)) {
    return { kind: 'tx', value: rest };
  }

  const idx = rest.indexOf('_');
  if (idx > 0 && idx < rest.length - 1) {
    return { kind: 'name', value: rest.slice(idx + 1), undername: rest.slice(0, idx) };
  }
  return { kind: 'name', value: rest };
}

/**
 * Resolve an `ar://…` URL to a concrete https(gateway) URL. Non-ar URLs are
 * returned unchanged so callers can pipe every URL through this safely.
 */
export function resolveArUrl(u: string, ctx: ResolveCtx): string {
  if (typeof u !== 'string') return '';
  if (!isArUrl(u)) return u;

  const parsed = parseArUrl(u);
  if (!parsed) return u; // malformed ar:// — leave for the href sanitiser to reject

  const gateway = (ctx.gateway || DEFAULT_RESOLVE_CTX.gateway).replace(/\/+$/, '');
  const host = (ctx.arnsHost || DEFAULT_RESOLVE_CTX.arnsHost).replace(/^\/+|\/+$/g, '');

  if (parsed.kind === 'tx') {
    return `${gateway}/${parsed.value}`;
  }
  // A name typed with its host suffix (e.g. ar://myname.ar.io) would otherwise
  // double it (myname.ar.io.ar.io). Strip a trailing `.<host>` — mirrors
  // resolveHandle's stripping in templates/shared.ts.
  let name = parsed.value;
  if (name.toLowerCase().endsWith('.' + host.toLowerCase())) {
    name = name.slice(0, -(host.length + 1));
  }
  const label = parsed.undername ? `${parsed.undername}_${name}` : name;
  return `https://${label}.${host}`;
}

/**
 * Canonicalise a user-entered link URL to a safe, resolvable form. Applied when
 * a page is published so a permanent page never ships a dead or broken link.
 * Never fabricates a link from an unknown/dangerous scheme (those become '').
 *
 *   ''  ·  'https://'  ·  'ar://'  ·  'mailto:'   -> ''      (untouched defaults)
 *   'https://x.com/y'  ·  'ar://name'  ·  '#a'    -> unchanged
 *   'example.com' · 'myname.ar.io'                -> 'https://…'  (dotted host)
 *   'myname'  ·  'links_myname'                   -> 'ar://…'     (bare ArNS label)
 *   'javascript:…' · 'data:…' · other            -> ''
 */
export function normalizeLinkUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const t = raw.trim();
  if (t === '') return '';
  if (t.startsWith('#')) return t;
  const lower = t.toLowerCase();
  // Bare scheme with no authority/target — the untouched editor defaults.
  if (lower === 'https://' || lower === 'http://' || lower === 'ar://' || lower === 'mailto:') return '';
  // Recognised, already-usable schemes pass through unchanged.
  if (
    lower.startsWith('https://') ||
    lower.startsWith('http://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('ar://')
  ) {
    return t;
  }
  // Any other explicit scheme (javascript:, data:, vbscript:, …) — never
  // fabricate a link from it. (Scheme names contain no dots, so a host:port
  // like example.com:8080 is not mistaken for a scheme here.)
  if (/^[a-z][a-z0-9+-]*:/i.test(t)) return '';
  // No scheme. A dotted host (example.com, myname.ar.io) is a web URL — note an
  // ArNS name is itself served at https://<name>.<host>, so https:// is correct
  // for both. A bare single label (myname / links_myname) is an ArNS name.
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:[/?#].*)?$/i.test(t)) return `https://${t}`;
  if (/^[a-z0-9][a-z0-9-]*(_[a-z0-9-]+)?$/i.test(t)) return `ar://${t}`;
  return '';
}
