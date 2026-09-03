import type { ArNSOwnerSigner } from '@ardrive/turbo-sdk/web';

import { hasMetadataChange, type RecordWriter } from './recordWriter';

/**
 * The single record writer: Turbo performs the write, the owner approves it.
 *
 * NOT free. Turbo is the fee payer on the Solana transaction and bills that
 * cost back in credits, which is why this route has a price at all — the user
 * buys not needing SOL, not a free write. Nor is it promptless. The owner's approval is required on every record write, whether
 * or not Turbo is still a helper on the name, so UI copy says "approve a
 * message" and never "one click".
 *
 * Whether that approval is a message or a full transaction depends on live
 * state and is decided per request by the service; the SDK handles both and
 * this file never branches on it.
 */

/** The two SDK methods this adapter needs. Structural, so tests need no SDK. */
export interface SponsoredRecordClient {
  setArNSRecord(p: {
    antId: string;
    owner: ArNSOwnerSigner;
    transactionId: string;
    undername?: string;
    ttlSeconds?: number;
  }): Promise<{ messageId: string }>;
  /**
   * A SEPARATE action from `setArNSRecord`, so a save touching both the target
   * and the metadata costs two approvals. Only called when metadata actually
   * changed, which is why `toRecordChange` diffs rather than snapshots — a
   * snapshot would have made every save a two-prompt save.
   */
  setArNSRecordMetadata(p: {
    antId: string;
    owner: ArNSOwnerSigner;
    undername?: string;
    displayName?: string | null;
    recordLogo?: string | null;
    recordDescription?: string | null;
    recordKeywords?: string[] | null;
  }): Promise<{ messageId: string }>;
  removeArNSRecord(p: {
    antId: string;
    owner: ArNSOwnerSigner;
    undername: string;
  }): Promise<{ messageId: string }>;
}

/** The apex record — the name itself resolving. Turbo takes it as `'@'`. */
export const APEX = '@';

export function sponsoredRecordWriter(
  antId: string,
  turbo: SponsoredRecordClient,
  owner: ArNSOwnerSigner,
): RecordWriter {
  return {
    async setRecord(change) {
      const { undername, transactionId, ttlSeconds } = change;
      const res = await turbo.setArNSRecord({
        antId,
        owner,
        transactionId,
        undername,
        ttlSeconds,
      });

      /*
        Metadata is its own action, so it is only sent when something actually
        changed. The record write is what the caller asked for and its id is
        what they get back; a metadata failure after a successful record write
        must not read as "nothing saved", so it is reported on its own terms.
      */
      if (hasMetadataChange(change)) {
        await turbo.setArNSRecordMetadata({
          antId,
          owner,
          undername,
          ...(change.displayName !== undefined
            ? { displayName: change.displayName }
            : {}),
          ...(change.logo !== undefined ? { recordLogo: change.logo } : {}),
          ...(change.description !== undefined
            ? { recordDescription: change.description }
            : {}),
          ...(change.keywords !== undefined
            ? { recordKeywords: change.keywords }
            : {}),
        });
      }

      return { id: res.messageId };
    },

    async removeRecord({ undername }) {
      /*
        The apex record is the name itself resolving. Removing it would leave
        the name pointing at nothing, and the service rejects it with a 400 that
        does not explain why. Refuse here, where we can say what to do instead.
      */
      if (undername === APEX) {
        throw new Error(
          'The main record cannot be removed — point it somewhere else instead.',
        );
      }
      const res = await turbo.removeArNSRecord({ antId, owner, undername });
      return { id: res.messageId };
    },
  };
}
