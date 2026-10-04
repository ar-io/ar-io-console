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
/*
  Shared by every instance of the hook, because several mount at once (App,
  the page, its cards). Per-instance state let each start its own connect in
  the same commit; the provider ignores all but the first, and the others read
  that as "cancelled" and released __SOLANA_SWITCHING__ mid-connect.
*/
let connectInFlightSince = 0;
// Expires, so an instance that unmounts between select and connect cannot
// block reconnects for the rest of the page load.
const CONNECT_IN_FLIGHT_MAX_MS = 60_000;
const connectInFlight = () =>
  connectInFlightSince > 0 && Date.now() - connectInFlightSince < CONNECT_IN_FLIGHT_MAX_MS;
/**
 * Addresses whose silent reconnect failed or was declined in this page load.
 * Every later-mounting instance would otherwise ask again, opening an unlock
 * window right after the user dismissed one. The Reconnect button still works.
 */
const declinedAutoReconnect = new Set<string>();

export function useLinkedSolanaWallet(
  {
    autoReconnect = 'all',
  }: {
    /**
     * Which remembered wallet this instance reconnects on mount.
     *
     * `primary-only` is for the app-wide instance (App.tsx): a primary Solana
     * session must be live on every page, since its wallet pays for top-ups
     * and uploads. A LINKED wallet is only used for ArNS writes, whose pages
     * mount this hook themselves; reconnecting it everywhere would open a
     * locked wallet's unlock window on pages that never use Solana.
     */
    /** `none` is for the reconnect modal, where the user picks the wallet. */
    autoReconnect?: 'all' | 'primary-only' | 'none';
  } = {},
) {
  const { walletType, address, solanaWalletName, linkedSolanaAddress, linkedSolanaWalletName, setAddress, setLinkedSolanaWallet, clearLinkedSolanaWallet, getArNSAddress } = useStore();
  const { publicKey: solanaPublicKey, signTransaction: solanaSignTransaction, select: solanaSelect, connect: solanaConnect, wallet: solanaWallet, wallets: solanaWallets, connecting: solanaConnecting } = useWallet();

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
   *  - `linkWallet()` — the user explicitly picked a wallet. When LINKING,
   *    whatever address it returns is the one they meant: expectation is null.
   *    When reconnecting a PRIMARY session it is the signed-in address, so this
   *    hook never writes a different account into the session itself. (If the
   *    wallet does connect another account, useWalletAccountListener switches
   *    the session and clears payment state, as for any in-wallet switch.)
   *  - auto-reconnect — the user chose nothing; we are silently restoring a
   *    previously linked wallet. If the adapter's ACTIVE ACCOUNT changed in the
   *    extension since then, connecting returns a different pubkey, and
   *    persisting it would silently repoint the user's whole ArNS identity:
   *    getArNSAddress() changes, "your names" changes, and writes would be
   *    signed by a wallet they never linked. So the expected address is pinned
   *    and a mismatch is refused rather than saved.
   */
  const expectedAddressRef = useRef<string | null>(null);
  // The address a silent reconnect is restoring; null for a user-chosen connect.
  const autoTargetRef = useRef<string | null>(null);

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
    // Another connect is under way. This effect re-runs when `connecting`
    // drops, and by then the wallet is live or the attempt is recorded.
    if (connectInFlight() || solanaConnecting) return;
    if (autoReconnect === 'none') return;
    if (autoReconnect === 'primary-only' && !isPrimarySolana) return;

    // Both identities reconnect the same way. A PRIMARY Solana session restores
    // `address`; a LINKED one restores the secondary ArNS wallet. Primary was
    // excluded here and got signed out on every reload instead — the identity
    // ArNS is actually built for had the worse experience of the two.
    const targetAddress = isPrimarySolana ? address : linkedSolanaAddress;
    const targetWalletName = isPrimarySolana
      ? solanaWalletName
      : linkedSolanaWalletName;
    if (!targetAddress || !targetWalletName) return; // nothing to reconnect
    if (declinedAutoReconnect.has(targetAddress)) return;
    // Connected a moment ago by another instance, before this render caught up.
    if (
      solanaWallet?.adapter.name === targetWalletName &&
      solanaWallet.adapter.publicKey?.toString() === targetAddress
    ) {
      return;
    }

    // Only attempt if the adapter is present. Same rule as the stale-session
    // check in useWalletAccountListener, deliberately: if one defers to a
    // reconnect the other must be willing to attempt it, or a session survives
    // the sign-out only to have nothing try to restore it.
    const adapterExists = solanaWallets.some(
      (w) => w.adapter.name === targetWalletName && w.readyState !== 'NotDetected',
    );
    if (!adapterExists) return;

    autoReconnectAttempted.current = true;
    connectInFlightSince = Date.now();
    autoTargetRef.current = targetAddress;
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
  }, [isPrimarySolana, address, solanaWalletName, linkedSolanaAddress, linkedSolanaWalletName, isSolanaConnected, solanaWallets, solanaSelect, solanaConnecting, autoReconnect, solanaWallet]);

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
        const autoTarget = autoTargetRef.current;
        if (autoTarget && (!pk || pk.toString() !== autoTarget)) {
          declinedAutoReconnect.add(autoTarget);
        }
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
            pendingIsPrimaryRef.current
              ? 'Your wallet connected a different account. Switch back to the account you signed in with, or sign out and sign in with the new one.'
              : 'Your wallet reconnected with a different account. Switch back to the linked account, or link the new one explicitly.',
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
        if (autoTargetRef.current) declinedAutoReconnect.add(autoTargetRef.current);
        setLinkError(error instanceof Error ? error.message : 'Failed to connect wallet. Please try again.');
      } finally {
        expectedAddressRef.current = null;
        autoTargetRef.current = null;
        connectInFlightSince = 0;
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
    /*
      Linking: an explicit choice, so whatever address the adapter returns is
      intended. Reconnecting a PRIMARY session is different: it restores the
      wallet as the session itself, not as a linked one (which would outlive
      sign-out and be inherited by the next Arweave or Ethereum session), and
      this hook writes only the same account. Writing another one here ran
      before useWalletAccountListener could clear payment state, so a top-up
      mid-checkout credited the old account; an account switch is left to
      that listener, which clears it.
    */
    expectedAddressRef.current = isPrimarySolana ? address : null;
    autoTargetRef.current = null;
    pendingIsPrimaryRef.current = isPrimarySolana;
    connectInFlightSince = Date.now();
    // Prevent useWalletAccountListener from treating the adapter switch as a disconnect
    (window as any).__SOLANA_SWITCHING__ = true;
    solanaSelect(adapterName as any);
    setPendingLink(true);
  }, [solanaSelect, isPrimarySolana, address]);

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
    /**
     * True while any connect is under way, including another instance's
     * silent reconnect. A second connect() started now is ignored by the
     * provider and would read as "cancelled".
     */
    isConnectBusy: isLinking || solanaConnecting || connectInFlight(),
    linkError,
    showLinkModal,
    setShowLinkModal,
    linkedWalletName: linkedSolanaWalletName,
    linkedAddress: linkedSolanaAddress,
  };
}
