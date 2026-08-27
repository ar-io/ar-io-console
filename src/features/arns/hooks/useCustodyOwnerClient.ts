import { useCallback } from 'react';
import { TurboFactory, ArconnectSigner } from '@ardrive/turbo-sdk/web';
import type { TurboAuthenticatedClient } from '@ardrive/turbo-sdk/web';
import { useWallet } from '@solana/wallet-adapter-react';

import { useStore } from '../../../store/useStore';
import { useTurboConfig } from '../../../hooks/useTurboConfig';
import { useEthereumTurboClient } from '../../../hooks/useEthereumTurboClient';

/**
 * An authenticated Turbo client that signs as the name's OWNER.
 *
 * Turbo's custody routes (`transfer`, `set-record`, `remove-record`) do not
 * take an owner parameter — they derive it from the request's signature, whose
 * type is carried per request in `x-signature-type` and defaults to Arweave.
 * The owner is whichever identity BOUGHT the name.
 *
 * That identity is frequently not a Solana wallet. Custody exists precisely for
 * buyers who have none, so signing these requests as Solana unconditionally
 * proved the wrong identity: either no signature was possible at all, or one
 * was made by a linked wallet that never owned the name. Either way the request
 * cannot match, and the owner is locked out of the name they paid for.
 *
 * Mirrors the wallet switch in `usePaymentHistory`, which solved the same
 * problem for a read path. That one predates this and still carries its own
 * copy; worth collapsing when someone is next in both.
 */
export function useCustodyOwnerClient() {
  const address = useStore((s) => s.address);
  const walletType = useStore((s) => s.walletType);
  const { createEthereumTurboClient } = useEthereumTurboClient();
  const {
    publicKey,
    signMessage,
    signTransaction,
  } = useWallet();

  // One call with a computed argument — the hook cannot be called
  // conditionally, and `walletType` is stable across a render.
  const turboConfig = useTurboConfig(
    walletType === 'solana'
      ? 'solana'
      : walletType === 'ethereum'
        ? 'ethereum'
        : 'arweave',
  );

  const getClient = useCallback(async (): Promise<TurboAuthenticatedClient> => {
    if (!address || !walletType) {
      throw new Error('Connect your wallet to manage this name.');
    }

    switch (walletType) {
      case 'arweave':
        if (!window.arweaveWallet) {
          throw new Error('Wander wallet extension not found.');
        }
        return TurboFactory.authenticated({
          ...turboConfig,
          signer: new ArconnectSigner(window.arweaveWallet),
        });

      case 'ethereum':
        // Reuses the console's cached Ethereum signer, so the user signs the
        // connect message once per session rather than once per action.
        return createEthereumTurboClient('ethereum');

      case 'solana':
        if (!publicKey || !signMessage || !signTransaction) {
          throw new Error(
            'Solana wallet not connected. Please reconnect and try again.',
          );
        }
        return TurboFactory.authenticated({
          token: 'solana',
          walletAdapter: { publicKey, signMessage, signTransaction },
          ...turboConfig,
        });

      default:
        throw new Error(`Unsupported wallet type: ${walletType}`);
    }
  }, [
    address,
    walletType,
    turboConfig,
    createEthereumTurboClient,
    publicKey,
    signMessage,
    signTransaction,
  ]);

  return { getClient, ownerAddress: address, walletType };
}
