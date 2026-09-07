import { useCallback } from 'react';
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
 * records ladder applies unchanged: credits by default, because that price can
 * be quoted exactly and needs no SOL, and the wallet's own signature when
 * credits are short.
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

  const { kind, reason } = chooseOwnerActionWriter(role, {
    credits: balances.credits,
    priceCredits,
    sol: balances.sol,
  });

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
        throw new Error(
          'Only the owner of this name can make this change. If you just became the owner, give the index a moment to catch up.',
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
    [getClient, signer, processId, kind],
  );

  return {
    getWriter,
    canWrite: signer.isReady && kind !== 'blocked',
    isResolving: kind === 'blocked' && role === 'unknown',
    /**
     * True when this wallet signs the Solana transaction and pays the network
     * itself — so the surface must not quote a credits price.
     */
    paysNetworkDirectly: kind === 'self-signed',
    writerReason: reason,
    /** The price of the sponsored rail, when that is the one being used. */
    priceCredits: kind === 'sponsored' ? priceCredits : undefined,
  };
}
