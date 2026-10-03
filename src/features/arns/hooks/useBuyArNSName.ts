import { useCallback, useEffect, useRef, useState } from 'react';

import type { FundFrom } from '@ar.io/sdk/solana';

import { APP_NAME } from '../../../constants';
import { getWritableARIO } from '../../../utils';
import { ArNSSettlementResult } from '../services/TurboArNSClient';
import {
  buildBuyRecordArgs,
  DEFAULT_ARNS_TARGET_TX,
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
import { useStore } from '../../../store/useStore';
import {
  RELEASED_MESSAGE,
  classifyActionFailure,
  clearHeldAttempt,
  explainInsufficient,
  heldMessage,
  heldStorage,
  heldUntilFrom,
  heldWincFrom,
  readHeldAttempt,
  settledByStatus,
  settlementFromStatus,
  writeHeldAttempt,
  type HeldAttempt,
} from '../purchase/actionFailure';

export type BuyPhase = 'idle' | 'submitting' | 'success' | 'error';

/**
 * What a failed credits purchase did with the buyer's credits, when that is
 * worth saying. See `purchase/actionFailure.ts`.
 */
export type BuyFailure =
  /** The signing window closed; the credits are already back. */
  | { kind: 'released' }
  /**
   * The attempt's credits are reserved until a refund around `heldUntil`.
   * `unconfirmed`: the service could not prove it expired (503 "Blockhash not
   * found"), so the purchase may still land and nothing is promised either way.
   */
  | { kind: 'held'; held: Pick<HeldAttempt, 'heldUntil' | 'untilKnown' | 'unconfirmed'> };

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
  /**
   * Arweave TX id for the name's `@` record, set at mint.
   *
   * Honoured on every payment route. The ARIO path passes it as `antState` to
   * `buyRecord`; the sponsored credits/card path passes the same thing to
   * turbo-sdk's `buyArNSName`, which folds it into the `ario_ant::initialize`
   * the buyer already signs (turbo-sdk >= 1.43.0-alpha.5, bundler #329). Either
   * way it costs no extra action, signature or debit.
   *
   * Blank or absent keeps `DEFAULT_ARNS_TARGET_TX`, so this changes nothing for
   * a buyer who skips the control. Already validated by `resolveBuyTarget`.
   */
  targetId?: string;
  /**
   * What this purchase costs in credits, for telling a real shortfall from
   * credits held by an earlier attempt. Absent, a 402 during a hold is put
   * down to the hold.
   */
  priceCredits?: number;
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
  /** What a failed credits purchase did with the credits, when known. */
  failure: BuyFailure | undefined;
  /**
   * The owner's wallet is showing the approval prompt right now. The
   * transaction it signs is only valid for under a minute, so this is when
   * the screen says "approve now", and only then.
   */
  awaitingApproval: boolean;
  /**
   * The name the current (or last) attempt was for. The receipt and status
   * read this, not the panel's selection, which can change underneath.
   */
  purchasedName: string | undefined;
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
 * user-owned ANT and assigns the name in the SAME transaction, returning the
 * new ANT id as `result.result.processId`. Usually that is one signature. A
 * long name can push the atomic transaction past Solana's size limit, and the
 * SDK then routes it through an ephemeral address lookup table, which costs
 * extra wallet approvals: names of 40+ characters already take that path for
 * everyone, and the gateway-operator discount adds one account (~33 bytes),
 * so with the discount names of about 29+ characters take it too. This replaces the prior
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
  const [failure, setFailure] = useState<BuyFailure | undefined>();
  const [purchasedName, setPurchasedName] = useState<string | undefined>();
  /** The payer whose credits a sponsored buy spends: the session identity. */
  const payer = useStore((s) => s.address) ?? undefined;
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  /*
    Each buy() gets an id; reset() and every new buy() move it on. A result
    arriving for an older id is dropped: it belongs to a name the screen is no
    longer showing, and its outcome is recoverable from My domains.
  */
  const attemptRef = useRef(0);
  /*
    True from the credits create until the signed transaction is submitted or
    fails. The approval is only valid for about a minute, and leaving mid-way
    strands the attempt with its credits held, so the tab warns before closing.
  */
  const [creditsPending, setCreditsPending] = useState(false);
  useEffect(() => {
    if (!creditsPending) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Browsers show their own wording; a non-empty value is what triggers it.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [creditsPending]);

  const reset = useCallback(() => {
    // Anything still in flight now reports to nobody.
    attemptRef.current += 1;
    setCreditsPending(false);
    setAwaitingApproval(false);
    setPhase('idle');
    setStatusMessage('');
    setResult(undefined);
    setError(undefined);
    setInsufficientCredits(false);
    setFailure(undefined);
    setPurchasedName(undefined);
  }, []);

  const buy = useCallback(
    async ({
      name,
      type,
      years,
      mechanism,
      targetId,
      priceCredits,
    }: BuyArNSNameInput): Promise<ArNSSettlementResult | undefined> => {
      const lowered = lowerCaseDomain(name);
      /*
        Resolved once, so the two settlement paths cannot disagree about where
        a name points. `buildBuyRecordArgs` applies the same fallback on the
        ARIO side; the credits side has no such helper, so it is applied here
        and both are handed the identical value.
      */
      const desiredTarget = targetId?.trim() || DEFAULT_ARNS_TARGET_TX;
      const attempt = ++attemptRef.current;
      const current = () => attempt === attemptRef.current;
      /** Set from `onNonce`: the action exists and its credits are reserved. */
      let nonce: string | undefined;
      setError(undefined);
      setInsufficientCredits(false);
      setFailure(undefined);
      setResult(undefined);
      setPurchasedName(lowered);

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
              // The resolved value, not the raw input. `buildBuyRecordArgs`
              // applies the same fallback itself, so passing `targetId` here
              // worked — but it meant the two paths derived the target
              // separately and would diverge the moment either fallback moved.
              targetId: desiredTarget,
              // An operations wallet's gateway, when the quote honoured it.
              discountGatewayAddress: mechanism.discountGatewayAddress,
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
          const walletAdapter = signer.walletAdapter;

          setCreditsPending(true);
          settlement = await client.purchaseWithCredits({
            /*
              Same target as the ARIO path above, so a name points at the same
              place whichever way it was paid for. Only the mechanism differs:
              there it rides `buyRecord`'s `antState`, here turbo-sdk's.
            */
            antState: { transactionId: desiredTarget, targetProtocol: 0 },
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
              /*
                Wrapped so the screen knows when the prompt is actually open:
                "approve now" is true only between these two points, and a
                label saying it at any other time is noise.
              */
              signTransaction: async (tx) => {
                if (current()) setAwaitingApproval(true);
                try {
                  return await walletAdapter.signTransaction(tx);
                } finally {
                  if (current()) setAwaitingApproval(false);
                }
              },
              signMessage: walletAdapter.signMessage,
            }),
            /*
              Persist before the wallet opens. Credits are reserved when the
              action is created, so an abandoned approval has already been
              charged; the nonce is the only way back to it. Turbo refunds an
              unsigned action on expiry, but polling beats waiting.
            */
            onNonce: (created) => {
              nonce = created;
              savePendingArNSPurchase({
                intent: 'Buy-Name',
                name: lowered,
                owner,
                nonce: created,
                savedAt: Date.now(),
              });
            },
          });
          clearPendingArNSPurchase();
          // A purchase went through, so nothing this payer tried before is
          // still standing in its way. Only THIS payer's: a hold recorded for
          // another wallet in this browser is still that wallet's.
          const stored = readHeldAttempt(heldStorage(), Date.now());
          if (stored && stored.payer === payer) clearHeldAttempt(heldStorage());
          if (current()) setCreditsPending(false);
        }
        // The name price was debited (credits or ARIO), whatever the screen is
        // showing now, so the balance refreshes before the staleness check.
        window.dispatchEvent(new CustomEvent('refresh-balance'));
        // And the name is theirs: "your names" reads fresh and waits for it.
        useStore.getState().invalidateOwnedArNSNames({ address: owner, name: lowered });
        // Superseded (reset, or another buy started): the screen has moved on.
        if (!current()) return undefined;
        setResult(settlement);
        setPhase('success');
        return settlement;
      } catch (err) {
        // A stale attempt must not clear a newer attempt's pending flag.
        if (!current()) return undefined;
        if (mechanism.kind === 'turbo-credits') setCreditsPending(false);
        setAwaitingApproval(false);

        /*
          The signing window. Only the credits path has one: the service
          reserves credits at create, and the transaction it hands back is
          valid for about a minute. How it failed decides what the buyer is
          told about those credits; see purchase/actionFailure.ts.
        */
        if (mechanism.kind === 'turbo-credits') {
          const kind = classifyActionFailure(err, { nonceCreated: !!nonce, nonce });
          if (kind === 'expired-released') {
            clearPendingArNSPurchase();
            const e = new Error(RELEASED_MESSAGE);
            setFailure({ kind: 'released' });
            setPhase('error');
            setError(e);
            throw e;
          }
          /*
            Any failure after the action exists may have left its credits
            reserved, so the hold is recorded for all of them: that is what a
            later 402 is checked against. Only the expiries change the copy;
            an ordinary failure keeps the message it always had.
          */
          const recordHold = async (
            unconfirmed: boolean,
          ): Promise<
            | { held: Pick<HeldAttempt, 'heldUntil' | 'untilKnown' | 'heldWinc' | 'unconfirmed'> }
            | { settled: 'released' | 'completed'; status: Record<string, unknown> | undefined }
            | undefined
          > => {
            if (!nonce) return undefined;
            // When the refund lands, and how much: the action's own status.
            const status = await client?.getActionStatus(nonce).catch(() => undefined);
            /*
              The status can settle it outright: `expired` means the credits
              are already back, `completed` that it went through after all.
              Neither leaves anything held, so nothing is recorded.
            */
            const settled = settledByStatus(status?.status);
            if (settled) return { settled, status };
            const held = {
              ...heldUntilFrom(status?.expiresAt, Date.now()),
              ...(heldWincFrom(status?.wincQty) !== undefined
                ? { heldWinc: heldWincFrom(status?.wincQty) }
                : {}),
              // 503 "Blockhash not found" is not proof of expiry: it may land.
              ...(unconfirmed ? { unconfirmed: true } : {}),
            };
            if (payer) {
              writeHeldAttempt(heldStorage(), { nonce, payer, name: lowered, ...held });
            }
            // The reservation is in the balance now; let the store catch up.
            window.dispatchEvent(new CustomEvent('refresh-balance'));
            return { held };
          };

          if ((kind === 'expired-held' || kind === 'unconfirmed') && nonce) {
            const outcome = await recordHold(kind === 'unconfirmed');
            if (!current()) return undefined;
            /*
              Completed after all: the /sign response was lost, or the failure
              came after a successful submit. With the messageId to prove it,
              that is a purchase, so it gets the receipt, not an apology.
            */
            const landed =
              outcome && 'settled' in outcome && outcome.settled === 'completed'
                ? settlementFromStatus(outcome.status, nonce)
                : undefined;
            if (landed) {
              clearPendingArNSPurchase();
              useStore
                .getState()
                .invalidateOwnedArNSNames({ address: owner, name: lowered });
              const stored = readHeldAttempt(heldStorage(), Date.now());
              if (stored && stored.payer === payer) clearHeldAttempt(heldStorage());
              window.dispatchEvent(new CustomEvent('refresh-balance'));
              if (!current()) return undefined;
              setFailure(undefined);
              setError(undefined);
              setResult(landed);
              setPhase('success');
              return landed;
            }
            if (outcome && 'settled' in outcome && outcome.settled === 'released') {
              clearPendingArNSPurchase();
              const e = new Error(RELEASED_MESSAGE);
              setFailure({ kind: 'released' });
              setPhase('error');
              setError(e);
              throw e;
            }
            const held =
              outcome && 'held' in outcome
                ? outcome.held
                : {
                    // Completed without a messageId to show, or unreadable:
                    // nothing is claimed either way, and the buyer is sent to
                    // check their names.
                    ...heldUntilFrom(undefined, Date.now()),
                    unconfirmed: true,
                  };
            /*
              Unconfirmed tells the buyer to check My domains, so that list
              must read fresh. No expectation is recorded: this is not proof
              the name was bought.
            */
            if (held.unconfirmed) useStore.getState().invalidateOwnedArNSNames();
            const e = new Error(heldMessage(held));
            setFailure({ kind: 'held', held });
            setPhase('error');
            setError(e);
            throw e;
          }
          if (kind === 'insufficient') {
            /*
              A 402 while an earlier attempt's credits are still held is the
              hold, not an empty balance. Sending that buyer to buy more
              credits would charge them for money they already have.
            */
            const held = readHeldAttempt(heldStorage(), Date.now());
            if (
              held &&
              explainInsufficient({
                held,
                payer,
                now: Date.now(),
                // Live, not the render's value: a top-up may have landed
                // since this buy() was created.
                creditBalance: useStore.getState().creditBalance,
                priceCredits,
              }) === 'held'
            ) {
              const e = new Error(heldMessage(held));
              setFailure({ kind: 'held', held });
              setPhase('error');
              setError(e);
              throw e;
            }
          }
          if (kind === 'other' && nonce) {
            // Recorded in the background: this failure's copy does not depend
            // on it, so the buyer is not kept waiting for a status read.
            void recordHold(false);
          }
        }

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
    [signer, client, getOwnerClient, payer],
  );

  return {
    buy,
    reset,
    phase,
    statusMessage,
    result,
    error,
    insufficientCredits,
    failure,
    purchasedName,
    awaitingApproval,
    isBusy: phase === 'submitting',
  };
}
