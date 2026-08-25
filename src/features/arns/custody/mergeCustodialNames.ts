/** The minimum a name needs to render in "your names". */
export interface MergeableName {
  name: string;
  /** Required: downstream expiry/sorting helpers treat these as always present. */
  displayName: string;
  /** May be '' when no Turbo receipt carried an ANT id; callers guard for it. */
  processId: string;
  type?: 'lease' | 'permabuy';
  endTimestamp?: number;
  /** True when Turbo holds the ANT — drives the badge and the action set. */
  custodial?: boolean;
}

export interface TurboNameRow {
  name: string;
  antId: string;
  custodial: boolean;
  type?: 'lease' | 'permabuy';
}

/**
 * Add Turbo-held names to the on-chain "your names" list.
 *
 * `getArNSRecordsForAddress` is keyed on the ACL, which records the ANT's
 * OWNER. Turbo owns a custodial ANT, so a name bought by card is absent from
 * that list by construction — it exists, resolves, and is paid for, yet appears
 * nowhere the buyer would look. Only the Turbo receipt list can see it.
 *
 * Only `custodial: true` rows are merged. A `custodial: false` row is receipt
 * history for a name that is either self-custodied (already in the ACL, so
 * merging would duplicate it) or since transferred out — where the ACL, not the
 * receipt, is authoritative.
 *
 * On-chain entries always win a name collision: they carry live state, while
 * the receipt is a record of a past purchase.
 */
export function mergeCustodialNames<T extends MergeableName>(
  owned: T[],
  turboRows: TurboNameRow[] | undefined,
): (T | MergeableName)[] {
  if (!turboRows?.length) return owned;

  const seen = new Set(owned.map((n) => n.name.toLowerCase()));
  const extra: MergeableName[] = [];

  for (const row of turboRows) {
    if (!row.custodial || !row.name) continue;
    const key = row.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    extra.push({
      name: row.name,
      displayName: row.name,
      // May be '' when no receipt carried one; the detail page guards for it.
      processId: row.antId,
      type: row.type,
      custodial: true,
    });
  }

  return extra.length ? [...owned, ...extra] : owned;
}
