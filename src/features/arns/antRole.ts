import type { AntSummary } from './hooks/useAntLogos';

/**
 * The connected wallet's relationship to a name (its ANT).
 *
 * `getArNSRecordsForAddress` returns `Owned ∪ Controlled` — the wallet's whole
 * ACL — so a name in "your names" may be one you only *control*, not own.
 * Controllers can edit records/metadata/undernames, but NOT transfer, reassign,
 * release, or change the controller set — those are owner-only. This derives the
 * role so the UI can gate those actions and label the row.
 *
 * `unknown` = the ANT summary hasn't loaded yet (owner/controllers not yet
 * known); callers should treat it optimistically (don't hard-restrict on a
 * not-yet-loaded row) and re-evaluate once the summary arrives.
 */
export type AntRole = 'owner' | 'controller' | 'unknown';

export function deriveAntRole(
  summary: AntSummary | undefined,
  walletAddress: string | null | undefined,
): AntRole {
  if (!summary || !summary.owner || !walletAddress) return 'unknown';
  if (summary.owner === walletAddress) return 'owner';
  if (summary.controllers.includes(walletAddress)) return 'controller';
  // In the ACL but neither current owner nor controller ⇒ stale/drifted index.
  // Treat as controller so owner-only actions stay hidden (safe default).
  return 'controller';
}

/**
 * The wallet's EXACT relationship to a name, with no optimistic fallback:
 * `none` means the wallet is neither owner nor controller. Use this anywhere a
 * name is NOT guaranteed to be in the wallet's ACL — e.g. the public Name Detail
 * page, where you can view any name. (The optimistic `deriveAntRole` above must
 * only be used on owned-names surfaces, where every row IS in the ACL.)
 */
export type StrictAntRole = 'owner' | 'controller' | 'none' | 'unknown';

export function deriveAntRoleStrict(
  summary: AntSummary | undefined,
  walletAddress: string | null | undefined,
): StrictAntRole {
  if (!summary || !summary.owner) return 'unknown'; // not loaded yet
  if (!walletAddress) return 'none'; // no connected ArNS wallet
  if (summary.owner === walletAddress) return 'owner';
  if (summary.controllers.includes(walletAddress)) return 'controller';
  return 'none';
}

/** Owner-only actions: shown ONLY once the wallet is confirmed the owner. */
export function isOwnerOnlyAllowed(role: AntRole): boolean {
  // Strict: 'unknown' (summary still loading or lookup failed) and 'controller'
  // are both denied, so destructive owner-only actions (transfer/reassign/
  // release/controllers) never flash before ownership is confirmed.
  return role === 'owner';
}
