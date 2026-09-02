import { useCallback, useState } from 'react';

import { isInsufficientCredits } from './useManageArNSName';
import { useQuery } from '@tanstack/react-query';

import { getANT, getWritableANT } from '@/utils';
import { useArNSConfigKey } from './useArNSConfigKey';
import { useArNSTurboSigner } from './useArNSTurboSigner';

/** The current controller set plus the owner, read for the Controllers editor. */
export interface ControllersState {
  /** ANT owner (implicitly a controller; cannot be re-added). */
  owner: string;
  /** Delegated controllers who can manage records/metadata but not transfer. */
  controllers: string[];
}

/** Structural view of the read-only ANT client's state getter. */
type ANTControllersReadable = {
  getState(): Promise<{ Owner?: string; Controllers?: string[] }>;
};

/** Structural view of the ANT writeable's controller mutators. */
type ANTControllerWriteable = {
  addController(p: { controller: string }): Promise<{ id: string }>;
  removeController(p: { controller: string }): Promise<{ id: string }>;
};

/**
 * Read an ANT's controllers and owner from `getState()`. One read; cached
 * briefly while the editor is open. The owner is needed alongside the controller
 * list so the add form can reject re-adding the (implicit-controller) owner.
 */
export function useControllersState(
  processId: string | undefined,
  enabled: boolean,
) {
  const configKey = useArNSConfigKey();
  return useQuery<ControllersState>({
    queryKey: ['ant-controllers', configKey, processId],
    enabled: enabled && !!processId,
    staleTime: 15_000,
    queryFn: async () => {
      const ant = (await getANT(
        processId as string,
      )) as unknown as ANTControllersReadable;
      const state = await ant.getState();
      return {
        owner: state.Owner ?? '',
        controllers: Array.isArray(state.Controllers) ? state.Controllers : [],
      };
    },
  });
}

export type ControllerWritePhase = 'idle' | 'submitting' | 'success' | 'error';

/**
 * Add/remove ANT controllers on an owned name. Each op is a single ANT write
 * (one Solana wallet signature); no ARIO/credit price (just SOL gas). Only the
 * ANT owner can add/remove controllers — a non-owner write is rejected on-chain
 * and surfaced via `error`.
 */
export function useControllerWrites() {
  const signer = useArNSTurboSigner();
  const [phase, setPhase] = useState<ControllerWritePhase>('idle');
  /** The controller address currently being written (for per-row busy state). */
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<Error | undefined>();
  /*
    Adding or removing a controller is billed in credits. Same gap as
    `useTransferArNSName`: priced up front, then whatever the service returned.
  */
  const [insufficientCredits, setInsufficientCredits] = useState(false);

  const ensureSigner = useCallback(() => {
    if (!signer.isReady || !signer.walletAdapter) {
      const e = new Error(
        'Connect a Solana wallet with a live signer to manage controllers.',
      );
      setPhase('error');
      setError(e);
      throw e;
    }
  }, [signer]);

  const addController = useCallback(
    async (processId: string, controller: string): Promise<boolean> => {
      setError(undefined);
      setInsufficientCredits(false);
      ensureSigner();
      setPhase('submitting');
      setBusyKey(controller);
      try {
        const ant = (await getWritableANT(
          processId,
          signer.getSolanaSigner(),
        )) as unknown as ANTControllerWriteable;
        await ant.addController({ controller });
        setPhase('success');
        window.dispatchEvent(new CustomEvent('refresh-balance'));
        return true;
      } catch (err) {
        const normalized = err instanceof Error ? err : new Error(String(err));
        setPhase('error');
        setInsufficientCredits(isInsufficientCredits(normalized));
        setError(normalized);
        throw normalized;
      } finally {
        setBusyKey(null);
      }
    },
    [ensureSigner, signer],
  );

  const removeController = useCallback(
    async (processId: string, controller: string): Promise<boolean> => {
      setError(undefined);
      setInsufficientCredits(false);
      ensureSigner();
      setPhase('submitting');
      setBusyKey(controller);
      try {
        const ant = (await getWritableANT(
          processId,
          signer.getSolanaSigner(),
        )) as unknown as ANTControllerWriteable;
        await ant.removeController({ controller });
        setPhase('success');
        window.dispatchEvent(new CustomEvent('refresh-balance'));
        return true;
      } catch (err) {
        const normalized = err instanceof Error ? err : new Error(String(err));
        setPhase('error');
        setInsufficientCredits(isInsufficientCredits(normalized));
        setError(normalized);
        throw normalized;
      } finally {
        setBusyKey(null);
      }
    },
    [ensureSigner, signer],
  );

  const reset = useCallback(() => {
    setPhase('idle');
    setBusyKey(null);
    setError(undefined);
    setInsufficientCredits(false);
  }, []);

  return {
    addController,
    removeController,
    reset,
    phase,
    busyKey,
    error,
    /** True when the failure was insufficient credits — the UI offers Top-Up. */
    insufficientCredits,
    isBusy: phase === 'submitting',
  };
}
