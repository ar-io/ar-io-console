import { useCallback } from 'react';

import { useArNSTurboSigner } from './useArNSTurboSigner';
import { useCustodyOwnerClient } from './useCustodyOwnerClient';
import { useAntSummaries } from './useAntLogos';
import { browserArNSOwnerSigner } from '../actions/browserOwnerSigner';
import { deriveAntRoleStrict } from '../antRole';
import { getWritableANT } from '../../../utils';
import type { RecordWriter } from '../records/recordWriter';
import {
  antRecordWriter,
  type ANTRecordWriteable,
} from '../records/antWriter';
import {
  sponsoredRecordWriter,
  type SponsoredRecordClient,
} from '../records/sponsoredWriter';
import { writerCostNote, writerForRole } from '../records/writerChoice';

/**
 * The writer for a name's records, chosen by what this wallet is to the name.
 *
 * Turbo sponsors record writes for the OWNER only: `setArNSRecord` takes an
 * `ArNSOwnerSigner` and the service verifies that proof against the current
 * on-chain owner. A controller is still entitled to edit records — the program
 * allows it — but must sign and pay for it themselves.
 *
 * Two identities are involved on the sponsored path and they are frequently
 * different wallets: the PAYER (the session identity, whose Turbo client makes
 * the request) and the OWNER (the Solana wallet that holds the name and
 * approves the write). A record write costs no credits, so the payer here is
 * only proving who is asking.
 */
export function useRecordWriter(processId: string | undefined) {
  const signer = useArNSTurboSigner();
  const { getClient } = useCustodyOwnerClient();
  const summaries = useAntSummaries(processId ? [processId] : []);

  const role = deriveAntRoleStrict(
    processId ? summaries.get(processId) : undefined,
    signer.address,
  );
  const kind = writerForRole(role);

  const getWriter = useCallback(
    async (antId?: string): Promise<RecordWriter> => {
      const id = antId ?? processId;
      if (!id) {
        throw new Error('This name has no record to edit yet.');
      }
      if (!signer.isReady || !signer.walletAdapter || !signer.address) {
        throw new Error(
          'Connect the Solana wallet that owns or controls this name to edit its records.',
        );
      }
      /*
        Never dispatch on an unresolved role. Guessing sponsored for a
        controller spends a wallet prompt on a request the service will reject;
        guessing self-signed for an owner asks them to pay a fee they do not
        owe.
      */
      if (kind === 'blocked') {
        throw new Error(
          'Still checking what this wallet can do with this name. Try again in a moment.',
        );
      }

      if (kind === 'self-signed') {
        const ant = (await getWritableANT(
          id,
          signer.getSolanaSigner(),
        )) as unknown as ANTRecordWriteable;
        return antRecordWriter(ant);
      }

      const turbo = (await getClient()) as unknown as SponsoredRecordClient;
      return sponsoredRecordWriter(
        id,
        turbo,
        browserArNSOwnerSigner({
          address: signer.address,
          signTransaction: signer.walletAdapter.signTransaction,
          signMessage: signer.walletAdapter.signMessage,
        }),
      );
    },
    [getClient, signer, processId, kind],
  );

  return {
    getWriter,
    /** True when a wallet is present and able to approve a write. */
    canWrite: signer.isReady && kind !== 'blocked',
    /** True while the role is still resolving — writes must wait, not guess. */
    isResolving: kind === 'blocked' && role === 'unknown',
    /** What this wallet's edits cost, for the note above the editor. */
    costNote: writerCostNote(kind),
  };
}
