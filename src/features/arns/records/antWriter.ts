import type { RecordWriter } from './recordWriter';
import { APEX } from './sponsoredWriter';

/**
 * Writes a record with the caller's OWN signer, paying their own Solana fee.
 *
 * The path for a CONTROLLER. Turbo sponsors record writes only for the ANT's
 * owner — `setArNSRecord` takes an `ArNSOwnerSigner` and the service verifies
 * the proof against the current on-chain owner — so a controller's signature is
 * rejected outright. They are still perfectly entitled to edit records; the
 * program allows it. They just have to pay for it themselves.
 *
 * Collapsing this into the sponsored writer silently removed a capability:
 * `getArNSRecordsForAddress` returns Owned ∪ Controlled, so controlled names
 * flow into Deploy Site, Capture, Assign Domain and Pages publish. "Deploy to a
 * name I control" is an ordinary collaboration setup, and it would have failed
 * with an owner-proof 401 reported as "connect the wallet that owns it".
 */

/** The ANT writeable surface this adapter needs. Structural, so no SDK import. */
export interface ANTRecordWriteable {
  setUndernameRecord(p: {
    undername: string;
    transactionId: string;
    ttlSeconds: number;
  }): Promise<{ id: string }>;
  removeUndernameRecord(p: { undername: string }): Promise<{ id: string }>;
  setBaseNameRecord(p: {
    transactionId: string;
    ttlSeconds: number;
  }): Promise<{ id: string }>;
}

export function antRecordWriter(ant: ANTRecordWriteable): RecordWriter {
  return {
    setRecord: ({ undername, transactionId, ttlSeconds }) =>
      undername === APEX
        ? ant.setBaseNameRecord({ transactionId, ttlSeconds })
        : ant.setUndernameRecord({ undername, transactionId, ttlSeconds }),
    removeRecord: ({ undername }) => {
      if (undername === APEX) {
        // The apex record is the name itself resolving; the ANT has no method
        // to delete it, and doing so would break the domain entirely.
        return Promise.reject(
          new Error(
            'The main record cannot be removed — point it somewhere else instead.',
          ),
        );
      }
      return ant.removeUndernameRecord({ undername });
    },
  };
}
