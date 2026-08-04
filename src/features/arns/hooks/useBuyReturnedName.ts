import { useCallback, useRef, useState } from 'react';

import { APP_NAME } from '../../../constants';
import { useStore } from '../../../store/useStore';
import { getWritableARIO } from '../../../utils';
import { spawnArNSAnt } from '../services/antSpawn';
import {
  clearPendingArNSPurchase,
  getPendingArNSPurchase,
  savePendingArNSPurchase,
} from '../services/arnsPurchaseResume';
import { lowerCaseDomain } from '../utils';
import { useArNSTurboSigner } from './useArNSTurboSigner';
import type { ArNSBuyFundFrom } from './useBuyArNSName';

export type BuyReturnedNamePhase = 'idle' | 'submitting' | 'success' | 'error';

export interface BuyReturnedNameInput {
  name: string;
  type: 'lease' | 'permabuy';
  /** Lease term in years (ignored for permabuy). */
  years?: number;
  /** Funding source for the ARIO price. Defaults to Turbo Credits. */
  fundFrom?: ArNSBuyFundFrom;
}

export interface BuyReturnedNameProgress {
  /** Steps completed so far. */
  done: number;
  /** Total steps this run (always 2: spawn ANT → buy). */
  total: number;
  /** Human label of the current step. */
  label: string;
}

export interface BuyReturnedNameResult {
  /** Buy-transaction / message id. */
  messageId: string;
  /** The freshly spawned ANT's process id. */
  processId: string;
}

/** Structural view of the ARIO writeable's returned-name buy. */
type ARIOReturnedNameWriteable = {
  buyReturnedName(params: {
    name: string;
    type: 'lease' | 'permabuy';
    years?: number;
    processId: string;
    fundFrom?: ArNSBuyFundFrom;
    referrer?: string;
    paidBy?: string | string[];
  }): Promise<{ id: string; result?: { processId?: string } }>;
};

/**
 * buyReturnedName rejects when the wallet can't cover the price. Same defensive
 * message-matching as useBuyArNSName so we can route to Top-Up.
 */
function isInsufficientCredits(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /insufficient|not enough|balance too low|underfunded|exceeds balance|402/i.test(
    msg,
  );
}

/**
 * Buy a name from its returned-name (Dutch auction) at the current decaying
 * premium — a Solana-only, **two-signature** flow (buyReturnedName is NOT
 * atomic and REQUIRES a real processId, unlike buyRecord):
 *
 *   Step 1/2 — spawn a fresh user-owned ANT (real SOL, ~0.02). The processId is
 *   persisted (ref + `arnsPurchaseResume`) so a step-2 retry NEVER re-spawns.
 *   Step 2/2 — `buyReturnedName({ name, type, years?, processId, fundFrom })`.
 *
 * Mirrors useBuyArNSName's error/insufficient-credits handling and the
 * "one approval per change" progress UX of useSetArNSMetadata.
 */
export function useBuyReturnedName() {
  const signer = useArNSTurboSigner();
  const getCurrentConfig = useStore((s) => s.getCurrentConfig);

  const [phase, setPhase] = useState<BuyReturnedNamePhase>('idle');
  const [progress, setProgress] = useState<BuyReturnedNameProgress>({
    done: 0,
    total: 2,
    label: '',
  });
  const [result, setResult] = useState<BuyReturnedNameResult | undefined>();
  const [error, setError] = useState<Error | undefined>();
  const [insufficientCredits, setInsufficientCredits] = useState(false);

  // Survives a step-2 retry within the same mount so we never re-spawn an ANT.
  const spawnedProcessId = useRef<string | undefined>();

  const reset = useCallback(() => {
    setPhase('idle');
    setProgress({ done: 0, total: 2, label: '' });
    setResult(undefined);
    setError(undefined);
    setInsufficientCredits(false);
    spawnedProcessId.current = undefined;
    clearPendingArNSPurchase();
  }, []);

  const buy = useCallback(
    async ({
      name,
      type,
      years,
      fundFrom = 'turbo',
    }: BuyReturnedNameInput): Promise<BuyReturnedNameResult | undefined> => {
      const lowered = lowerCaseDomain(name);
      setError(undefined);
      setInsufficientCredits(false);
      setResult(undefined);

      const owner = signer.address;
      if (!signer.isReady || !owner || !signer.walletAdapter) {
        const e = new Error(
          'Connect a Solana wallet with a live signer to buy from the auction.',
        );
        setPhase('error');
        setError(e);
        throw e;
      }

      setPhase('submitting');

      try {
        // ── Step 1/2 — spawn (or reuse) the user-owned ANT ──────────────────
        // Reuse a processId from an earlier attempt (ref first, then persisted
        // resume state) so a retry never double-spends SOL on a second spawn.
        let processId = spawnedProcessId.current;
        if (!processId) {
          const pending = getPendingArNSPurchase();
          if (
            pending?.processId &&
            pending.intent === 'Buy-Name' &&
            pending.name === lowered &&
            pending.owner === owner
          ) {
            processId = pending.processId;
            spawnedProcessId.current = processId;
          }
        }

        if (!processId) {
          setProgress({ done: 0, total: 2, label: 'Creating your ANT' });
          const config = getCurrentConfig();
          const spawn = await spawnArNSAnt({
            signer: signer.getSolanaSigner(),
            name: lowered,
            rpcUrl: config.tokenMap.solana,
            antProgramId: config.antProgramId,
          });
          processId = spawn.processId;
          spawnedProcessId.current = processId;
          // Persist immediately — the SOL is already spent.
          savePendingArNSPurchase({
            processId,
            intent: 'Buy-Name',
            name: lowered,
            owner,
            savedAt: Date.now(),
          });
        }

        // ── Step 2/2 — buy the name from the auction ────────────────────────
        setProgress({ done: 1, total: 2, label: 'Buying from auction' });
        const ario = getWritableARIO(
          signer.getSolanaSigner(),
        ) as unknown as ARIOReturnedNameWriteable;

        const res = await ario.buyReturnedName({
          name: lowered,
          type,
          ...(type === 'lease' && years ? { years } : {}),
          processId,
          fundFrom,
          referrer: APP_NAME,
        });

        const settlement: BuyReturnedNameResult = {
          messageId: res?.id ?? '',
          processId: res?.result?.processId ?? processId,
        };
        setResult(settlement);
        setProgress({ done: 2, total: 2, label: '' });
        setPhase('success');
        // Purchase settled — clear resume state and refresh balances.
        clearPendingArNSPurchase();
        spawnedProcessId.current = undefined;
        window.dispatchEvent(new CustomEvent('refresh-balance'));
        return settlement;
      } catch (err) {
        if (isInsufficientCredits(err)) {
          setInsufficientCredits(true);
          setPhase('error');
          setError(err instanceof Error ? err : new Error(String(err)));
          return undefined;
        }
        // If the ANT was already spawned, tell the user so they retry (which
        // reuses the ANT) rather than fearing a lost deposit.
        const base = err instanceof Error ? err.message : String(err);
        const msg = spawnedProcessId.current
          ? `Your ANT was created, but the auction purchase didn't complete: ${base} — retry to finish (your ANT is reused, no extra SOL).`
          : base;
        const normalized = new Error(msg);
        setPhase('error');
        setError(normalized);
        throw normalized;
      }
    },
    [signer, getCurrentConfig],
  );

  return {
    buy,
    reset,
    phase,
    progress,
    result,
    error,
    insufficientCredits,
    isBusy: phase === 'submitting',
  };
}
