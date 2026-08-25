import type { RecordWriter } from './recordWriter';

/** The ANT writeable surface these adapters need. Structural, so no SDK import. */
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

/** The Turbo custodial surface these adapters need. */
export interface TurboRecordClient {
  setArNSRecord(p: {
    antId: string;
    undername?: string;
    transactionId: string;
    ttlSeconds: number;
  }): Promise<{ messageId: string }>;
  removeArNSRecord(p: {
    antId: string;
    undername: string;
  }): Promise<{ messageId: string }>;
}

export const APEX = '@';

/**
 * Writes with the owner's own signer.
 *
 * The ANT client splits the apex record from undernames into two different
 * methods, while Turbo takes `undername` as one parameter defaulting to `@`.
 * Normalising that here is the whole reason this adapter exists — callers pass
 * `'@'` like any other label and stop caring which method it maps to.
 */
export function antRecordWriter(ant: ANTRecordWriteable): RecordWriter {
  return {
    setRecord: ({ undername, transactionId, ttlSeconds }) =>
      undername === APEX
        ? ant.setBaseNameRecord({ transactionId, ttlSeconds })
        : ant.setUndernameRecord({ undername, transactionId, ttlSeconds }),
    removeRecord: ({ undername }) => {
      if (undername === APEX) {
        // The apex record is the name itself resolving; the ANT has no method
        // to delete it and doing so would break the domain entirely.
        return Promise.reject(
          new Error('The main record cannot be removed — point it elsewhere instead.'),
        );
      }
      return ant.removeUndernameRecord({ undername });
    },
  };
}

/**
 * Writes through Turbo, for a name it holds in custody.
 *
 * Each call is signed action-bound and single-use by the SDK, so a failure must
 * never be retried by re-sending: the nonce is spent and the replay is
 * rejected. Retrying means signing afresh, which is a new call through here.
 */
export function turboRecordWriter(
  antId: string,
  turbo: TurboRecordClient,
): RecordWriter {
  const requireAnt = () => {
    if (!antId) {
      // Turbo returns an empty antId when the only receipt it holds is an
      // extend/upgrade on a name the caller never owned.
      throw new Error('Turbo has no ANT on record for this name.');
    }
  };
  return {
    setRecord: async ({ undername, transactionId, ttlSeconds }) => {
      requireAnt();
      const res = await turbo.setArNSRecord({
        antId,
        undername,
        transactionId,
        ttlSeconds,
      });
      return { id: res.messageId };
    },
    removeRecord: async ({ undername }) => {
      requireAnt();
      const res = await turbo.removeArNSRecord({ antId, undername });
      return { id: res.messageId };
    },
  };
}
