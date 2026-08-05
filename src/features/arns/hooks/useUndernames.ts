import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getANT, getWritableANT } from '../../../utils';
import { useArNSConfigKey } from './useArNSConfigKey';
import { useArNSTurboSigner } from './useArNSTurboSigner';

/** One undername record, flattened for the editor (full field set). */
export interface UndernameRecord {
  undername: string;
  transactionId: string;
  ttlSeconds: number;
  /** Target storage protocol: 0 = Arweave, 1 = IPFS. */
  targetProtocol: number;
  priority?: number;
  /** Explicit record owner; undefined defaults to the ANT owner. */
  owner?: string;
  displayName?: string;
  logo?: string;
  description?: string;
  keywords?: string[];
}

/** The base-record param set threaded into a `setUndernameRecord` write. */
export interface UndernameRecordChange {
  transactionId: string;
  ttlSeconds: number;
  targetProtocol: number;
  priority?: number;
  displayName?: string;
  logo?: string;
  description?: string;
  keywords?: string[];
}

type ANTRecordReadState = {
  transactionId?: string;
  ttlSeconds?: number;
  targetProtocol?: number;
  priority?: number;
  owner?: string;
  displayName?: string;
  logo?: string;
  description?: string;
  keywords?: string[];
  index?: number;
};

/** Structural view of the read-only ANT client's records getter. */
type ANTRecordsReadable = {
  getRecords(opts?: {
    includeMetadata?: boolean;
  }): Promise<Record<string, ANTRecordReadState | undefined>>;
};

/** Structural view of the ANT writeable's undername setters. */
type ANTUndernameWriteable = {
  setUndernameRecord(
    p: { undername: string } & UndernameRecordChange,
  ): Promise<{ id: string }>;
  removeUndernameRecord(p: { undername: string }): Promise<{ id: string }>;
  transferRecord(p: {
    undername: string;
    recipient: string;
  }): Promise<{ id: string }>;
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
  const configKey = useArNSConfigKey();
  return useQuery<UndernameRecord[]>({
    queryKey: ['ant-undernames', configKey, processId],
    enabled: enabled && !!processId,
    staleTime: 15_000,
    queryFn: async () => {
      const ant = (await getANT(processId as string)) as unknown as ANTRecordsReadable;
      const records = await ant.getRecords({ includeMetadata: true });
      return Object.entries(records)
        .filter(([key]) => key !== '@')
        .map(([undername, rec]) => ({
          index: rec?.index ?? Number.MAX_SAFE_INTEGER,
          record: {
            undername,
            transactionId: rec?.transactionId ?? '',
            ttlSeconds: rec?.ttlSeconds ?? 0,
            targetProtocol: rec?.targetProtocol ?? 0,
            priority: rec?.priority,
            owner: rec?.owner,
            displayName: rec?.displayName,
            logo: rec?.logo,
            description: rec?.description,
            keywords: Array.isArray(rec?.keywords) ? rec?.keywords : undefined,
          } satisfies UndernameRecord,
        }))
        .sort((a, b) => a.index - b.index)
        .map((entry) => entry.record);
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
      record: UndernameRecordChange,
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
        window.dispatchEvent(new CustomEvent('refresh-balance'));
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

  const transferUndernameOwnership = useCallback(
    async (
      processId: string,
      undername: string,
      recipient: string,
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
        await ant.transferRecord({ undername, recipient });
        setPhase('success');
        window.dispatchEvent(new CustomEvent('refresh-balance'));
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
        window.dispatchEvent(new CustomEvent('refresh-balance'));
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
    transferUndernameOwnership,
    reset,
    phase,
    busyKey,
    error,
    isBusy: phase === 'submitting',
  };
}
