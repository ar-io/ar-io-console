import { useCallback } from 'react';

import { useStore } from '../../../store/useStore';

import { useArNSTurboSigner } from './useArNSTurboSigner';
import { useCustodyOwnerClient } from './useCustodyOwnerClient';
import { useAntSummaries } from './useAntLogos';
import { useArNSActionPrice } from './useArNSActionPrice';
import { browserArNSOwnerSigner } from '../actions/browserOwnerSigner';
import { deriveAntRoleStrict } from '../antRole';
import { getWritableANT } from '../../../utils';
import type { RecordWriter } from '../records/recordWriter';
import {
  antRecordWriter,
  type ANTRecordWriteable,
} from '../records/antWriter';
import {
  sponsoredRecordWriter,
  type SponsoredRecordClient,
} from '../records/sponsoredWriter';
import {
  chooseWriter,
  MIN_SOL_FOR_RECORD_WRITE,
  SELF_SIGNED_ONLY_NOTE,
  writerCostNote,
} from '../records/writerChoice';
import { useArNSPaymentBalances } from './useArNSPaymentBalances';

/**
 * The writer for a name's records, chosen by what this wallet is to the name.
 *
 * Turbo sponsors record writes for the OWNER only: `setArNSRecord` takes an
 * `ArNSOwnerSigner` and the service verifies that proof against the current
 * on-chain owner. A controller is still entitled to edit records — the program
 * allows it — but must sign and pay for it themselves.
 *
 * Two identities are involved on the sponsored path and they are frequently
 * different wallets: the PAYER (the session identity, whose Turbo client makes
 * the request) and the OWNER (the Solana wallet that holds the name and
 * approves the write). A record write DOES cost credits — the fee Turbo pays
 * on Solana, billed back — so the payer is settling, not merely identifying
 * itself. That is what makes running out of credits reroutable.
 */
export function useRecordWriter(processId: string | undefined) {
  const signer = useArNSTurboSigner();
  const { getClient } = useCustodyOwnerClient();
  const summaries = useAntSummaries(processId ? [processId] : []);

  const role = deriveAntRoleStrict(
    processId ? summaries.get(processId) : undefined,
    signer.address,
  );
  /*
    Priced whenever the wallet OWNS the name, not only when the sponsored route
    is chosen — the choice now depends on whether credits cover the price, so
    fetching only for the sponsored case would be circular. A controller still
    skips it: they pay SOL, and quoting credits would state a cost they never
    see.
  */
  const { credits: priceCredits } = useArNSActionPrice(
    role === 'owner' ? 'set-record' : undefined,
  );

  /*
    Balances decide the fallback. `credits` here is the SESSION wallet's, which
    is the one the sponsored route bills; `sol` is the owner's, which is the
    one that pays if we fall back to signing directly.
  */
  const balances = useArNSPaymentBalances(signer.address ?? undefined);

  // The owner's choice of rail: every editor follows it, for this wallet and session.
  const preference = useStore((st) => st.arnsWriterPreference);
  const setPreference = useStore((st) => st.setArnsWriterPreference);

  const { kind, reason, alternative } = chooseWriter(
    role,
    {
      credits: balances.credits,
      priceCredits,
      sol: balances.sol,
      solLoading: balances.loading,
    },
    preference ?? undefined,
  );

  /*
    Whether this wallet could sign a write itself right now: a controller
    always does, an owner when they hold enough SOL. Needed for the saves only
    the wallet can make (`requiresSelfSigned`: an IPFS target or a priority).
  */
  const canSelfSign =
    role === 'controller' ||
    (role === 'owner' &&
      balances.sol !== undefined &&
      balances.sol >= MIN_SOL_FOR_RECORD_WRITE);

  const getWriter = useCallback(
    async (
      antId?: string,
      opts?: {
        /**
         * This save can only be written by the wallet's own transaction, so
         * it never goes through Turbo whatever the default rail. Without the
         * SOL to sign it, it stops here, before anything is created or charged.
         */
        requireSelfSigned?: boolean;
      },
    ): Promise<RecordWriter> => {
      const id = antId ?? processId;
      if (!id) {
        throw new Error('This name has no record to edit yet.');
      }
      if (!signer.isReady || !signer.walletAdapter || !signer.address) {
        throw new Error(
          'Connect the Solana wallet that owns or controls this name to edit its records.',
        );
      }
      /*
        Never dispatch on an unresolved role. Guessing sponsored for a
        controller spends a wallet prompt on a request the service will reject;
        guessing self-signed for an owner asks them to pay a fee they do not
        owe.
      */
      if (kind === 'blocked') {
        throw new Error(
          role === 'owner'
            ? 'Still checking your wallet balance. Try again in a moment.'
            : 'Still checking what this wallet can do with this name. Try again in a moment.',
        );
      }
      if (opts?.requireSelfSigned && kind === 'sponsored' && !canSelfSign) {
        throw new Error(SELF_SIGNED_ONLY_NOTE);
      }

      if (kind === 'self-signed' || opts?.requireSelfSigned) {
        const ant = (await getWritableANT(
          id,
          signer.getSolanaSigner(),
        )) as unknown as ANTRecordWriteable;
        return antRecordWriter(ant);
      }

      const turbo = (await getClient()) as unknown as SponsoredRecordClient;
      return sponsoredRecordWriter(
        id,
        turbo,
        browserArNSOwnerSigner({
          address: signer.address,
          signTransaction: signer.walletAdapter.signTransaction,
          signMessage: signer.walletAdapter.signMessage,
        }),
      );
    },
    [getClient, signer, processId, kind, role, canSelfSign],
  );

  return {
    getWriter,
    /** True when a wallet is present and able to approve a write. */
    canWrite: signer.isReady && kind !== 'blocked',
    /** True while the role is still resolving — writes must wait, not guess. */
    isResolving: kind === 'blocked' && (role === 'unknown' || role === 'owner'),
    /** What this wallet's edits cost, for the note above the editor. */
    costNote: writerCostNote(kind, priceCredits, reason),
    /**
     * True whenever this wallet signs the Solana transaction itself and pays
     * the network fee — a controller always, and an owner who fell back for
     * want of credits. Either way a credits figure would name a cost they
     * never see.
     */
    paysNetworkDirectly: kind === 'self-signed',
    /** Why, so a surface can explain an unexpected route. */
    writerReason: reason,
    /** This wallet could sign a write itself (see `requiresSelfSigned`). */
    canSelfSign,
    /**
     * An owner whose SOL balance is still being read. Surfaces say they are
     * checking rather than quoting a rail that is about to change.
     */
    pending: kind === 'blocked' && role === 'owner',
    /**
     * The other rail, when it would also work, and a way to take it. The
     * surface offers it in one line ("Pay with credits instead"), so the
     * default is never the only option on screen.
     */
    alternative,
    switchRail: () =>
      setPreference(alternative === 'sponsored' ? 'credits' : 'sol'),
    /** The credits rail's price, for the switch's own label. */
    alternativeCredits: alternative === 'sponsored' ? priceCredits : undefined,
  };
}
