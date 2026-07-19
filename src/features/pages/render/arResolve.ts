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
  /** Gateway origin for tx resolution, e.g. `https://arweave.net`. */
  gateway: string;
  /** ArNS host suffix for name resolution, e.g. `ar.io`. */
  arnsHost: string;
}

/** Sensible defaults matching the finished sample pages. */
export const DEFAULT_RESOLVE_CTX: ResolveCtx = {
  gateway: 'https://arweave.net',
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
  const label = parsed.undername ? `${parsed.undername}_${parsed.value}` : parsed.value;
  return `https://${label}.${host}`;
}
