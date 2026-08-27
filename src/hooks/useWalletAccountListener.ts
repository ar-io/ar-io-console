import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { useAccount } from 'wagmi';
import { useWallet } from '@solana/wallet-adapter-react';
import { clearEthereumTurboClientCache } from './useEthereumTurboClient';
import { clearX402SignerCache } from './useX402Upload';
import { canRestoreSolanaSession } from '../utils/solanaSessionRestore';

/**
 * Hook that listens for wallet account changes across all supported wallet types
 * and updates the app state accordingly to prevent using the wrong account.
 *
 * This prevents issues like:
 * - Spending User B's credits while User A is logged in
 * - Uploading files with wrong account
 * - Setting ArNS records with wrong signer
 *
 * When an account switch is detected:
 * 1. Updates the address in the store
 * 2. Clears all payment-related state (prevents using wrong account's payment flows)
 * 3. Header component automatically refetches the balance due to address change
 */
export function useWalletAccountListener() {
  const { address, walletType, solanaWalletName, setAddress, clearAddress, clearAllPaymentState } = useStore();

  // Listen for Ethereum account changes (RainbowKit, MetaMask, Privy embedded wallet)
  const { address: ethAddress, isConnected: ethIsConnected, connector } = useAccount();

  // Track previous connector to detect wallet app switches
  const prevConnectorRef = useRef<string | null>(null);

  // Handle RainbowKit/Wagmi session restoration on page load
  // When user refreshes, wagmi auto-reconnects and we need to update our store
  // Only restore if store already has walletType === 'ethereum' — don't auto-connect
  // on fresh loads or after clearing a stale Solana session
  useEffect(() => {
    if (
      ethIsConnected &&
      ethAddress &&
      walletType === 'ethereum' &&
      ethAddress !== address
    ) {
      console.log('[Wallet Listener] Ethereum session restored/updated:', { from: address, to: ethAddress });

      if (address) {
        clearEthereumTurboClientCache();
        clearX402SignerCache();
      }

      setAddress(ethAddress, 'ethereum');
    }
  }, [ethIsConnected, ethAddress, address, walletType, setAddress]);

  // Update address if Ethereum account changes
  useEffect(() => {
    if (walletType === 'ethereum' && ethAddress && ethAddress !== address) {
      console.log('[Wallet Listener] Ethereum address changed:', { from: address, to: ethAddress });
      console.warn('[Wallet Listener] IMPORTANT: Wallet account has switched. Clearing payment state to prevent wrong account usage.');

      // Clear cached Turbo clients since we have a new wallet
      clearEthereumTurboClientCache();
      clearX402SignerCache();

      // Update to new address
      setAddress(ethAddress, 'ethereum');

      // Clear all payment state to prevent using wrong account's payment flows
      clearAllPaymentState();

      // Note: Balance will be automatically refetched by Header component's useEffect
    }
  }, [ethAddress, address, walletType, setAddress, clearAllPaymentState]);

  // Detect connector (wallet app) changes - important for clearing caches
  useEffect(() => {
    const currentConnectorId = connector?.uid || null;

    if (walletType === 'ethereum' && prevConnectorRef.current !== null && currentConnectorId !== prevConnectorRef.current) {
      console.log('[Wallet Listener] Ethereum connector changed:', { from: prevConnectorRef.current, to: currentConnectorId });
      // Clear cached Turbo clients when switching wallet apps
      clearEthereumTurboClientCache();
      clearX402SignerCache();
    }

    prevConnectorRef.current = currentConnectorId;
  }, [connector?.uid, walletType]);

  // Listen for Solana wallet changes
  // Use publicKey as source of truth — solanaConnected can be stale when
  // Standard Wallet adapters auto-approve (connect() returns early without
  // emitting 'connect' event, so WalletProviderBase never calls setConnected(true)).
  const { publicKey: solanaPublicKey, wallets: solanaWallets } = useWallet();

  // Track whether a Solana wallet has been active in this session.
  const solanaEverConnectedRef = useRef(false);
  if (solanaPublicKey) {
    solanaEverConnectedRef.current = true;
  }

  // Handle Solana connection: update store when publicKey appears.
  // Only update the primary session for Solana-primary users.
  // For linked wallets (Arweave/Ethereum primary), useLinkedSolanaWallet manages its own state.
  useEffect(() => {
    if (solanaPublicKey && walletType === 'solana') {
      const newAddress = solanaPublicKey.toString();
      if (newAddress !== address) {
        console.log('[Wallet Listener] Solana wallet connected (primary):', { from: address, to: newAddress });
        if (address) {
          clearAllPaymentState();
        }
        setAddress(newAddress, 'solana');
      }
    }
  }, [solanaPublicKey, address, walletType, setAddress, clearAllPaymentState]);

  // Handle Solana disconnection: clear store when publicKey disappears.
  // Only runs after a wallet has been active at least once in this session,
  // so it won't fire on page load when the store has a stale Solana session.
  // Skipped during wallet switching (select() disconnects old wallet before connecting new one).
  useEffect(() => {
    if (
      !solanaPublicKey &&
      walletType === 'solana' &&
      address &&
      solanaEverConnectedRef.current &&
      !(window as any).__SOLANA_SWITCHING__
    ) {
      console.log('[Wallet Listener] Solana wallet disconnected, clearing session');
      clearAllPaymentState();
      clearAddress();
    }
  }, [solanaPublicKey, walletType, address, clearAllPaymentState, clearAddress]);

  // Clear a stale Solana session on page load — but only one that cannot be
  // restored.
  //
  // With autoConnect=false the adapter never reconnects by itself, so a
  // persisted primary Solana session starts with no publicKey. This used to
  // sign the user out unconditionally, on every single reload. It now defers to
  // useLinkedSolanaWallet's auto-reconnect whenever that has something to work
  // with: a remembered adapter name that is actually installed.
  //
  // Sessions saved before `solanaWalletName` existed have no name to reconnect
  // with and are still cleared — one final sign-out, then it stops.
  //
  // If the reconnect is attempted and fails, the disconnect effect above owns
  // the cleanup (it is latched on solanaEverConnectedRef, so it only fires once
  // a wallet has genuinely been live).
  useEffect(() => {
    const { action } = canRestoreSolanaSession({
      walletType,
      address,
      solanaPublicKey: solanaPublicKey ? solanaPublicKey.toString() : null,
      solanaWalletName,
      // Exclude only definitively-absent adapters. Filtering to 'Installed'
      // alone would sign out users whose wallet is merely 'Loadable' — which
      // is the very bug this change fixes — while accepting every configured
      // wallet would defer forever for someone who uninstalled theirs.
      installedWalletNames: solanaWallets
        .filter((w) => w.readyState !== 'NotDetected')
        .map((w) => w.adapter.name),
    });
    if (action === 'none') return;
    if (action === 'defer-to-reconnect') {
      console.log('[Wallet Listener] Deferring to auto-reconnect for', solanaWalletName);
      return;
    }
    console.log('[Wallet Listener] Clearing unrestorable Solana session from previous page load');
    clearAddress();
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for ArConnect (Wander/ArConnect) wallet switches
  useEffect(() => {
    const handleWalletSwitch = async (event: Event) => {
      console.log('[Wallet Listener] ArConnect walletSwitch event triggered', event);

      // Only process if we're currently connected with an Arweave wallet
      if (walletType === 'arweave' && window.arweaveWallet) {
        try {
          const newAddress = await window.arweaveWallet.getActiveAddress();

          if (newAddress && newAddress !== address) {
            console.log('[Wallet Listener] ArConnect address changed:', { from: address, to: newAddress });
            console.warn('[Wallet Listener] IMPORTANT: Wallet account has switched. Clearing payment state to prevent wrong account usage.');

            // Update to new address
            setAddress(newAddress, 'arweave');

            // Clear all payment state to prevent using wrong account's payment flows
            clearAllPaymentState();

            // Note: Balance will be automatically refetched by Header component's useEffect
          }
        } catch (error) {
          console.error('[Wallet Listener] Error fetching new Arweave address:', error);
          // If we can't get the new address, clear the connection to be safe
          clearAddress();
        }
      }
    };

    // Add the event listener
    window.addEventListener('walletSwitch', handleWalletSwitch);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('walletSwitch', handleWalletSwitch);
    };
  }, [address, walletType, setAddress, clearAddress, clearAllPaymentState]);

  // Wagmi already handles Ethereum account changes through its internal listeners,
  // but we also manually listen to window.ethereum.on('accountsChanged') for additional coverage
  // This catches cases where wagmi might not detect the change (e.g., direct MetaMask interactions)
  useEffect(() => {
    if (walletType !== 'ethereum') return;

    const handleAccountsChanged = (accounts: string[]) => {
      console.log('[Wallet Listener] MetaMask accountsChanged event:', accounts);

      if (accounts.length === 0) {
        // User disconnected their wallet
        console.log('[Wallet Listener] User disconnected MetaMask');
        clearAddress();
      } else if (accounts[0] !== address) {
        // Account switched - but wagmi useAccount should have already handled this
        // This is a backup in case wagmi missed it
        console.log('[Wallet Listener] MetaMask backup listener detected account change:', { from: address, to: accounts[0] });
        console.warn('[Wallet Listener] IMPORTANT: Wallet account has switched. Clearing payment state to prevent wrong account usage.');

        // Clear cached Turbo clients since we have a new wallet
        clearEthereumTurboClientCache();
        clearX402SignerCache();

        // Update to new address
        setAddress(accounts[0], 'ethereum');

        // Clear all payment state to prevent using wrong account's payment flows
        clearAllPaymentState();

        // Note: Balance will be automatically refetched by Header component's useEffect
      }
    };

    // Check if ethereum provider exists
    if (window.ethereum?.on) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        if (window.ethereum?.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }
  }, [address, walletType, setAddress, clearAddress, clearAllPaymentState]);
}
