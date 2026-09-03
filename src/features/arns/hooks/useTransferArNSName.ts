import { useCallback, useState } from 'react';


import { useArNSTurboSigner } from './useArNSTurboSigner';
import { useOwnerOpWriter } from './useOwnerOpWriter';

export type TransferPhase = 'idle' | 'submitting' | 'success' | 'error';

/**
 * Transfer an owned ArNS name to another wallet. This transfers the underlying
 * ANT (Metaplex Core asset) to `target`, handing over the name and all its
 * records — an ANT write signed by the current owner. There's no ARIO/credit
 * price (just SOL gas), and it is irreversible from the sender's side.
 */
export function useTransferArNSName(processId?: string) {
  const signer = useArNSTurboSigner();
  /*
    Transfer runs on either rail now: Turbo as fee payer billing credits, or the
    wallet signing and paying SOL. `paysNetworkDirectly` is what the modal needs
    to quote the right cost — a credits figure on the self-signed rail names a
    charge that never arrives.
  */
  const writer = useOwnerOpWriter(processId, 'transfer');
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
        const res = await (
          await writer.getWriter(processId)
        ).transfer({ target: target.trim() });
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
    [signer, writer],
  );

  return {
    transfer,
    reset,
    phase,
    error,
    /** True when the wallet signs and pays SOL — the modal must not quote credits. */
    paysNetworkDirectly: writer.paysNetworkDirectly,
    txId,
    isBusy: phase === 'submitting',
  };
}
