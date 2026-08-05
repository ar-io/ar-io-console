import { useCallback, useState } from 'react';

import { getWritableANT } from '../../../utils';
import { useArNSTurboSigner } from './useArNSTurboSigner';

export type TransferPhase = 'idle' | 'submitting' | 'success' | 'error';

/** Structural view of the ANT writeable's owner transfer. */
type ANTTransferWriteable = {
  transfer(params: { target: string }): Promise<{ id: string }>;
};

/**
 * Transfer an owned ArNS name to another wallet. This transfers the underlying
 * ANT (Metaplex Core asset) to `target`, handing over the name and all its
 * records — an ANT write signed by the current owner. There's no ARIO/credit
 * price (just SOL gas), and it is irreversible from the sender's side.
 */
export function useTransferArNSName() {
  const signer = useArNSTurboSigner();
  const [phase, setPhase] = useState<TransferPhase>('idle');
  const [error, setError] = useState<Error | undefined>();
  const [txId, setTxId] = useState<string | undefined>();

  const reset = useCallback(() => {
    setPhase('idle');
    setError(undefined);
    setTxId(undefined);
  }, []);

  const transfer = useCallback(
    async (processId: string, target: string): Promise<string | undefined> => {
      setError(undefined);
      if (!signer.isReady || !signer.walletAdapter) {
        const e = new Error(
          'Connect a Solana wallet with a live signer to transfer this name.',
        );
        setPhase('error');
        setError(e);
        throw e;
      }
      try {
        setPhase('submitting');
        const ant = (await getWritableANT(
          processId,
          signer.getSolanaSigner(),
        )) as unknown as ANTTransferWriteable;
        const res = await ant.transfer({ target: target.trim() });
        setTxId(res?.id);
        setPhase('success');
        window.dispatchEvent(new CustomEvent('refresh-balance'));
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

  return {
    transfer,
    reset,
    phase,
    error,
    txId,
    isBusy: phase === 'submitting',
  };
}
