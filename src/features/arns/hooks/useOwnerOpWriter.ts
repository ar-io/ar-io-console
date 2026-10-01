import { useCallback } from 'react';

import { useStore } from '../../../store/useStore';
import type { ArNSAction } from '@ardrive/turbo-sdk/web';

import { useArNSTurboSigner } from './useArNSTurboSigner';
import { useCustodyOwnerClient } from './useCustodyOwnerClient';
import { useAntSummaries } from './useAntLogos';
import { useArNSActionPrice } from './useArNSActionPrice';
import { useArNSPaymentBalances } from './useArNSPaymentBalances';
import { browserArNSOwnerSigner } from '../actions/browserOwnerSigner';
import { deriveAntRoleStrict } from '../antRole';
import { getWritableANT } from '../../../utils';
import { chooseOwnerActionWriter } from '../records/writerChoice';
import {
  antOwnerOpWriter,
  sponsoredOwnerOpWriter,
  type ANTOwnerOpWriteable,
  type OwnerOpWriter,
  type SponsoredOwnerOpClient,
} from '../records/ownerOps';

/**
 * The writer for transfer and controller changes, on whichever rail suits the
 * wallet.
 *
 * These ran self-signed only — `getWritableANT`, the owner paying SOL — while
 * the UI quoted a credits price for them. Turbo lists all three among its
 * actions and takes the same `ArNSOwnerSigner` as `setArNSRecord`, so the
 * records ladder applies unchanged: the wallet's own signature by default when
 * it holds SOL (a fraction of a cent, against a credits price of tens of cents),
 * credits when it does not, and a visible switch when both would work.
 *
 * Owner-only, unlike records. A controller can edit records but cannot transfer
 * a name or change who controls it, so an unresolved or non-owner role blocks
 * rather than falling through — a self-signed attempt would spend a wallet
 * prompt on a transaction the program rejects.
 */
export function useOwnerOpWriter(
  processId: string | undefined,
  action: ArNSAction,
) {
  const signer = useArNSTurboSigner();
  const { getClient } = useCustodyOwnerClient();
  const summaries = useAntSummaries(processId ? [processId] : []);

  const role = deriveAntRoleStrict(
    processId ? summaries.get(processId) : undefined,
    signer.address,
  );

  const { credits: priceCredits } = useArNSActionPrice(
    role === 'owner' ? action : undefined,
  );
  /*
    `credits` is the SESSION wallet's, which is what the sponsored rail bills;
    `sol` is the OWNER's, which is what pays if we fall back. On an Ethereum
    session those are two different wallets — see CLAUDE.md, PAYER vs OWNER.
  */
  const balances = useArNSPaymentBalances(signer.address ?? undefined);

  // The owner's choice of rail, shared across this page's editors.
  const preference = useStore((st) => st.arnsWriterPreference);
  const setPreference = useStore((st) => st.setArnsWriterPreference);

  const { kind, reason, alternative } = chooseOwnerActionWriter(
    role,
    {
      credits: balances.credits,
      priceCredits,
      sol: balances.sol,
      solLoading: balances.loading,
    },
    preference ?? undefined,
  );

  const getWriter = useCallback(
    async (antId?: string): Promise<OwnerOpWriter> => {
      const id = antId ?? processId;
      if (!id) throw new Error('This name has no ANT to act on yet.');
      if (!signer.isReady || !signer.walletAdapter || !signer.address) {
        throw new Error(
          'Connect the Solana wallet that owns this name to make this change.',
        );
      }
      if (kind === 'blocked') {
        // An owner is blocked only while their SOL balance is read.
        throw new Error(
          role === 'owner'
            ? 'Still checking your wallet balance. Try again in a moment.'
            : 'Only the owner of this name can make this change. If you just became the owner, give the index a moment to catch up.',
        );
      }

      if (kind === 'self-signed') {
        const ant = (await getWritableANT(
          id,
          signer.getSolanaSigner(),
        )) as unknown as ANTOwnerOpWriteable;
        return antOwnerOpWriter(ant);
      }

      const turbo = (await getClient()) as unknown as SponsoredOwnerOpClient;
      return sponsoredOwnerOpWriter(
        id,
        turbo,
        browserArNSOwnerSigner({
          address: signer.address,
          signTransaction: signer.walletAdapter.signTransaction,
          signMessage: signer.walletAdapter.signMessage,
        }),
      );
    },
    [getClient, signer, processId, kind, role],
  );

  return {
    getWriter,
    canWrite: signer.isReady && kind !== 'blocked',
    isResolving: kind === 'blocked' && (role === 'unknown' || role === 'owner'),
    /**
     * True when this wallet signs the Solana transaction and pays the network
     * itself — so the surface must not quote a credits price.
     */
    paysNetworkDirectly: kind === 'self-signed',
    writerReason: reason,
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
    /** The price of the sponsored rail, when that is the one being used. */
    priceCredits: kind === 'sponsored' ? priceCredits : undefined,
  };
}
