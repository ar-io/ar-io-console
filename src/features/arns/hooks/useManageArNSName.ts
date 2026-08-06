import { useCallback, useState } from 'react';

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

/** Lifecycle intents that operate on an already-owned name (no ANT spawn). */
export type ManageIntent =
  | 'Extend-Lease'
  | 'Upgrade-Name'
  | 'Increase-Undername-Limit';

export type ManagePhase =
  | 'idle'
  | 'submitting'
  | 'confirming'
  | 'polling'
  | 'success'
  | 'error';

export interface ManageArNSInput {
  name: string;
  intent: ManageIntent;
  /** Years to extend — required for Extend-Lease. */
  years?: number;
  /** Undername slots to add — required for Increase-Undername-Limit. */
  increaseQty?: number;
}

export interface UseManageArNSNameResult {
  manage: (input: ManageArNSInput) => Promise<ArNSSettlementResult | undefined>;
  reset: () => void;
  phase: ManagePhase;
  statusMessage: string;
  result: ArNSSettlementResult | undefined;
  error: Error | undefined;
  /** True when the failure was a 402 — the UI should offer Top-Up. */
  insufficientCredits: boolean;
  isBusy: boolean;
}

const VERB: Record<ManageIntent, string> = {
  'Extend-Lease': 'Extending the lease for',
  'Upgrade-Name': 'Upgrading',
  'Increase-Undername-Limit': 'Adding undernames to',
};

/**
 * Settle an ArNS **lifecycle** intent (extend lease, upgrade lease→permabuy,
 * increase undername limit) on an already-owned name with Turbo Credits.
 *
 * A simpler sibling of {@link useBuyArNSName}: these intents operate on an
 * existing registration, so there is NO ANT to spawn and no `processId` — just
 * the credit settlement + poll. The money-safety invariant is preserved: the
 * purchase nonce is persisted the instant it exists and a matching in-flight
 * attempt resumes (a pure status read) instead of re-submitting, so a retry or
 * reload can never double-debit. A 402 surfaces as `insufficientCredits` so the
 * caller can route to Top-Up. Solana (credit) path only — same as buy.
 */
export function useManageArNSName(): UseManageArNSNameResult {
  const client = useTurboArNSClient();
  const signer = useArNSTurboSigner();

  const [phase, setPhase] = useState<ManagePhase>('idle');
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

  const manage = useCallback(
    async ({
      name,
      intent,
      years,
      increaseQty,
    }: ManageArNSInput): Promise<ArNSSettlementResult | undefined> => {
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

      // Resume a prior in-flight attempt for this exact name/owner/intent so a
      // retry never re-submits a paid nonce (a pure status read, no re-debit).
      const pending = getPendingArNSPurchase();
      const resumeNonce =
        pending &&
        pending.owner === owner &&
        lowerCaseDomain(pending.name) === lowered &&
        pending.intent === intent
          ? pending.nonce
          : undefined;

      try {
        const onStatus = (status: ArNSSettlementStatus) => {
          if (
            (status.phase === 'submitted' || status.phase === 'resumed') &&
            status.nonce
          ) {
            // Persist the nonce the instant it exists so a reload/retry resumes.
            savePendingArNSPurchase({
              nonce: status.nonce,
              intent,
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
              setStatusMessage(`${VERB[intent]} '${lowered}' on-chain…`);
              break;
            case 'polling':
              setPhase('polling');
              setStatusMessage(`Waiting for '${lowered}' to settle…`);
              break;
            case 'success':
              setPhase('success');
              setStatusMessage(`Done — '${lowered}' updated!`);
              break;
          }
        };

        const settlement = await client.executeArNSIntent({
          intent,
          name: lowered,
          years: intent === 'Extend-Lease' ? years : undefined,
          increaseQty:
            intent === 'Increase-Undername-Limit' ? increaseQty : undefined,
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
        if (err instanceof InsufficientCreditsError) {
          setInsufficientCredits(true);
          setPhase('error');
          setError(err);
          return undefined;
        }
        const normalized = err instanceof Error ? err : new Error(String(err));
        setPhase('error');
        setError(normalized);
        throw normalized;
      }
    },
    [client, signer],
  );

  return {
    manage,
    reset,
    phase,
    statusMessage,
    result,
    error,
    insufficientCredits,
    isBusy:
      phase === 'submitting' || phase === 'confirming' || phase === 'polling',
  };
}
