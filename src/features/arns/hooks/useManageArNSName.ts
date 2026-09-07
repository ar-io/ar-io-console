import { useCallback, useState } from 'react';

import { APP_NAME } from '../../../constants';
import { getWritableARIO } from '../../../utils';
import { ArNSSettlementResult } from '../services/TurboArNSClient';
import { lowerCaseDomain } from '../utils';
import { useArNSTurboSigner } from './useArNSTurboSigner';
import { useCustodyOwnerClient } from './useCustodyOwnerClient';
import { useTurboArNSClient } from './useTurboArNSClient';
import type {
  ArioFundFrom,
  SettlementMechanism,
} from '../purchase/settlementMechanism';

/** Lifecycle intents that operate on an already-owned name (no ANT spawn). */
export type ManageIntent =
  | 'Extend-Lease'
  | 'Upgrade-Name'
  | 'Increase-Undername-Limit';

export type ManagePhase = 'idle' | 'submitting' | 'success' | 'error';

export interface ManageArNSInput {
  name: string;
  intent: ManageIntent;
  /** Years to extend — required for Extend-Lease. */
  years?: number;
  /** Undername slots to add — required for Increase-Undername-Limit. */
  increaseQty?: number;
  /** Funding source for the ARIO price. Defaults to Turbo Credits. */
  mechanism: SettlementMechanism;
}

export interface UseManageArNSNameResult {
  manage: (input: ManageArNSInput) => Promise<ArNSSettlementResult | undefined>;
  reset: () => void;
  phase: ManagePhase;
  statusMessage: string;
  result: ArNSSettlementResult | undefined;
  error: Error | undefined;
  /** True when the failure was insufficient credits — the UI offers Top-Up. */
  insufficientCredits: boolean;
  isBusy: boolean;
}

/** Structural view of the ARIO writeable's lifecycle methods. */
type ARIOManageWriteable = {
  extendLease(p: {
    name: string;
    years: number;
    fundFrom?: ArioFundFrom;
    referrer?: string;
  }): Promise<{ id: string }>;
  upgradeRecord(p: {
    name: string;
    fundFrom?: ArioFundFrom;
    referrer?: string;
  }): Promise<{ id: string }>;
  increaseUndernameLimit(p: {
    name: string;
    increaseCount: number;
    fundFrom?: ArioFundFrom;
    referrer?: string;
  }): Promise<{ id: string }>;
};

const VERB: Record<ManageIntent, string> = {
  'Extend-Lease': 'Extending the lease for',
  'Upgrade-Name': 'Upgrading',
  'Increase-Undername-Limit': 'Adding undernames to',
};

export function isInsufficientCredits(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // `\b402\b` (not a bare `402`) so unrelated digit runs — tx-signature
  // fragments, program error codes, slot numbers — aren't misread as an
  // insufficient-funds / HTTP-402 signal and swallowed as a top-up prompt.
  return /insufficient|not enough|balance too low|underfunded|exceeds balance|\b402\b/i.test(
    msg,
  );
}

/**
 * Settle an ArNS **lifecycle** intent (extend lease, upgrade lease→permabuy,
 * increase undername limit) on an already-owned name, on the ARIO contract rail
 * with the chosen funding source (Turbo Credits or the wallet's ARIO).
 *
 * A sibling of {@link useBuyArNSName}: these intents act on an existing
 * registration, so there is no ANT to spawn — a single atomic contract write.
 * `fundFrom` selects where the ARIO price is drawn from; the SOL rent/fee is
 * paid by the signer regardless. Insufficient funds surface via the settle
 * error and route to Top-Up.
 */
export function useManageArNSName(): UseManageArNSNameResult {
  const signer = useArNSTurboSigner();
  const { getClient: getOwnerClient } = useCustodyOwnerClient();
  const client = useTurboArNSClient();

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
      mechanism,
    }: ManageArNSInput): Promise<ArNSSettlementResult | undefined> => {
      const lowered = lowerCaseDomain(name);
      setError(undefined);
      setInsufficientCredits(false);
      setResult(undefined);

      /*
        Only the ARIO route needs a Solana signer — it moves ARIO on-chain.

        Paying with credits does not: the service identifies the payer from the
        request signature (its middleware takes Arweave, Ethereum, Solana or
        ED25519) and debits that identity. Demanding Solana for both meant a
        custodial buyer — who is on that route precisely because they have no
        Solana wallet — could not renew or upgrade the name they own. On a
        lease, that is a name they eventually lose.
      */
      const owner = signer.address;
      if (
        mechanism.kind !== 'turbo-credits' &&
        (!signer.isReady || !owner || !signer.walletAdapter)
      ) {
        const e = new Error(
          'Connect a Solana wallet with a live signer to pay for this change.',
        );
        setPhase('error');
        setError(e);
        throw e;
      }

      try {
        setPhase('submitting');
        setStatusMessage(`${VERB[intent]} '${lowered}'…`);

        let res: { id: string };

        if (mechanism.kind === 'turbo-credits') {
          /*
            Credits are debited only by turbo-sdk. These three act on a name
            that already exists, so they mint nothing, carry no setup cost, and
            — unlike a Buy — need no signature from the owner at all. Turbo
            pays the Solana fee, so they complete with no wallet prompt.
          */
          if (!client) throw new Error('Payment service is unavailable.');
          const purchase = await client.purchaseWithCredits({
            // Signs as whoever is connected, so the credits debited are theirs.
            client: await getOwnerClient(),
            name: lowered,
            intent,
            years,
            increaseQty,
          });
          res = { id: purchase.messageId };
        } else {
          const ario = getWritableARIO(
            signer.getSolanaSigner(),
          ) as unknown as ARIOManageWriteable;
          // Narrowed: 'turbo-credits' returned above, and a fiat manage never
          // reaches this hook — it settles through the quote route.
          const fundFrom =
            mechanism.kind === 'ario-direct' ? mechanism.fundFrom : 'balance';

          switch (intent) {
          case 'Extend-Lease':
            res = await ario.extendLease({
              name: lowered,
              years: years ?? 1,
              fundFrom,
              referrer: APP_NAME,
            });
            break;
          case 'Upgrade-Name':
            res = await ario.upgradeRecord({
              name: lowered,
              fundFrom,
              referrer: APP_NAME,
            });
            break;
          case 'Increase-Undername-Limit':
            res = await ario.increaseUndernameLimit({
              name: lowered,
              increaseCount: increaseQty ?? 1,
              fundFrom,
              referrer: APP_NAME,
            });
              break;
          }
        }

        const settlement: ArNSSettlementResult = {
          nonce: '',
          messageId: res?.id ?? '',
          receipt: {},
        };
        setResult(settlement);
        setPhase('success');
        setStatusMessage(`Done — '${lowered}' updated!`);
        window.dispatchEvent(new CustomEvent('refresh-balance'));
        return settlement;
      } catch (err) {
        if (isInsufficientCredits(err)) {
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
    manage,
    reset,
    phase,
    statusMessage,
    result,
    error,
    insufficientCredits,
    isBusy: phase === 'submitting',
  };
}
