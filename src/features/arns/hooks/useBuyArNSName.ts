import { useCallback, useState } from 'react';

import type { FundFrom } from '@ar.io/sdk/solana';

import { APP_NAME } from '../../../constants';
import { getWritableARIO } from '../../../utils';
import { ArNSSettlementResult } from '../services/TurboArNSClient';
import {
  buildBuyRecordArgs,
  routeBuyError,
  submittingMessage,
  toSettlement,
} from '../purchase/buyDecisions';
import type { SettlementMechanism } from '../purchase/settlementMechanism';
import { DEFAULT_ARNS_TARGET_TX } from '../purchase/buyDecisions';
import { spawnArNSAnt } from '../services/antSpawn';
import {
  clearPendingArNSPurchase,
  getPendingArNSPurchase,
  savePendingArNSPurchase,
} from '../services/arnsPurchaseResume';
import { useTurboArNSClient } from './useTurboArNSClient';
import { useStore } from '../../../store/useStore';
import { lowerCaseDomain } from '../utils';
import { useArNSTurboSigner } from './useArNSTurboSigner';
import type { ArNSRegistrationType } from './useArNSPrice';

export type BuyPhase = 'idle' | 'submitting' | 'success' | 'error';

/** Where the name's ARIO price is funded from. */
export type ArNSBuyFundFrom = FundFrom;

export interface BuyArNSNameInput {
  name: string;
  type: ArNSRegistrationType;
  /** Lease term in years (ignored for permabuy). */
  years?: number;
  /**
   * How this purchase settles. Replaces the old `fundFrom`, which offered a
   * `'turbo'` value that `@ar.io/sdk` accepts and ignores — every Solana write
   * treats it as `'balance'` and debits the wallet's ARIO, so "pay with
   * credits" silently charged the wrong asset.
   */
  mechanism: SettlementMechanism;
}

export interface UseBuyArNSNameResult {
  /** Record a purchase settled outside `buy()` (the card path). */
  markExternalSuccess: (settlement: ArNSSettlementResult) => void;
  buy: (input: BuyArNSNameInput) => Promise<ArNSSettlementResult | undefined>;
  reset: () => void;
  phase: BuyPhase;
  statusMessage: string;
  result: ArNSSettlementResult | undefined;
  error: Error | undefined;
  /** True when the failure was insufficient credits — the UI offers Top-Up. */
  insufficientCredits: boolean;
  isBusy: boolean;
}

/**
 * buyRecord rejects when the wallet lacks Turbo Credits. Unlike the old bundler
 * path there's no typed 402 here, so match the message defensively and route to
 * Top-Up. (Worth tightening once we see the real error shape from a live buy.)
 */
function isInsufficientCredits(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // `\b402\b` (not a bare `402`) so unrelated digit runs — tx-signature
  // fragments, program error codes, slot numbers — aren't misread as an
  // insufficient-funds / HTTP-402 signal and swallowed as a top-up prompt.
  return /insufficient|not enough|balance too low|underfunded|exceeds balance|\b402\b/i.test(
    msg,
  );
}

/**
 * Register an ArNS name with Turbo Credits — **atomically**.
 *
 * On @ar.io/sdk >= 4.1.0-alpha.5, `buyRecord` with no `processId` mints a fresh
 * user-owned ANT and assigns the name in the SAME transaction (one signature),
 * returning the new ANT id as `result.result.processId`. This replaces the prior
 * two-step Model-B flow (client `ANT.spawn` → bundler settle), which spent SOL
 * on the ANT *before* settling and could orphan it if settlement failed. With
 * atomic buyRecord there is no separate spawn and therefore no orphan window —
 * the ANT and the name succeed or fail together. Matches arns-react's
 * `dispatchArIOInteraction` buyRecord path. Solana + Turbo Credits.
 */
export function useBuyArNSName(): UseBuyArNSNameResult {
  const signer = useArNSTurboSigner();
  const client = useTurboArNSClient();
  const config = useStore((st) => st.getCurrentConfig());

  const [phase, setPhase] = useState<BuyPhase>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [result, setResult] = useState<ArNSSettlementResult | undefined>();
  const [error, setError] = useState<Error | undefined>();
  const [insufficientCredits, setInsufficientCredits] = useState(false);

  /**
   * Record a purchase that settled somewhere else.
   *
   * The card path is settled by the payment service, not by `buy()` — but it
   * produces the same thing (a name and an on-chain tx), and users deserve the
   * same receipt. Without this the modal closes and drops them back on the
   * configurator with no confirmation that anything happened.
   */
  const markExternalSuccess = useCallback(
    (settlement: ArNSSettlementResult) => {
      setError(undefined);
      setInsufficientCredits(false);
      setResult(settlement);
      setPhase('success');
      window.dispatchEvent(new CustomEvent('refresh-balance'));
    },
    [],
  );

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
      mechanism,
    }: BuyArNSNameInput): Promise<ArNSSettlementResult | undefined> => {
      const lowered = lowerCaseDomain(name);
      setError(undefined);
      setInsufficientCredits(false);
      setResult(undefined);

      const owner = signer.address;
      if (!signer.isReady || !owner || !signer.walletAdapter) {
        const e = new Error(
          'Connect a Solana wallet with a live signer to pay with Turbo Credits or ARIO.',
        );
        setPhase('error');
        setError(e);
        throw e;
      }

      try {
        setPhase('submitting');
        setStatusMessage(submittingMessage(lowered, type));

        let settlement: ArNSSettlementResult;

        if (mechanism.kind === 'ario-direct') {
          // Atomic: omit processId → buyRecord mints a fresh user-owned ANT and
          // assigns the name in ONE tx. No pre-spawn ⇒ no orphaned-ANT window.
          // SOL rent is always paid by the signer.
          const ario = getWritableARIO(signer.getSolanaSigner());
          const res = await ario.buyRecord(
            buildBuyRecordArgs({
              name: lowered,
              type,
              years,
              fundFrom: mechanism.fundFrom,
              referrer: APP_NAME,
            }),
          );
          settlement = toSettlement(res);
        } else {
          /*
            Credits are debited ONLY by turbo-sdk. Two steps, because turbo's
            buy provisions a Turbo-OWNED ANT when given no `processId` — right
            for a custodial card, wrong here, where the buyer owns the name.

            The spawned ANT is persisted the instant it exists: it costs real
            SOL, so a retry must reuse it rather than orphan one per attempt.
          */
          if (!client) throw new Error('Payment service is unavailable.');

          /*
            Reuse a previously-spawned ANT. A spawn costs real SOL, so a retry
            that spawns again bleeds funds and orphans the first one.
          */
          const pending = getPendingArNSPurchase();
          const reusable =
            pending?.name === lowered &&
            pending.owner === owner &&
            pending.processId
              ? pending.processId
              : undefined;

          let processId = reusable;
          if (!processId) {
            setStatusMessage(`Creating the ANT for ${lowered}…`);
            const spawned = await spawnArNSAnt({
              signer: signer.getSolanaSigner(),
              name: lowered,
              rpcUrl: config.tokenMap.solana,
              antProgramId: config.antProgramId,
              targetId: DEFAULT_ARNS_TARGET_TX,
            });
            processId = spawned.processId;
            // Persist the instant it exists, before anything else can fail.
            savePendingArNSPurchase({
              intent: 'Buy-Name',
              name: lowered,
              owner,
              processId,
              savedAt: Date.now(),
            });
          }

          setStatusMessage(submittingMessage(lowered, type));
          const res = await client.purchaseWithCredits({
            walletAdapter: signer.walletAdapter,
            name: lowered,
            intent: 'Buy-Name',
            type,
            years,
            processId,
          });
          settlement = {
            nonce: res.nonce ?? '',
            messageId: res.arioWriteResult?.id ?? '',
            receipt: { processId },
          };
          clearPendingArNSPurchase();
        }
        setResult(settlement);
        setPhase('success');
        // The name price was debited (credits or ARIO) — refresh the balance.
        window.dispatchEvent(new CustomEvent('refresh-balance'));
        return settlement;
      } catch (err) {
        // Only route to the Turbo-Credits Top-Up when paying WITH credits. On the
        // ARIO path (balance/stakes/any) an insufficient-funds error is an ARIO
        // shortfall, which buying Turbo Credits wouldn't resolve — surface it as
        // a normal error instead.
        if (
          routeBuyError({
            mechanism: mechanism.kind,
            isInsufficientCredits: isInsufficientCredits(err),
          }).kind === 'insufficient-credits'
        ) {
          setInsufficientCredits(true);
          setPhase('error');
          setError(err instanceof Error ? err : new Error(String(err)));
          return undefined;
        }
        const normalized = err instanceof Error ? err : new Error(String(err));
        setPhase('error');
        setError(normalized);
        throw normalized;
      }
    },
    [signer, client, config.antProgramId, config.tokenMap.solana],
  );

  return {
    buy,
    markExternalSuccess,
    reset,
    phase,
    statusMessage,
    result,
    error,
    insufficientCredits,
    isBusy: phase === 'submitting',
  };
}
