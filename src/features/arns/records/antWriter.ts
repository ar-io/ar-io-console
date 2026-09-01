import type { RecordWriteInput, RecordWriter } from './recordWriter';
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
/**
 * The ANT writeable surface this adapter needs.
 *
 * Both setters take the metadata in the SAME transaction as the record, so a
 * controller's save is one signature however much it changes — unlike the
 * sponsored path, where metadata is a separate action.
 */
export interface ANTRecordWriteable {
  setUndernameRecord(p: {
    undername: string;
    transactionId: string;
    ttlSeconds: number;
    targetProtocol?: number;
    priority?: number;
    displayName?: string;
    logo?: string;
    description?: string;
    keywords?: string[];
  }): Promise<{ id: string }>;
  removeUndernameRecord(p: { undername: string }): Promise<{ id: string }>;
  setBaseNameRecord(p: {
    transactionId: string;
    ttlSeconds: number;
    targetProtocol?: number;
    priority?: number;
    displayName?: string;
    logo?: string;
    description?: string;
    keywords?: string[];
  }): Promise<{ id: string }>;
}

/**
 * Drop the tri-state `null`s the ANT program cannot express.
 *
 * A clear degrades to "leave unchanged" here, which is the limitation this
 * path always had — `logo: ''` is rejected outright as InvalidLogo (6021),
 * and after the record had already saved. Only the sponsored actions can
 * actually clear a field.
 */
function antMetadata(p: RecordWriteInput) {
  return {
    ...(p.targetProtocol !== undefined ? { targetProtocol: p.targetProtocol } : {}),
    ...(p.priority !== undefined ? { priority: p.priority } : {}),
    ...(typeof p.displayName === 'string' ? { displayName: p.displayName } : {}),
    ...(typeof p.logo === 'string' ? { logo: p.logo } : {}),
    ...(typeof p.description === 'string' ? { description: p.description } : {}),
    ...(Array.isArray(p.keywords) ? { keywords: p.keywords } : {}),
  };
}

export function antRecordWriter(ant: ANTRecordWriteable): RecordWriter {
  return {
    setRecord: (change) => {
      const { undername, transactionId, ttlSeconds } = change;
      const meta = antMetadata(change);
      return undername === APEX
        ? ant.setBaseNameRecord({ transactionId, ttlSeconds, ...meta })
        : ant.setUndernameRecord({
            undername,
            transactionId,
            ttlSeconds,
            ...meta,
          });
    },
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
