import { useState, useEffect, useCallback, useRef } from 'react';
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
 * Write operations (assign/update domain) require a live signer.
 * On page load, if a linked wallet name is persisted the hook
 * auto-reconnects it so the signer is ready without manual intervention.
 */
export function useLinkedSolanaWallet() {
  const { walletType, address, solanaWalletName, linkedSolanaAddress, linkedSolanaWalletName, setAddress, setLinkedSolanaWallet, clearLinkedSolanaWallet, getArNSAddress } = useStore();
  const { publicKey: solanaPublicKey, signTransaction: solanaSignTransaction, select: solanaSelect, connect: solanaConnect, wallet: solanaWallet, wallets: solanaWallets } = useWallet();

  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [pendingLink, setPendingLink] = useState(false);
  /**
   * Whether the pending connect belongs to the PRIMARY session rather than a
   * linked one. Both share the connect effect below, but they persist their
   * result to different places — a primary reconnect must restore `address`,
   * not create a linked-wallet record.
   */
  const pendingIsPrimaryRef = useRef(false);
  /**
   * Address the pending connection is REQUIRED to produce, or null when any
   * address is acceptable.
   *
   * The connect effect below serves two callers with different consent:
   *  - `linkWallet()` — the user explicitly picked a wallet, so whatever address
   *    it returns is the one they meant. Expectation is null.
   *  - auto-reconnect — the user chose nothing; we are silently restoring a
   *    previously linked wallet. If the adapter's ACTIVE ACCOUNT changed in the
   *    extension since then, connecting returns a different pubkey, and
   *    persisting it would silently repoint the user's whole ArNS identity:
   *    getArNSAddress() changes, "your names" changes, and writes would be
   *    signed by a wallet they never linked. So the expected address is pinned
   *    and a mismatch is refused rather than saved.
   */
  const expectedAddressRef = useRef<string | null>(null);

  const isPrimarySolana = walletType === 'solana';
  const arnsAddress = getArNSAddress();
  const hasArNSAccess = arnsAddress !== null;
  const needsLinking = !isPrimarySolana && !linkedSolanaAddress;

  // For primary Solana users, the adapter is always the signer.
  // For linked wallets, the adapter is the signer only if its publicKey matches the linked address.
  const isSolanaConnected = isPrimarySolana
    ? !!solanaPublicKey
    : !!solanaPublicKey && !!linkedSolanaAddress && solanaPublicKey.toString() === linkedSolanaAddress;

  // Auto-reconnect linked Solana wallet on page load.
  // With autoConnect=false on the WalletProvider, the adapter never reconnects
  // on its own. If we have a persisted linkedSolanaWalletName, select + connect
  // it so the signer is seamlessly ready without manual reconnection.
  const autoReconnectAttempted = useRef(false);
  useEffect(() => {
    if (autoReconnectAttempted.current) return;
    if (isSolanaConnected) return;           // already live

    // Both identities reconnect the same way. A PRIMARY Solana session restores
    // `address`; a LINKED one restores the secondary ArNS wallet. Primary was
    // excluded here and got signed out on every reload instead — the identity
    // ArNS is actually built for had the worse experience of the two.
    const targetAddress = isPrimarySolana ? address : linkedSolanaAddress;
    const targetWalletName = isPrimarySolana
      ? solanaWalletName
      : linkedSolanaWalletName;
    if (!targetAddress || !targetWalletName) return; // nothing to reconnect

    // Only attempt if the adapter is present. Same rule as the stale-session
    // check in useWalletAccountListener, deliberately: if one defers to a
    // reconnect the other must be willing to attempt it, or a session survives
    // the sign-out only to have nothing try to restore it.
    const adapterExists = solanaWallets.some(
      (w) => w.adapter.name === targetWalletName && w.readyState !== 'NotDetected',
    );
    if (!adapterExists) return;

    autoReconnectAttempted.current = true;
    console.log('[LinkedSolana] Auto-reconnecting Solana wallet:', targetWalletName, {
      primary: isPrimarySolana,
    });
    (window as any).__SOLANA_SWITCHING__ = true;
    // Silent path: only the already-known address is acceptable.
    expectedAddressRef.current = targetAddress;
    solanaSelect(targetWalletName as any);
    // BOTH identities need this latch: `select()` only chooses an adapter, it
    // does not connect. The effect below is what calls `connect()`, and without
    // it a primary session would select a wallet, never connect, and sit with a
    // persisted address and no signer.
    pendingIsPrimaryRef.current = isPrimarySolana;
    setPendingLink(true);
  }, [isPrimarySolana, address, solanaWalletName, linkedSolanaAddress, linkedSolanaWalletName, isSolanaConnected, solanaWallets, solanaSelect]);

  // After select(), wait for the adapter to be ready, then connect and save
  useEffect(() => {
    if (!pendingLink || !solanaWallet) return;
    setPendingLink(false);

    (async () => {
      try {
        setLinkError(null);
        await solanaConnect();
        // Check adapter publicKey directly (handles silent auto-approve)
        const pk = solanaWallet.adapter.publicKey;
        const expected = expectedAddressRef.current;
        if (!pk) {
          setLinkError('Connection was cancelled or wallet returned no address. Please try again.');
        } else if (expected && pk.toString() !== expected) {
          // Auto-reconnect returned a DIFFERENT account than the one linked.
          // Keep the persisted link untouched and make the user choose, rather
          // than silently swapping their ArNS identity underneath them.
          console.warn(
            '[LinkedSolana] Auto-reconnect returned a different account; keeping the linked wallet.',
          );
          setLinkError(
            'Your wallet reconnected with a different account. Switch back to the linked account, or link the new one explicitly.',
          );
        } else if (pendingIsPrimaryRef.current) {
          // Primary session: restore the wallet's own address. Writing a linked
          // record here would invent a secondary ArNS wallet for a user who
          // never linked one.
          setAddress(pk.toString(), 'solana', solanaWallet.adapter.name);
        } else {
          setLinkedSolanaWallet(pk.toString(), solanaWallet.adapter.name);
        }
      } catch (error) {
        console.error('[LinkedSolana] Connection failed:', error);
        setLinkError(error instanceof Error ? error.message : 'Failed to connect wallet. Please try again.');
      } finally {
        expectedAddressRef.current = null;
        pendingIsPrimaryRef.current = false;
        setIsLinking(false);
        // Always released, including on failure — leaving this set would make
        // useWalletAccountListener ignore a genuine later disconnect.
        (window as any).__SOLANA_SWITCHING__ = false;
      }
    })();
  }, [pendingLink, solanaWallet, solanaConnect, setLinkedSolanaWallet, setAddress]);

  const linkWallet = useCallback((adapterName: string) => {
    setIsLinking(true);
    setLinkError(null);
    // Explicit user choice — whatever address this adapter returns is intended.
    expectedAddressRef.current = null;
    // Prevent useWalletAccountListener from treating the adapter switch as a disconnect
    (window as any).__SOLANA_SWITCHING__ = true;
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
    linkError,
    showLinkModal,
    setShowLinkModal,
    linkedWalletName: linkedSolanaWalletName,
    linkedAddress: linkedSolanaAddress,
  };
}
