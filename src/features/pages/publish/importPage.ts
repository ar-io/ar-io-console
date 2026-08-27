/**
 * importPage — recover an existing published page so it can be edited on any
 * device, even with a cleared cache. Every page embeds its own PageDef (in the
 * `<script id="ario-pagedef">` island) for exactly this reason (PRD §7.2/§9.2):
 * resolve an ArNS name / tx id / ar:// URL / gateway URL to a fetchable
 * document, download it, and extract the definition back into the editor.
 */
import type { ResolveCtx } from '../render/arResolve';
import { isArUrl, parseArUrl, resolveArUrl } from '../render/arResolve';
import { parsePageHtml } from '../render/parsePageHtml';
import type { PageDef } from '../schema';

/** A 43-character base64url string is an Arweave transaction id. */
const TX_RE = /^[A-Za-z0-9_-]{43}$/;
/** A single ArNS label: alphanumeric with internal hyphens. */
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

export interface PageSource {
  /** Concrete https URL to fetch. */
  url: string;
  /** Arweave tx id, when the input identified one directly. */
  txId?: string;
  /** ArNS base name (no host suffix), when the input was a name. */
  arnsName?: string;
  /** ArNS undername, when present. */
  undername?: string;
}

export interface ImportedPage {
  def: PageDef;
  txId?: string;
  arnsName?: string;
  undername?: string;
  sizeBytes: number;
}

/**
 * Resolve raw user input to a fetchable source. Pure + synchronous so it is unit
 * testable. Accepts: a 43-char tx id, an `ar://…` URL, a full gateway/ArNS https
 * URL, or a bare ArNS name (optionally `undername_name` and/or `name.<arnsHost>`).
 * Throws a user-facing error for empty or unrecognisable input.
 */
export function resolvePageSource(input: string, ctx: ResolveCtx): PageSource {
  const raw = (input ?? '').trim();
  if (!raw) throw new Error('Enter an ArNS name or transaction id.');

  const gateway = (ctx.gateway || '').replace(/\/+$/, '');
  const host = (ctx.arnsHost || 'ar.io').replace(/^\/+|\/+$/g, '');

  // ar://… URL
  if (isArUrl(raw)) {
    const parsed = parseArUrl(raw);
    if (!parsed) throw new Error('That ar:// link is not valid.');
    const url = resolveArUrl(raw, ctx);
    return parsed.kind === 'tx'
      ? { url, txId: parsed.value }
      : { url, arnsName: parsed.value, undername: parsed.undername };
  }

  // bare tx id
  if (TX_RE.test(raw)) return { url: `${gateway}/${raw}`, txId: raw };

  // full http(s) URL — pull out a tx id (last path segment) or ArNS subdomain
  if (/^https?:\/\//i.test(raw)) {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      throw new Error('That URL is not valid.');
    }
    const segs = u.pathname.split('/').filter(Boolean);
    const last = segs[segs.length - 1];
    const txId = last && TX_RE.test(last) ? last : undefined;
    let arnsName: string | undefined;
    let undername: string | undefined;
    if (!txId) {
      // Host-aware, matching the bare-name branch below: only treat the leading
      // label as ArNS when the hostname actually ends with the configured
      // `.<arnsHost>` (which may be more than two labels), split any undername,
      // and validate with NAME_RE so a dotted/multi-label subdomain (e.g.
      // `sub.name.ar.io` or `evil.com.ar.io`) is rejected rather than stored.
      const suffix = '.' + host.toLowerCase();
      if (u.hostname.toLowerCase().endsWith(suffix)) {
        const label = u.hostname.slice(0, -suffix.length);
        const us = label.indexOf('_');
        const candUnder = us > 0 && us < label.length - 1 ? label.slice(0, us) : undefined;
        const candName = candUnder !== undefined ? label.slice(us + 1) : label;
        if (NAME_RE.test(candName) && (candUnder === undefined || NAME_RE.test(candUnder))) {
          arnsName = candName;
          undername = candUnder;
        }
      }
    }
    return { url: raw, txId, arnsName, undername };
  }

  // bare ArNS name (optionally undername_name and/or a trailing .<arnsHost>)
  let label = raw.replace(/\/+$/, '');
  const suffix = '.' + host.toLowerCase();
  if (label.toLowerCase().endsWith(suffix)) label = label.slice(0, -suffix.length);

  let undername: string | undefined;
  let name = label;
  const us = label.indexOf('_');
  if (us > 0 && us < label.length - 1) {
    undername = label.slice(0, us);
    name = label.slice(us + 1);
  }
  if (!NAME_RE.test(name) || (undername !== undefined && !NAME_RE.test(undername))) {
    throw new Error('Enter a valid ArNS name or a 43-character transaction id.');
  }
  const fullLabel = undername ? `${undername}_${name}` : name;
  return { url: `https://${fullLabel}.${host}`, arnsName: name, undername };
}

/** Response headers ar.io gateways may use to advertise the resolved data tx. */
const RESOLVED_ID_HEADERS = ['x-arns-resolved-id', 'x-ar-io-resolved-id', 'x-arns-resolved-record'];

/**
 * Fetch and recover a PageDef from a published page. Throws friendly, actionable
 * errors for network failures, missing content, and non-Pages documents.
 */
export async function importPageFromSource(input: string, ctx: ResolveCtx): Promise<ImportedPage> {
  const src = resolvePageSource(input, ctx);

  // Real Pages are a few KB; cap the body so a hostile/huge response can't OOM.
  const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
  // Bound the request so a slow/hung gateway can't strand the import modal forever.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    let res: Response;
    try {
      res = await fetch(src.url, { redirect: 'follow', signal: controller.signal });
    } catch {
      throw new Error(
        controller.signal.aborted
          ? 'The gateway took too long to respond. Try again in a moment.'
          : 'Could not reach the gateway. Check your connection and try again.',
      );
    }
    if (!res.ok) {
      throw new Error(
        res.status === 404
          ? 'Nothing found at that address. Double-check the name or transaction id.'
          : `The gateway returned ${res.status}. Try again in a moment.`,
      );
    }
    if (Number(res.headers.get('content-length') || 0) > MAX_IMPORT_BYTES) {
      throw new Error("That page is too large to import — it doesn't look like an ar.io page.");
    }

    let html: string;
    try {
      html = await res.text();
    } catch {
      throw new Error(
        controller.signal.aborted
          ? 'The gateway took too long to respond. Try again in a moment.'
          : 'Could not read the page from the gateway. Try again in a moment.',
      );
    }
    if (new Blob([html]).size > MAX_IMPORT_BYTES) {
      throw new Error("That page is too large to import — it doesn't look like an ar.io page.");
    }

    const def = parsePageHtml(html);
    if (!def) {
      throw new Error("That page isn't an editable ar.io page — no embedded page data was found.");
    }

    // Best-effort: when imported by name, capture the resolved data tx id so the
    // recovered page anchors its version lineage. Header exposure is
    // gateway-dependent; a missing id is fine — the page is still fully editable.
    let txId = src.txId;
    if (!txId) {
      for (const h of RESOLVED_ID_HEADERS) {
        const v = res.headers.get(h);
        if (v && TX_RE.test(v.trim())) {
          txId = v.trim();
          break;
        }
      }
    }

    return {
      def,
      txId,
      arnsName: src.arnsName,
      undername: src.undername,
      sizeBytes: new Blob([html]).size,
    };
  } finally {
    clearTimeout(timer);
  }
}
