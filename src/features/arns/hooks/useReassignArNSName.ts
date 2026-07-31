import { useCallback, useState } from 'react';

import { getWritableARIO } from '../../../utils';
import { lowerCaseDomain } from '../utils';
import { useArNSTurboSigner } from './useArNSTurboSigner';

export type ReassignPhase = 'idle' | 'submitting' | 'success' | 'error';

/** Structural view of the ARIO writeable's reassignName. */
type ARIOReassignWriteable = {
  reassignName(params: {
    name: string;
    processId: string;
  }): Promise<{ id: string }>;
};

/**
 * Reassign an owned ArNS name to a different ANT you control. An ARIO contract
 * write signed by the name's current owner; no ARIO/credit price (just SOL
 * gas). Pointing a name at the wrong/uncontrolled ANT breaks its resolution, so
 * the UI gates this behind a valid target + explicit acknowledgement.
 */
export function useReassignArNSName() {
  const signer = useArNSTurboSigner();
  const [phase, setPhase] = useState<ReassignPhase>('idle');
  const [error, setError] = useState<Error | undefined>();
  const [txId, setTxId] = useState<string | undefined>();

  const reset = useCallback(() => {
    setPhase('idle');
    setError(undefined);
    setTxId(undefined);
  }, []);

  const reassign = useCallback(
    async (
      name: string,
      targetProcessId: string,
    ): Promise<string | undefined> => {
      setError(undefined);
      if (!signer.isReady || !signer.walletAdapter) {
        const e = new Error(
          'Connect a Solana wallet with a live signer to reassign this name.',
        );
        setPhase('error');
        setError(e);
        throw e;
      }
      try {
        setPhase('submitting');
        const ario = getWritableARIO(
          signer.getSolanaSigner(),
        ) as unknown as ARIOReassignWriteable;
        const res = await ario.reassignName({
          name: lowerCaseDomain(name),
          processId: targetProcessId.trim(),
        });
        setTxId(res?.id);
        setPhase('success');
        return res?.id;
      } catch (err) {
        const normalized = err instanceof Error ? err : new Error(String(err));
        setPhase('error');
        setError(normalized);
        throw normalized;
      }
    },
    [signer],
  );

  return { reassign, reset, phase, error, txId, isBusy: phase === 'submitting' };
}
