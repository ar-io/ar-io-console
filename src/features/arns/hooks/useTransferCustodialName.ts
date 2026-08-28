import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useCustodyOwnerClient } from './useCustodyOwnerClient';

export type TransferPhase = 'idle' | 'transferring' | 'success' | 'error';

/**
 * Move a Turbo-held name into the user's own wallet.
 *
 * This is the escape hatch that makes custodial custody acceptable: the
 * checkout tells a card buyer "you can transfer it to your own wallet any
 * time", and until this existed that sentence was not true. It is also the
 * only route out of the operations Turbo cannot perform — controllers,
 * metadata, release and primary-name all become possible again the moment the
 * ANT is theirs.
 *
 * Turbo signs the on-chain transfer, but only against an ACTION-BOUND,
 * single-use signature from the owner, committing to this exact antId and
 * target. The SDK builds and signs that message; a signature captured for any
 * other request cannot authorize this one.
 */
export function useTransferCustodialName() {
  const { getClient, ownerAddress } = useCustodyOwnerClient();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<TransferPhase>('idle');
  const [error, setError] = useState<Error | undefined>();
  const [messageId, setMessageId] = useState<string | undefined>();

  const reset = useCallback(() => {
    setPhase('idle');
    setError(undefined);
    setMessageId(undefined);
  }, []);

  const transfer = useCallback(
    async ({ antId, target }: { antId: string; target: string }) => {
      if (!ownerAddress) {
        const e = new Error(
          'Connect your wallet to move this name.',
        );
        setPhase('error');
        setError(e);
        throw e;
      }
      // An empty antId comes back from Turbo when the only receipt it holds is
      // an extend/upgrade on a name the caller never owned. Transferring that
      // is meaningless and the request would 4xx.
      if (!antId) {
        const e = new Error('This name has no ANT that Turbo can transfer.');
        setPhase('error');
        setError(e);
        throw e;
      }

      setPhase('transferring');
      setError(undefined);
      try {
        /*
          Signed by the identity that BOUGHT the name, which on this route is
          often not a Solana wallet — the service derives the owner from the
          signature, so signing as Solana here proved the wrong identity and
          locked the buyer out of their own name.
        */
        const turbo = await getClient();
        const res = await turbo.transferArNSAnt({ antId, target });
        setMessageId(res.messageId);
        setPhase('success');
        // Custody just changed, so every custody-derived control is stale.
        void queryClient.invalidateQueries({ queryKey: ['turbo-arns-names'] });
        // The name now belongs to the user on-chain, so the owned-names lists
        // that read the ACL need to pick it up too.
        void queryClient.invalidateQueries({ queryKey: ['arns-owned'] });
        return res;
      } catch (err) {
        const normalized = err instanceof Error ? err : new Error(String(err));
        setPhase('error');
        setError(normalized);
        throw normalized;
      }
    },
    [getClient, ownerAddress, queryClient],
  );

  return {
    transfer,
    reset,
    phase,
    error,
    messageId,
    isBusy: phase === 'transferring',
  };
}
