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
  /** Funding source for the ARIO price. Defaults to Turbo Credits. */
  fundFrom?: ArNSBuyFundFrom;
}

export interface UseBuyArNSNameResult {
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
      fundFrom = 'turbo',
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

        const ario = getWritableARIO(signer.getSolanaSigner());

        // Atomic: omit processId → buyRecord mints a fresh user-owned ANT and
        // assigns the name in ONE tx. No pre-spawn ⇒ no orphaned-ANT window.
        // `fundFrom` selects where the ARIO price is drawn from (credits vs the
        // wallet's ARIO balance/stakes); SOL rent is always paid by the signer.
        const res = await ario.buyRecord(
          buildBuyRecordArgs({
            name: lowered,
            type,
            years,
            fundFrom,
            referrer: APP_NAME,
          }) as Parameters<typeof ario.buyRecord>[0],
        );

        const settlement: ArNSSettlementResult = toSettlement(res);
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
            fundFrom,
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
    [signer],
  );

  return {
    buy,
    reset,
    phase,
    statusMessage,
    result,
    error,
    insufficientCredits,
    isBusy: phase === 'submitting',
  };
}
