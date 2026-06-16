import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useStore } from '../store/useStore';

/**
 * Hook for managing a linked Solana wallet for ArNS operations.
 *
 * Solana-primary users: returns their primary wallet state directly.
 * Arweave/Ethereum users: manages a secondary Solana wallet for ArNS
 * without changing the primary session identity.
 *
 * Read-only ArNS lookups work with just the persisted address.
 * Write operations (assign/update domain) require a live signer
 * (wallet must be reconnected if session was refreshed).
 */
export function useLinkedSolanaWallet() {
  const { walletType, linkedSolanaAddress, linkedSolanaWalletName, setLinkedSolanaWallet, clearLinkedSolanaWallet, getArNSAddress } = useStore();
  const { publicKey: solanaPublicKey, signTransaction: solanaSignTransaction, select: solanaSelect, connect: solanaConnect, wallet: solanaWallet, wallets: solanaWallets } = useWallet();

  const [isLinking, setIsLinking] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [pendingLink, setPendingLink] = useState(false);

  const isPrimarySolana = walletType === 'solana';
  const arnsAddress = getArNSAddress();
  const hasArNSAccess = arnsAddress !== null;
  const needsLinking = !isPrimarySolana && !linkedSolanaAddress;

  // For primary Solana users, the adapter is always the signer.
  // For linked wallets, the adapter is the signer only if its publicKey matches the linked address.
  const isSolanaConnected = isPrimarySolana
    ? !!solanaPublicKey
    : !!solanaPublicKey && !!linkedSolanaAddress && solanaPublicKey.toString() === linkedSolanaAddress;

  // After select() + connect(), watch for the adapter to connect and save the linked address
  useEffect(() => {
    if (!pendingLink || !solanaWallet) return;
    setPendingLink(false);

    (async () => {
      try {
        await solanaConnect();
        const pk = solanaWallet.adapter.publicKey;
        if (pk) {
          setLinkedSolanaWallet(pk.toString(), solanaWallet.adapter.name);
          setIsLinking(false);
          setShowLinkModal(false);
        }
      } catch (error) {
        console.error('[LinkedSolana] Connection failed:', error);
        setIsLinking(false);
      }
    })();
  }, [pendingLink, solanaWallet, solanaConnect, setLinkedSolanaWallet]);

  // If adapter connects and matches the linked address, sync (handles silent auto-approve)
  useEffect(() => {
    if (
      !isPrimarySolana &&
      solanaPublicKey &&
      linkedSolanaAddress &&
      solanaPublicKey.toString() === linkedSolanaAddress
    ) {
      // Signer is available — no action needed, isSolanaConnected will be true
    } else if (
      !isPrimarySolana &&
      solanaPublicKey &&
      isLinking
    ) {
      // New connection during linking flow — save it
      setLinkedSolanaWallet(solanaPublicKey.toString(), solanaWallet?.adapter.name || 'Solana');
      setIsLinking(false);
      setShowLinkModal(false);
    }
  }, [solanaPublicKey, linkedSolanaAddress, isPrimarySolana, isLinking, solanaWallet, setLinkedSolanaWallet]);

  const linkWallet = useCallback((adapterName: string) => {
    setIsLinking(true);
    solanaSelect(adapterName as any);
    setPendingLink(true);
  }, [solanaSelect]);

  const unlinkWallet = useCallback(() => {
    clearLinkedSolanaWallet();
  }, [clearLinkedSolanaWallet]);

  const promptReconnect = useCallback(() => {
    setShowLinkModal(true);
  }, []);

  return {
    // ArNS address for lookups (linked or primary Solana)
    arnsAddress,
    // Whether user can see ArNS features (has any Solana address)
    hasArNSAccess,
    // Whether Solana wallet has a live signer for write operations
    isSolanaConnected,
    // Whether user needs to link a Solana wallet (non-Solana primary, no linked address)
    needsLinking,
    // Whether primary wallet is Solana (no linking needed)
    isPrimarySolana,
    // Wallet adapter signing capabilities (null if not connected)
    solanaPublicKey,
    solanaSignTransaction,
    // Available Solana wallets for the picker
    solanaWallets,
    // Actions
    linkWallet,
    unlinkWallet,
    promptReconnect,
    // UI state
    isLinking,
    showLinkModal,
    setShowLinkModal,
    linkedWalletName: linkedSolanaWalletName,
    linkedAddress: linkedSolanaAddress,
  };
}
