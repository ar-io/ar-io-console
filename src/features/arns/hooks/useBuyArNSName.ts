import { useCallback, useState } from 'react';

import { useStore } from '../../../store/useStore';
import { spawnArNSAnt } from '../services/antSpawn';
import {
  ArNSSettlementResult,
  ArNSSettlementStatus,
  InsufficientCreditsError,
} from '../services/TurboArNSClient';
import {
  clearPendingArNSPurchase,
  getPendingArNSPurchase,
  savePendingArNSPurchase,
} from '../services/arnsPurchaseResume';
import { lowerCaseDomain } from '../utils';
import { useTurboArNSClient } from './useTurboArNSClient';
import { useArNSTurboSigner } from './useArNSTurboSigner';
import type { ArNSRegistrationType } from './useArNSPrice';

export type BuyPhase =
  | 'idle'
  | 'spawning'
  | 'submitting'
  | 'confirming'
  | 'polling'
  | 'success'
  | 'error';

export interface BuyArNSNameInput {
  name: string;
  type: ArNSRegistrationType;
  /** Lease term in years (ignored for permabuy). */
  years?: number;
  /** Optional Arweave TX id the new name should point at. */
  targetId?: string;
}

export interface UseBuyArNSNameResult {
  buy: (input: BuyArNSNameInput) => Promise<ArNSSettlementResult | undefined>;
  reset: () => void;
  phase: BuyPhase;
  statusMessage: string;
  result: ArNSSettlementResult | undefined;
  error: Error | undefined;
  /** True when the failure was a 402 — the UI should offer Top-Up. */
  insufficientCredits: boolean;
  isBusy: boolean;
}

/**
 * Settle an ArNS **Buy-Name** with Turbo Credits for a Solana (Model B) buyer.
 *
 * Rewrite of arns-react's `dispatchArNSPurchaseWithCredits` onto console
 * primitives: no `TransactionReducer`/`ArNSWalletConnector` — just local phase
 * state, console's `useArNSTurboSigner`, and the `refresh-balance` event. The
 * money-safety invariants are preserved 1:1:
 *   - The client-spawned ANT (real SOL) is persisted BEFORE submitting and
 *     REUSED on retry — never spawned twice for one purchase.
 *   - The purchase nonce is persisted the instant it exists so a reload resumes
 *     polling instead of re-submitting (no double debit).
 *   - A 402 surfaces as `insufficientCredits` so the caller can route to Top-Up.
 */
export function useBuyArNSName(): UseBuyArNSNameResult {
  const client = useTurboArNSClient();
  const signer = useArNSTurboSigner();
  const getCurrentConfig = useStore((s) => s.getCurrentConfig);

  const [phase, setPhase] = useState<BuyPhase>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [result, setResult] = useState<ArNSSettlementResult | undefined>();
  const [error, setError] = useState<Error | undefined>();
  const [insufficientCredits, setInsufficientCredits] = useState(false);

  const reset = useCallback(() => {
    setPhase('idle');
    setStatusMessage('');
    setResult(undefined);
    setError(undefined);
    setInsufficientCredits(false);
  }, []);

  const buy = useCallback(
    async ({
      name,
      type,
      years,
      targetId,
    }: BuyArNSNameInput): Promise<ArNSSettlementResult | undefined> => {
      const lowered = lowerCaseDomain(name);
      setError(undefined);
      setInsufficientCredits(false);
      setResult(undefined);

      const owner = signer.address;
      if (!signer.isReady || !owner || !signer.walletAdapter) {
        const e = new Error(
          'Connect a Solana wallet with a live signer to pay with Turbo Credits.',
        );
        setPhase('error');
        setError(e);
        throw e;
      }

      // Reuse a prior in-flight attempt for this exact name/owner/intent so a
      // retry never re-spawns an ANT or re-submits a paid nonce.
      const pending = getPendingArNSPurchase();
      const matched =
        pending &&
        pending.owner === owner &&
        lowerCaseDomain(pending.name) === lowered &&
        pending.intent === 'Buy-Name'
          ? pending
          : undefined;

      // processId (the ANT) is real SOL — prefer any already spawned for this
      // purchase and only mint a new one when none exists yet.
      let processId: string | undefined = matched?.processId;
      const resumeNonce = matched?.nonce;

      try {
        // 1) Spawn the user-owned ANT (Model B), unless resuming or already spawned.
        if (!resumeNonce && !processId) {
          setPhase('spawning');
          setStatusMessage(`Creating your ANT for '${lowered}'…`);
          const config = getCurrentConfig();
          const { processId: spawned } = await spawnArNSAnt({
            signer: signer.getSolanaSigner(),
            name: lowered,
            rpcUrl: config.tokenMap.solana,
            antProgramId: config.antProgramId,
            targetId,
          });
          processId = spawned;
          // Persist the spawned ANT BEFORE submitting so a failure/reload reuses it.
          savePendingArNSPurchase({
            processId,
            intent: 'Buy-Name',
            name: lowered,
            owner,
            savedAt: Date.now(),
          });
        }

        // 2) Settle the purchase (debit credits + write the record) and poll.
        const onStatus = (status: ArNSSettlementStatus) => {
          if (
            (status.phase === 'submitted' || status.phase === 'resumed') &&
            status.nonce
          ) {
            savePendingArNSPurchase({
              nonce: status.nonce,
              processId,
              intent: 'Buy-Name',
              name: lowered,
              owner,
              savedAt: Date.now(),
            });
          }
          switch (status.phase) {
            case 'submitting':
              setPhase('submitting');
              setStatusMessage(`Paying with Turbo Credits for '${lowered}'…`);
              break;
            case 'submitted':
            case 'resumed':
              setPhase('confirming');
              setStatusMessage(`Confirming '${lowered}' on-chain…`);
              break;
            case 'polling':
              setPhase('polling');
              setStatusMessage(`Waiting for '${lowered}' to settle…`);
              break;
            case 'success':
              setPhase('success');
              setStatusMessage(`Registered '${lowered}'!`);
              break;
          }
        };

        const settlement = await client.executeArNSIntent({
          intent: 'Buy-Name',
          name: lowered,
          type,
          years: type === 'lease' ? years : undefined,
          processId,
          tokenType: 'solana',
          walletAdapter: signer.walletAdapter,
          resumeNonce,
          onStatus,
        });

        clearPendingArNSPurchase();
        setResult(settlement);
        setPhase('success');
        // Credits were debited server-side — refresh the header balance.
        window.dispatchEvent(new CustomEvent('refresh-balance'));
        return settlement;
      } catch (err) {
        // Keep the spawned ANT persisted (drop any nonce) so a retry reuses it.
        if (processId) {
          savePendingArNSPurchase({
            processId,
            intent: 'Buy-Name',
            name: lowered,
            owner,
            savedAt: Date.now(),
          });
        }

        if (err instanceof InsufficientCreditsError) {
          setInsufficientCredits(true);
          setPhase('error');
          setError(err);
          return undefined;
        }

        const normalized =
          processId && err instanceof Error
            ? new Error(
                `Your ANT for '${lowered}' was created, but the purchase didn't complete. ` +
                  'Your credits were not charged. Retrying reuses the same ANT (no extra SOL). ' +
                  `(${err.message})`,
              )
            : err instanceof Error
              ? err
              : new Error(String(err));
        setPhase('error');
        setError(normalized);
        throw normalized;
      }
    },
    [client, signer, getCurrentConfig],
  );

  return {
    buy,
    reset,
    phase,
    statusMessage,
    result,
    error,
    insufficientCredits,
    isBusy:
      phase === 'spawning' ||
      phase === 'submitting' ||
      phase === 'confirming' ||
      phase === 'polling',
  };
}
