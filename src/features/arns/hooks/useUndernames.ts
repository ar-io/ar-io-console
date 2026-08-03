import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getANT, getWritableANT } from '../../../utils';
import { useArNSTurboSigner } from './useArNSTurboSigner';

/** One undername record, flattened for the editor. */
export interface UndernameRecord {
  undername: string;
  transactionId: string;
  ttlSeconds: number;
}

/** Structural view of the read-only ANT client's records getter. */
type ANTRecordsReadable = {
  getRecords(): Promise<
    Record<
      string,
      { transactionId?: string; ttlSeconds?: number; index?: number } | undefined
    >
  >;
};

/** Structural view of the ANT writeable's undername setters. */
type ANTUndernameWriteable = {
  setUndernameRecord(p: {
    undername: string;
    transactionId: string;
    ttlSeconds: number;
  }): Promise<{ id: string }>;
  removeUndernameRecord(p: { undername: string }): Promise<{ id: string }>;
};

/**
 * Read an ANT's undername records (everything except the apex `@`), sorted by
 * their on-chain index. One `getRecords` read; cached briefly while the editor
 * is open.
 */
export function useUndernameRecords(
  processId: string | undefined,
  enabled: boolean,
) {
  return useQuery<UndernameRecord[]>({
    queryKey: ['ant-undernames', processId],
    enabled: enabled && !!processId,
    staleTime: 15_000,
    queryFn: async () => {
      const ant = (await getANT(processId as string)) as unknown as ANTRecordsReadable;
      const records = await ant.getRecords();
      return Object.entries(records)
        .filter(([key]) => key !== '@')
        .map(([undername, rec]) => ({
          undername,
          transactionId: rec?.transactionId ?? '',
          ttlSeconds: rec?.ttlSeconds ?? 0,
          index: rec?.index ?? Number.MAX_SAFE_INTEGER,
        }))
        .sort((a, b) => a.index - b.index)
        .map(({ undername, transactionId, ttlSeconds }) => ({
          undername,
          transactionId,
          ttlSeconds,
        }));
    },
  });
}

export type UndernameWritePhase = 'idle' | 'submitting' | 'success' | 'error';

/**
 * Add/update and remove undername records on an owned name. Each op is a single
 * ANT write (one wallet signature); no ARIO/credit price (just SOL gas). Note
 * adding an undername beyond the name's undername limit fails on-chain — surface
 * the error and point the user at "Add undernames" (increase the limit).
 */
export function useUndernameWrites() {
  const signer = useArNSTurboSigner();
  const [phase, setPhase] = useState<UndernameWritePhase>('idle');
  /** The undername currently being written (for per-row busy state). */
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<Error | undefined>();

  const ensureSigner = useCallback(() => {
    if (!signer.isReady || !signer.walletAdapter) {
      const e = new Error(
        'Connect a Solana wallet with a live signer to edit undernames.',
      );
      setPhase('error');
      setError(e);
      throw e;
    }
  }, [signer]);

  const saveUndername = useCallback(
    async (
      processId: string,
      undername: string,
      record: { transactionId: string; ttlSeconds: number },
    ): Promise<boolean> => {
      setError(undefined);
      ensureSigner();
      setPhase('submitting');
      setBusyKey(undername);
      try {
        const ant = (await getWritableANT(
          processId,
          signer.getSolanaSigner(),
        )) as unknown as ANTUndernameWriteable;
        await ant.setUndernameRecord({ undername, ...record });
        setPhase('success');
        return true;
      } catch (err) {
        const normalized = err instanceof Error ? err : new Error(String(err));
        setPhase('error');
        setError(normalized);
        throw normalized;
      } finally {
        setBusyKey(null);
      }
    },
    [ensureSigner, signer],
  );

  const removeUndername = useCallback(
    async (processId: string, undername: string): Promise<boolean> => {
      setError(undefined);
      ensureSigner();
      setPhase('submitting');
      setBusyKey(undername);
      try {
        const ant = (await getWritableANT(
          processId,
          signer.getSolanaSigner(),
        )) as unknown as ANTUndernameWriteable;
        await ant.removeUndernameRecord({ undername });
        setPhase('success');
        return true;
      } catch (err) {
        const normalized = err instanceof Error ? err : new Error(String(err));
        setPhase('error');
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
  }, []);

  return {
    saveUndername,
    removeUndername,
    reset,
    phase,
    busyKey,
    error,
    isBusy: phase === 'submitting',
  };
}
