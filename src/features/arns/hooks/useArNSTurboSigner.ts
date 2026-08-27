import { useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { VersionedTransaction } from '@solana/web3.js';

import { useLinkedSolanaWallet } from '../../../hooks/useLinkedSolanaWallet';
import { createWalletAdapterTransactionSendingSigner } from '../../../utils/arIOConfig';
import type { SolanaWalletAdapter } from '../services/TurboArNSClient';

/**
 * Resolve the Solana signing material the ArNS credit-buy flow needs, sourced
 * from console's own per-chain hooks — the deliberate replacement for
 * arns-react's `ArNSWalletConnector` façade.
 *
 * It produces the two things the Model B path requires:
 *  1. `walletAdapter` (`{ publicKey, signMessage, signTransaction }`) — fed to
 *     `TurboFactory.authenticated` to sign the credit-debited purchase request.
 *     Identical to the object `useFileUpload`/`ShareCreditsPanel` already build.
 *  2. `solanaSigner` (kit `SolanaSigner`) — fed to `ANT.spawn` to mint the
 *     user-owned ANT, built with console's `createWalletAdapterTransactionSendingSigner`.
 *
 * Works for a Solana-primary session and for an Arweave/ETH-primary session that
 * has linked a secondary Solana wallet (`useLinkedSolanaWallet`).
 */
export interface ArNSTurboSigner {
  /** ArNS/owner address (the connected or linked Solana pubkey). */
  address: string | null;
  /** True when a live signer is available for writes (spawn + purchase). */
  isReady: boolean;
  /** True when a non-Solana primary user must link a Solana wallet first. */
  needsLinking: boolean;
  /** True when the primary session identity is Solana. */
  isPrimarySolana: boolean;
  /** Adapter for the authenticated turbo client (undefined if no live signer). */
  walletAdapter: SolanaWalletAdapter | undefined;
  /** Build the kit signer for ANT.spawn (throws if no live signer). */
  getSolanaSigner: () => ReturnType<
    typeof createWalletAdapterTransactionSendingSigner
  >;
}

export function useArNSTurboSigner(): ArNSTurboSigner {
  const { publicKey, signMessage, signTransaction } = useWallet();
  const { arnsAddress, isSolanaConnected, needsLinking, isPrimarySolana } =
    useLinkedSolanaWallet();

  // A live signer requires the adapter to expose both signMessage (authed REST
  // request) and signTransaction (ANT spawn), and to be the wallet backing the
  // ArNS address (guards the linked-but-different-adapter case).
  const isReady =
    isSolanaConnected && !!publicKey && !!signMessage && !!signTransaction;

  const walletAdapter = useMemo<SolanaWalletAdapter | undefined>(() => {
    if (!isReady) return undefined;
    return {
      publicKey,
      signMessage: signMessage as (m: Uint8Array) => Promise<Uint8Array>,
      signTransaction,
    };
  }, [isReady, publicKey, signMessage, signTransaction]);

  const getSolanaSigner = () => {
    if (!isReady || !publicKey || !signTransaction) {
      throw new Error(
        'A connected Solana wallet with a live signer is required. Reconnect your Solana wallet and try again.',
      );
    }
    return createWalletAdapterTransactionSendingSigner(
      publicKey.toString(),
      undefined,
      undefined,
      signTransaction as unknown as (
        tx: VersionedTransaction,
      ) => Promise<VersionedTransaction>,
    );
  };

  return {
    address: arnsAddress,
    isReady,
    needsLinking,
    isPrimarySolana,
    walletAdapter,
    getSolanaSigner,
  };
}
