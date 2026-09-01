/**
 * What one record save will cost, and whether this wallet can cover it.
 *
 * Two things make this less obvious than it looks:
 *
 * 1. A save can be TWO charges. `set-record` (target + TTL) and
 *    `set-record-metadata` (display name, logo, description, keywords) are
 *    separate actions, so a save touching both is billed twice and approved
 *    twice. The editor shows them as one form, so nothing else would tell the
 *    user before it happened.
 * 2. Only the OWNER is billed in credits. A controller is not sponsored at
 *    all — their wallet pays the Solana network directly — so quoting credits
 *    to them would name a cost they never see.
 */

export interface RecordCost {
  /** Credits this save will spend, or `undefined` while the price is unknown. */
  credits: number | undefined;
  /** True when the save is billed as two separate actions. */
  twoActions: boolean;
  /**
   * True only when the balance is KNOWN to be short.
   *
   * An unknown price or an unknown balance must never block: telling a funded
   * user they cannot afford something is the same failure as the SOL gate that
   * once told people with money to go and buy more.
   */
  insufficient: boolean;
}

export function recordSaveCost({
  actionPrice,
  metadataPrice,
  changesRecord,
  changesMetadata,
  creditBalance,
  billed,
}: {
  /** Live price of `set-record`, in credits. */
  actionPrice: number | undefined;
  /** Live price of `set-record-metadata`, in credits. */
  metadataPrice: number | undefined;
  /** The save changes the target or TTL. */
  changesRecord: boolean;
  /** The save changes any metadata field. */
  changesMetadata: boolean;
  creditBalance: number | undefined;
  /** False for a controller, who pays the network rather than credits. */
  billed: boolean;
}): RecordCost {
  if (!billed) {
    return { credits: undefined, twoActions: false, insufficient: false };
  }

  const parts: number[] = [];
  if (changesRecord && actionPrice !== undefined) parts.push(actionPrice);
  if (changesMetadata && metadataPrice !== undefined) parts.push(metadataPrice);

  // Unknown if either half is priced but not yet loaded — a partial total is
  // worse than none, because it reads as authoritative.
  const missing =
    (changesRecord && actionPrice === undefined) ||
    (changesMetadata && metadataPrice === undefined);

  const credits = missing ? undefined : parts.reduce((a, b) => a + b, 0);

  return {
    credits,
    twoActions: changesRecord && changesMetadata,
    insufficient:
      credits !== undefined &&
      creditBalance !== undefined &&
      creditBalance < credits,
  };
}

/** One line for the editor, or `undefined` when there is nothing to say. */
export function recordCostNote(cost: RecordCost): string | undefined {
  if (cost.credits === undefined) return undefined;

  const amount =
    cost.credits === 0
      ? 'free on this network'
      : `about ${cost.credits.toLocaleString(undefined, {
          maximumFractionDigits: 4,
        })} credits`;

  /*
    Named before the click. Two approvals for one apparent action is the kind of
    surprise that reads as a bug — and the second prompt arrives after the first
    has already been charged, so someone who cancels it has paid for half a save.
  */
  return cost.twoActions
    ? `This changes the record and its details, which are billed separately — ${amount} in total, and your wallet will ask you to approve twice.`
    : `This costs ${amount}.`;
}
