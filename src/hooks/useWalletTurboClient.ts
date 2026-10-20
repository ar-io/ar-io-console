import { useCallback } from 'react';
import {
  TurboFactory,
  TurboAuthenticatedClient,
  ArconnectSigner
} from '@ardrive/turbo-sdk/web';
import { useWallet } from '@solana/wallet-adapter-react';
import { useStore } from '../store/useStore';
import { useTurboConfig } from './useTurboConfig';
import { useEthereumTurboClient } from './useEthereumTurboClient';

/**
 * An authenticated Turbo client for the session wallet, for actions that sign
 * as that wallet without paying in a token (sharing and revoking credits).
 * Ethereum goes through the shared, cached client so the user signs once per
 * session.
 */
export function useWalletTurboClient() {
  const { address, walletType } = useStore();
  const turboConfig = useTurboConfig();
  const { createEthereumTurboClient } = useEthereumTurboClient();
  const { publicKey: solanaPublicKey, signMessage: solanaSignMessage, signTransaction: solanaSignTransaction } = useWallet();

  return useCallback(async (): Promise<TurboAuthenticatedClient> => {
    if (!address || !walletType) {
      throw new Error('Wallet not connected');
    }

    switch (walletType) {
      case 'arweave': {
        if (!window.arweaveWallet) {
          throw new Error('Wander wallet extension not found. Please install from https://wander.app');
        }
        const signer = new ArconnectSigner(window.arweaveWallet);
        return TurboFactory.authenticated({
          ...turboConfig,
          signer
        });
      }

      case 'ethereum':
        return createEthereumTurboClient('ethereum');

      case 'solana':
        if (!solanaPublicKey || !solanaSignMessage) {
          throw new Error('Solana wallet not connected. Please reconnect your Solana wallet.');
        }
        return TurboFactory.authenticated({
          token: 'solana',
          walletAdapter: { publicKey: solanaPublicKey, signMessage: solanaSignMessage, signTransaction: solanaSignTransaction! },
          ...turboConfig,
        });

      default:
        throw new Error(`Unsupported wallet type: ${walletType}`);
    }
  }, [address, walletType, turboConfig, createEthereumTurboClient, solanaPublicKey, solanaSignMessage, solanaSignTransaction]);
}
