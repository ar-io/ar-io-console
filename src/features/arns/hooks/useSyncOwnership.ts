import { useCallback, useState } from 'react';

import { getWritableANT } from '../../../utils';
import { useArNSTurboSigner } from './useArNSTurboSigner';

export type SyncOwnershipPhase = 'idle' | 'submitting' | 'success' | 'error';

/** Structural view of the ANT writeable's ACL reconciler. */
type ANTSyncAclWriteable = {
  syncAcl(): Promise<{ id: string }>;
};

export interface SyncOwnershipProgress {
  /** How many drifted names have been synced so far. */
  done: number;
  /** Total to sync this run. */
  total: number;
  /** The name currently being synced. */
  current?: string;
}

/**
 * Reconcile drifted ANTs' on-chain ACLs with their live NFT owner via the SDK's
 * `syncAcl` — one ANT write (Solana signature) per name. Drives a batch: only
 * call this for names known to have drifted (see {@link useAclDrift}); on a
 * name whose owner ACL entry already exists the program rejects the write
 * (`AclEntryAlreadyExists`), which is why blind/unconditional syncing is never
 * done. Each name that fails is collected in `failed` without aborting the rest.
 */
export function useSyncOwnership() {
  const signer = useArNSTurboSigner();
  const [phase, setPhase] = useState<SyncOwnershipPhase>('idle');
  const [error, setError] = useState<Error | undefined>();
  const [progress, setProgress] = useState<SyncOwnershipProgress>({
    done: 0,
    total: 0,
  });
  const [failed, setFailed] = useState<string[]>([]);

  const reset = useCallback(() => {
    setPhase('idle');
    setError(undefined);
    setProgress({ done: 0, total: 0 });
    setFailed([]);
  }, []);

  const syncNames = useCallback(
    async (
      names: Array<{ name: string; processId: string }>,
    ): Promise<{ synced: number; failed: string[] }> => {
      setError(undefined);
      setFailed([]);
      if (!signer.isReady || !signer.walletAdapter) {
        const e = new Error(
          'Connect a Solana wallet with a live signer to sync ownership.',
        );
        setPhase('error');
        setError(e);
        throw e;
      }

      setPhase('submitting');
      setProgress({ done: 0, total: names.length });
      const failures: string[] = [];
      let synced = 0;

      for (let i = 0; i < names.length; i++) {
        const n = names[i];
        setProgress({ done: i, total: names.length, current: n.name });
        try {
          const ant = (await getWritableANT(
            n.processId,
            signer.getSolanaSigner(),
          )) as unknown as ANTSyncAclWriteable;
          await ant.syncAcl();
          synced++;
        } catch {
          failures.push(n.name);
        }
      }

      setProgress({ done: names.length, total: names.length });
      setFailed(failures);
      // Any success is a meaningful outcome; only a total wipe-out is an error.
      setPhase(synced === 0 && names.length > 0 ? 'error' : 'success');
      if (synced === 0 && names.length > 0) {
        setError(new Error('Could not sync the affected names. Please retry.'));
      }
      return { synced, failed: failures };
    },
    [signer],
  );

  return {
    syncNames,
    reset,
    phase,
    error,
    progress,
    failed,
    isBusy: phase === 'submitting',
  };
}
