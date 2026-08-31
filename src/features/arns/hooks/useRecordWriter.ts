import { useCallback } from 'react';

import { useArNSTurboSigner } from './useArNSTurboSigner';
import { useCustodyOwnerClient } from './useCustodyOwnerClient';
import { browserArNSOwnerSigner } from '../actions/browserOwnerSigner';
import type { RecordWriter } from '../records/recordWriter';
import {
  sponsoredRecordWriter,
  type SponsoredRecordClient,
} from '../records/sponsoredWriter';

/**
 * The writer for a name's records.
 *
 * One implementation now. This hook used to pick between the owner's own ANT
 * signer and Turbo's custodial route, and had to WAIT for custody to resolve
 * before dispatching — guessing wrong asked a wallet to sign for an asset it
 * did not own. Custody is gone, every name is the user's, and Turbo writes
 * every record, so there is nothing left to resolve and nothing to block on.
 *
 * Two identities are still involved and they are frequently different wallets:
 * the PAYER (the session identity, whose Turbo client is used) and the OWNER
 * (the Solana wallet that holds the name and approves the write). A record
 * write costs no credits, so the payer here is only proving who is asking.
 */
export function useRecordWriter(processId: string | undefined) {
  const signer = useArNSTurboSigner();
  const { getClient } = useCustodyOwnerClient();

  const getWriter = useCallback(
    async (antId?: string): Promise<RecordWriter> => {
      const id = antId ?? processId;
      if (!id) {
        throw new Error('This name has no record to edit yet.');
      }
      if (!signer.isReady || !signer.walletAdapter || !signer.address) {
        throw new Error(
          'Connect the Solana wallet that owns this name to edit its records.',
        );
      }

      const turbo = (await getClient()) as unknown as SponsoredRecordClient;
      const owner = browserArNSOwnerSigner({
        address: signer.address,
        signTransaction: signer.walletAdapter.signTransaction,
        signMessage: signer.walletAdapter.signMessage,
      });

      return sponsoredRecordWriter(id, turbo, owner);
    },
    [getClient, signer, processId],
  );

  return {
    getWriter,
    /** True when a wallet is present and able to approve a write. */
    canWrite: signer.isReady,
  };
}
