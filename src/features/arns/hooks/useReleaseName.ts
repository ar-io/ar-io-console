import { useCallback, useState } from 'react';

import { getWritableARIO } from '../../../utils';
import { lowerCaseDomain } from '../utils';
import { useArNSTurboSigner } from './useArNSTurboSigner';

export type ReleasePhase = 'idle' | 'submitting' | 'success' | 'error';

/** Structural view of the ARIO writeable's releaseName. */
type ARIOReleaseWriteable = {
  releaseName(params: { name: string }): Promise<{ id: string }>;
};

/**
 * Release a permanently-owned (permabuy) ArNS name back to the protocol. An
 * ARIO contract write signed by the name's current owner; no ARIO/credit price
 * (just SOL gas). This closes the name's registration and starts a 14-day
 * returned-name (declining-price) auction that anyone can buy from — the caller
 * receives nothing and the name is gone. Because it is destructive and
 * irreversible, the UI gates it behind a typed-name confirmation + explicit
 * acknowledgement, and only offers it for permabuy names (leases simply expire).
 */
export function useReleaseName() {
  const signer = useArNSTurboSigner();
  const [phase, setPhase] = useState<ReleasePhase>('idle');
  const [error, setError] = useState<Error | undefined>();
  const [txId, setTxId] = useState<string | undefined>();

  const reset = useCallback(() => {
    setPhase('idle');
    setError(undefined);
    setTxId(undefined);
  }, []);

  const release = useCallback(
    async (name: string): Promise<string | undefined> => {
      setError(undefined);
      if (!signer.isReady || !signer.walletAdapter) {
        const e = new Error(
          'Connect a Solana wallet with a live signer to release this name.',
        );
        setPhase('error');
        setError(e);
        throw e;
      }
      try {
        setPhase('submitting');
        const ario = getWritableARIO(
          signer.getSolanaSigner(),
        ) as unknown as ARIOReleaseWriteable;
        const res = await ario.releaseName({ name: lowerCaseDomain(name) });
        setTxId(res?.id);
        setPhase('success');
        // Release spends SOL gas — refresh balance-dependent UI.
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

  return { release, reset, phase, error, txId, isBusy: phase === 'submitting' };
}
