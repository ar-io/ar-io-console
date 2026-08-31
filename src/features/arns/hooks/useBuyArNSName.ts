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
import {
  clearPendingArNSPurchase,
  savePendingArNSPurchase,
} from '../services/arnsPurchaseResume';
import { browserArNSOwnerSigner } from '../actions/browserOwnerSigner';
import { useTurboArNSClient } from './useTurboArNSClient';
import { lowerCaseDomain } from '../utils';
import { useArNSTurboSigner } from './useArNSTurboSigner';
import { useCustodyOwnerClient } from './useCustodyOwnerClient';
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
  const { getClient: getOwnerClient } = useCustodyOwnerClient();
  const client = useTurboArNSClient();

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
            Credits are debited only by turbo-sdk, and the purchase is
            gas-sponsored: Turbo pays the Solana rent and fees, so the buyer
            needs no SOL at all. The name is minted straight to their wallet —
            Turbo never holds it, so there is nothing to claim afterwards.

            The client-side ANT spawn this branch used to do is gone with it.
            It cost the buyer ~0.02 SOL, had to be persisted and reused so a
            retry did not orphan one, and existed only because turbo's old buy
            would otherwise have kept the ANT itself.
          */
          if (!client) throw new Error('Payment service is unavailable.');
          if (!signer.walletAdapter || !owner) {
            throw new Error(
              'Connect the Solana wallet that will own this name.',
            );
          }

          settlement = await client.purchaseWithCredits({
            /*
              Signed by the SESSION identity, whose credits these are.

              Authenticating with the linked Solana adapter debited that
              address instead — so an Arweave or Ethereum user saw their own
              balance on the checkout, chose Balance, and the purchase spent an
              address holding nothing. The balance shown and the balance spent
              have to be the same one.
            */
            client: await getOwnerClient(),
            name: lowered,
            intent: 'Buy-Name',
            type,
            years,
            /*
              The wallet that RECEIVES the name, which is routinely not the
              payer. An Arweave or email session paying for a name owned by
              their linked or embedded Solana wallet is the intended shape.
            */
            owner: browserArNSOwnerSigner({
              address: owner,
              signTransaction: signer.walletAdapter.signTransaction,
              signMessage: signer.walletAdapter.signMessage,
            }),
            /*
              Persist before the wallet opens. Credits are reserved when the
              action is created, so an abandoned approval has already been
              charged; the nonce is the only way back to it. Turbo refunds an
              unsigned action on expiry, but polling beats waiting.
            */
            onNonce: (nonce) =>
              savePendingArNSPurchase({
                intent: 'Buy-Name',
                name: lowered,
                owner,
                nonce,
                savedAt: Date.now(),
              }),
          });
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
    [signer, client, getOwnerClient],
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
