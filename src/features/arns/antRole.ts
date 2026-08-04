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

/** Owner-only actions: hidden/blocked for controllers. */
export function isOwnerOnlyAllowed(role: AntRole): boolean {
  // Optimistic while unknown (summary still loading); strict once resolved.
  return role !== 'controller';
}
