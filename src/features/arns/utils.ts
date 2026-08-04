/**
 * Small, dependency-light helpers local to the ArNS feature.
 *
 * arns-react imports `lowerCaseDomain` / `isValidSolanaAddress` / `sleep` from a
 * large shared `@src/utils` barrel. Console has no equivalents, so we keep tiny
 * self-contained copies here rather than growing the global util surface.
 */
import { PublicKey } from '@solana/web3.js';

/** Winston credits per 1 Turbo Credit (1 Credit = 1e12 winc = 1 AR-equivalent). */
export const WINC_PER_CREDIT = 1_000_000_000_000;

/** ArNS names are case-insensitive; the registry keys on the lowercased form. */
export function lowerCaseDomain(name: string): string {
  return name.trim().toLowerCase();
}

/** winc (string or number) → Turbo Credits (number). */
export function wincToCredits(winc: string | number): number {
  return Number(winc) / WINC_PER_CREDIT;
}

/**
 * True when `value` is a valid Solana pubkey (base58, 32 bytes). ANTs are Solana
 * assets, so any on-chain owner/target must decode to a real pubkey.
 */
export function isValidSolanaAddress(value: string | undefined | null): boolean {
  if (!value) return false;
  try {
    // Throws on malformed base58 / wrong length.
    void new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * True when `value` is a well-formed Arweave transaction ID (43-char
 * base64url). Used to validate ANT record targets and logo txIds before a
 * metadata write — the SDK's `ArweaveTxIdSchema` enforces the same shape.
 */
export function isArweaveTxId(value: string | undefined | null): boolean {
  if (!value) return false;
  return /^[A-Za-z0-9_-]{43}$/.test(value.trim());
}

/**
 * Storage protocol of an ANT record target: 0 = Arweave, 1 = IPFS. Mirrors the
 * SDK's `targetProtocol` field on `ANTSetBaseNameRecordParams`.
 */
export const TARGET_PROTOCOL = { arweave: 0, ipfs: 1 } as const;

/** Record TTL bounds (seconds), shared by the base `@` and undername editors. */
export const MIN_TTL = 60;
export const MAX_TTL = 2_592_000; // 30 days
export const DEFAULT_TTL = 3600;

/** Max keywords on a name / record before the editor blocks the write. */
export const MAX_KEYWORDS = 16;

/**
 * True when `value` looks like an IPFS CID. Intentionally permissive:
 * accepts a CIDv0 (`Qm…`, 46-char base58btc) or a lowercase base32 CIDv1
 * (`b…`). It may pass strings the contract later rejects on-chain — surfaced
 * as a write error, not a client-side block — but it never throws. Used to
 * validate a record target when its protocol is IPFS.
 */
export function isValidIpfsCid(value: string | undefined | null): boolean {
  if (!value) return false;
  const v = value.trim();
  // CIDv0: base58btc-encoded, always starts `Qm`, 46 chars total.
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(v)) return true;
  // CIDv1: lowercase base32 multibase, prefix `b`, permissive length.
  if (/^b[a-z2-7]{50,}$/.test(v)) return true;
  return false;
}

/**
 * Validate a record target against its chosen protocol: an Arweave TX ID when
 * `protocol` is 0 (Arweave), or an IPFS CID when it is 1 (IPFS).
 */
export function isValidRecordTarget(
  target: string | undefined | null,
  protocol: number,
): boolean {
  return protocol === TARGET_PROTOCOL.ipfs
    ? isValidIpfsCid(target)
    : isArweaveTxId(target);
}

/**
 * Parse a free-text keywords field (comma/newline separated) into a clean,
 * de-duplicated (case-insensitive), order-preserving list. Used by the ANT
 * metadata editor before a `setKeywords` write.
 */
export function parseKeywords(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of raw.split(/[,\n]/)) {
    const t = k.trim();
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out;
}

/** ArNS names may not start or end with a hyphen (matches the registry rule). */
export function isValidArNSName(name: string): boolean {
  const n = lowerCaseDomain(name);
  return n.length > 0 && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(n);
}

/**
 * True when `label` is a usable ANT undername (the part before the name, e.g.
 * `blog` in `blog_name.ar.io`). Must start alphanumeric, allow `-`/`_` after,
 * be ≤ 61 chars, and never the apex `@`.
 */
export function isValidUndername(label: string): boolean {
  const l = label.trim();
  if (!l || l === '@' || l.length > 61) return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(l);
}

/**
 * Hard cap on the number of delegated ANT controllers.
 *
 * Deliberately a local literal `4`, NOT the SDK's exported `MAX_CONTROLLERS`
 * (which is stale at 10): the deployed ANT contract tightened this 10 → 4 on
 * 2026-05-21 (`ario-ant/state.rs`, "mainnet rent shrink"), and `add_controller`
 * rejects the 5th with "Maximum controllers reached (4)". Tracking the SDK's 10
 * would let the UI accept controllers that then fail on-chain. Revisit if a
 * later SDK re-syncs its constant to the contract.
 *
 * Only the delegated controllers list is capped. The owner is a separate entity
 * in the contract (read from the MPL Core asset, never pushed into the
 * controllers Vec) and is NOT counted against this cap.
 */
export const MAX_CONTROLLERS = 4;

/**
 * True when the controllers list is already at the cap (`MAX_CONTROLLERS`), so
 * no further controller can be added. Counts only the delegated controllers —
 * the owner is not included. Uses `>=` to match the
 * delegated controllers — the owner is not included. Uses `>=` to match the
 * contract's `len() < MAX_CONTROLLERS` guard exactly (a full list is at the cap).
 */
export function isControllerLimitReached(controllers: string[]): boolean {
  return controllers.length >= MAX_CONTROLLERS;
}

/** Result of validating a candidate ANT controller address. */
export type ControllerValidation =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'invalid' | 'owner' | 'duplicate' | 'max' };

/**
 * Validate a candidate ANT controller address before an `addController` write.
 *
 * Controllers are delegated managers: they can edit an ANT's records/metadata
 * but cannot transfer or sell the name. The ANT owner is implicitly a
 * controller, so re-adding the owner is a no-op on-chain and is rejected here.
 *
 * Enforces the controller cap (`MAX_CONTROLLERS`) FIRST: once the list is full
 * nothing is addable regardless of the candidate, so a full list returns
 * `'max'` even for empty/duplicate/owner input. This is intentional — the Add
 * form is hidden at the cap, so the candidate is moot.
 *
 * Solana addresses are base58 and case-sensitive, so owner/duplicate checks use
 * exact string comparison (never lowercased — unlike ETH addresses).
 */
export function validateNewController(
  candidate: string,
  owner: string | undefined,
  controllers: string[],
): ControllerValidation {
  if (isControllerLimitReached(controllers)) return { ok: false, reason: 'max' };
  const c = (candidate ?? '').trim();
  if (!c) return { ok: false, reason: 'empty' };
  if (!isValidSolanaAddress(c)) return { ok: false, reason: 'invalid' };
  if (owner && c === owner) return { ok: false, reason: 'owner' };
  if (controllers.some((x) => x === c)) return { ok: false, reason: 'duplicate' };
  return { ok: true };
}

/**
 * Split an ArNS primary-name target into its `{ label, baseName }` parts.
 *
 * A primary name is either an apex name (`myname`) or an undername
 * (`blog_myname`, resolving as `blog_myname.ar.io`). The registry encodes an
 * undername primary as `label_base`, so we split on the FIRST underscore: the
 * part before it is the undername label, the remainder is the base name (which
 * itself owns the ANT the primary maps to). Apex names have no label.
 *
 * The input is trimmed/lowercased (ArNS is case-insensitive) so callers can
 * pass raw user text.
 */
export function parsePrimaryName(fullName: string): {
  label?: string;
  baseName: string;
} {
  const s = lowerCaseDomain(fullName);
  const idx = s.indexOf('_');
  if (idx === -1) return { baseName: s };
  return { label: s.slice(0, idx), baseName: s.slice(idx + 1) };
}

/**
 * True when `fullName` is a usable ArNS primary-name target: a valid base ArNS
 * name (`isValidArNSName`) and, when it is an undername (`label_base`), a valid
 * undername label (`isValidUndername`). Empty, hyphen-leading, and malformed
 * undername labels are rejected. Reuses the same rules as the buy/undername
 * editors so a primary can never be set to a name the registry would refuse.
 */
export function isValidPrimaryName(fullName: string): boolean {
  const { label, baseName } = parsePrimaryName(fullName);
  if (!isValidArNSName(baseName)) return false;
  if (label !== undefined && !isValidUndername(label)) return false;
  return true;
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
