import { useCallback, useState } from 'react';

import { getWritableANT } from '../../../utils';
import { useArNSTurboSigner } from './useArNSTurboSigner';

export type SetMetadataPhase = 'idle' | 'submitting' | 'success' | 'error';

/**
 * The full base `@` record param set. `setBaseNameRecord` bundles all of these
 * into ONE transaction (metadata is a second instruction in the same tx), so an
 * entire record — target, protocol, ttl, and the advanced fields — saves in a
 * single wallet signature. `owner` is deliberately NOT part of this shape:
 * record-ownership transfers route through the separate `baseRecordOwner` op.
 */
export interface BaseRecordChange {
  transactionId: string;
  ttlSeconds: number;
  /** Storage protocol: 0 = Arweave, 1 = IPFS. */
  targetProtocol: number;
  priority?: number;
  displayName?: string;
  logo?: string;
  description?: string;
  keywords?: string[];
}

/**
 * A diff of ANT metadata + base `@` record fields to write. Only include the
 * fields that changed. ANT-level metadata fields (name/ticker/description/
 * keywords/logo) each become their own on-chain write (and wallet signature).
 * `baseRecord` bundles every base-record field into a SINGLE `setBaseNameRecord`
 * write. `baseRecordOwner` is a SEPARATE op — a record-ownership transfer.
 */
export interface ArNSMetadataChanges {
  name?: string;
  ticker?: string;
  description?: string;
  keywords?: string[];
  logo?: string;
  baseRecord?: BaseRecordChange;
  /** New owner for the base `@` record — its own `transferRecord` signature. */
  baseRecordOwner?: string;
}

/** Structural view of the ANT writeable's metadata + base-record setters. */
type ANTMetadataWriteable = {
  setName(p: { name: string }): Promise<{ id: string }>;
  setTicker(p: { ticker: string }): Promise<{ id: string }>;
  setDescription(p: { description: string }): Promise<{ id: string }>;
  setKeywords(p: { keywords: string[] }): Promise<{ id: string }>;
  setLogo(p: { txId: string }): Promise<{ id: string }>;
  setBaseNameRecord(p: BaseRecordChange): Promise<{ id: string }>;
  transferRecord(p: {
    undername: string;
    recipient: string;
  }): Promise<{ id: string }>;
};

export interface MetadataProgress {
  /** Fields written so far. */
  done: number;
  /** Total fields to write this run. */
  total: number;
  /** Human label of the field currently being written. */
  label: string;
}

/**
 * Build the ordered list of write operations from a changes diff. Order is
 * fixed (name → ticker → description → keywords → logo → target → record owner)
 * so progress is deterministic and testable. The base record saves in a single
 * op (all its fields bundled); a record-ownership transfer is a separate op.
 */
function buildOps(
  changes: ArNSMetadataChanges,
): { label: string; run: (ant: ANTMetadataWriteable) => Promise<{ id: string }> }[] {
  const ops: {
    label: string;
    run: (ant: ANTMetadataWriteable) => Promise<{ id: string }>;
  }[] = [];
  if (changes.name !== undefined)
    ops.push({ label: 'Nickname', run: (a) => a.setName({ name: changes.name! }) });
  if (changes.ticker !== undefined)
    ops.push({ label: 'Ticker', run: (a) => a.setTicker({ ticker: changes.ticker! }) });
  if (changes.description !== undefined)
    ops.push({
      label: 'Description',
      run: (a) => a.setDescription({ description: changes.description! }),
    });
  if (changes.keywords !== undefined)
    ops.push({
      label: 'Keywords',
      run: (a) => a.setKeywords({ keywords: changes.keywords! }),
    });
  if (changes.logo !== undefined)
    ops.push({ label: 'Logo', run: (a) => a.setLogo({ txId: changes.logo! }) });
  if (changes.baseRecord !== undefined)
    ops.push({
      label: 'Target',
      run: (a) => a.setBaseNameRecord(changes.baseRecord!),
    });
  if (changes.baseRecordOwner !== undefined)
    ops.push({
      label: 'Record owner',
      run: (a) =>
        a.transferRecord({ undername: '@', recipient: changes.baseRecordOwner! }),
    });
  return ops;
}

export const buildMetadataOps = buildOps;

/**
 * Write a diff of ANT metadata + base `@` record to an owned name. These are
 * free ANT writes (no ARIO/credit price — just SOL gas), but there is **no
 * batch setter**, so each changed field is a separate transaction and a
 * separate wallet signature. Writes run sequentially and progress is surfaced;
 * because the run is not atomic, a mid-run failure leaves already-written
 * fields applied — `completed` reports which, so the UI can say so honestly.
 */
export function useSetArNSMetadata() {
  const signer = useArNSTurboSigner();
  const [phase, setPhase] = useState<SetMetadataPhase>('idle');
  const [progress, setProgress] = useState<MetadataProgress>({
    done: 0,
    total: 0,
    label: '',
  });
  const [completed, setCompleted] = useState<string[]>([]);
  const [error, setError] = useState<Error | undefined>();

  const reset = useCallback(() => {
    setPhase('idle');
    setProgress({ done: 0, total: 0, label: '' });
    setCompleted([]);
    setError(undefined);
  }, []);

  const apply = useCallback(
    async (processId: string, changes: ArNSMetadataChanges): Promise<boolean> => {
      setError(undefined);
      setCompleted([]);
      const ops = buildOps(changes);
      if (ops.length === 0) {
        // Nothing to do — clear any prior 'error' phase so the UI doesn't show a
        // stale error state (error is already reset above).
        setPhase('idle');
        return true;
      }

      if (!signer.isReady || !signer.walletAdapter) {
        const e = new Error(
          'Connect a Solana wallet with a live signer to edit this name.',
        );
        setPhase('error');
        setError(e);
        throw e;
      }

      setPhase('submitting');
      setProgress({ done: 0, total: ops.length, label: ops[0].label });
      const applied: string[] = [];
      try {
        const ant = (await getWritableANT(
          processId,
          signer.getSolanaSigner(),
        )) as unknown as ANTMetadataWriteable;

        for (let i = 0; i < ops.length; i++) {
          setProgress({ done: i, total: ops.length, label: ops[i].label });
          await ops[i].run(ant);
          applied.push(ops[i].label);
          setCompleted([...applied]);
        }

        setProgress({ done: ops.length, total: ops.length, label: '' });
        setPhase('success');
        // ANT writes spend SOL gas — refresh balance-dependent UI.
        window.dispatchEvent(new CustomEvent('refresh-balance'));
        return true;
      } catch (err) {
        const base = err instanceof Error ? err.message : String(err);
        const msg =
          applied.length > 0
            ? `Saved ${applied.join(', ')}, but failed on the next field: ${base}`
            : base;
        const normalized = new Error(msg);
        setPhase('error');
        setError(normalized);
        throw normalized;
      }
    },
    [signer],
  );

  return {
    apply,
    reset,
    phase,
    progress,
    completed,
    error,
    isBusy: phase === 'submitting',
  };
}
