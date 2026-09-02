import { useCallback } from 'react';

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
import { chooseWriter, writerCostNote } from '../records/writerChoice';
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

  const { kind, reason } = chooseWriter(role, {
    credits: balances.credits,
    priceCredits,
    sol: balances.sol,
  });

  const getWriter = useCallback(
    async (antId?: string): Promise<RecordWriter> => {
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
          'Still checking what this wallet can do with this name. Try again in a moment.',
        );
      }

      if (kind === 'self-signed') {
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
    [getClient, signer, processId, kind],
  );

  return {
    getWriter,
    /** True when a wallet is present and able to approve a write. */
    canWrite: signer.isReady && kind !== 'blocked',
    /** True while the role is still resolving — writes must wait, not guess. */
    isResolving: kind === 'blocked' && role === 'unknown',
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
  };
}
