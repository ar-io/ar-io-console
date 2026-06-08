import React, { useState, useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useWallet } from '@solana/wallet-adapter-react';
import { usePrivy, useLogin, useWallets, useCreateWallet } from '@privy-io/react-auth';
import { useLocation, useNavigate } from 'react-router-dom';
import BaseModal from './BaseModal';
import BlockingMessageModal from './BlockingMessageModal';
import { useStore } from '../../store/useStore';
import { getTurboBalance, resolveEthereumAddress } from '../../utils';
import { clearEthereumTurboClientCache } from '../../hooks/useEthereumTurboClient';
import { Mail } from 'lucide-react';

const WalletSelectionModal = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const { address, walletType, setAddress } = useStore();
  const [connectingWallet, setConnectingWallet] = useState<string>();
  const [waitingForPrivyWallet, setWaitingForPrivyWallet] = useState(false);
  const [showSolanaWallets, setShowSolanaWallets] = useState(false);

  // Navigation hooks for post-connection redirect
  const location = useLocation();
  const navigate = useNavigate();

  // Handle post-connection: if on homepage, redirect to account page
  const handleConnectionSuccess = () => {
    if (location.pathname === '/') {
      navigate('/account');
    }
    onClose();
  };

  // Privy hooks for email login
  const { authenticated } = usePrivy();
  const { wallets: privyWallets } = useWallets();
  const { createWallet } = useCreateWallet();

  // Helper function to resolve and set Ethereum address
  const setEthereumAddress = async (rawAddress: string) => {
    try {
      // Resolve the correct address format (checksummed vs lowercase)
      const resolvedAddress = await resolveEthereumAddress(rawAddress, getTurboBalance);
      setAddress(resolvedAddress, 'ethereum');
    } catch (error) {
      console.error('[Wallet Connection] Error resolving Ethereum address:', error);
      // Fallback to using the raw address if resolution fails
      setAddress(rawAddress, 'ethereum');
    }
  };

  const { login } = useLogin({
    onComplete: async ({ user }) => {
      // Check if user already has a wallet in linkedAccounts
      const existingWallet = user?.linkedAccounts?.find(
        account => account.type === 'wallet'
      );

      if (existingWallet) {
        await setEthereumAddress(existingWallet.address);
        setConnectingWallet(undefined);
        handleConnectionSuccess();
      } else {
        // No wallet exists, need to create one
        setConnectingWallet('Creating your wallet...');

        try {
          // Create an embedded wallet for the user
          const newWallet = await createWallet();

          if (newWallet) {
            await setEthereumAddress(newWallet.address);
            setConnectingWallet(undefined);
            handleConnectionSuccess();
          } else {
            // If wallet creation didn't return immediately, wait for it
            setWaitingForPrivyWallet(true);
            setConnectingWallet('Setting up your wallet...');
          }
        } catch {
          setConnectingWallet(undefined);
          setWaitingForPrivyWallet(false);
        }
      }
    },
    onError: () => {
      setConnectingWallet(undefined);
      setWaitingForPrivyWallet(false);
    }
  });

  // Watch for Privy wallet to become available after login
  useEffect(() => {
    if (waitingForPrivyWallet && privyWallets && privyWallets.length > 0) {
      // Look for any embedded wallet, not just 'privy' type
      const privyWallet = privyWallets.find(w =>
        w.walletClientType === 'privy' ||
        w.walletClientType === 'embedded' ||
        w.imported === false // Non-imported wallets are embedded
      );

      if (privyWallet) {
        setEthereumAddress(privyWallet.address).then(() => {
          setConnectingWallet(undefined);
          setWaitingForPrivyWallet(false);
          handleConnectionSuccess();
        });
      } else {
        // If we have wallets but none match our criteria, use the first one
        const firstWallet = privyWallets[0];
        if (firstWallet) {
          setEthereumAddress(firstWallet.address).then(() => {
            setConnectingWallet(undefined);
            setWaitingForPrivyWallet(false);
            handleConnectionSuccess();
          });
        }
      }
    }
  }, [privyWallets, waitingForPrivyWallet, onClose]);

  // Check if user is already authenticated with Privy when modal opens
  useEffect(() => {
    // Only run this once when the modal first mounts and user is already authenticated
    // Add a check to prevent re-running if address is already set
    const { address: currentAddress } = useStore.getState();

    if (authenticated && privyWallets && privyWallets.length > 0 && !currentAddress) {
      const privyWallet = privyWallets.find(w => w.walletClientType === 'privy');

      if (privyWallet && privyWallet.address !== currentAddress) {
        setEthereumAddress(privyWallet.address).then(() => {
          handleConnectionSuccess();
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, privyWallets?.length]); // Only re-run if authentication state or wallet count changes

  // RainbowKit hooks for Ethereum wallets
  const { openConnectModal } = useConnectModal();
  const ethAccount = useAccount();
  const { disconnectAsync } = useDisconnect();

  // Track if we intentionally opened RainbowKit modal (to avoid auto-connecting on page load)
  const [intentionalEthConnect, setIntentionalEthConnect] = useState(false);

  // Use a ref to track if we've already handled the connection (prevents infinite loops)
  const hasHandledEthConnection = React.useRef(false);

  // Listen for RainbowKit/Wagmi Ethereum connection
  // When user connects via RainbowKit, wagmi state updates and we capture it here
  useEffect(() => {
    // Only process if: intentional connect, connected, have address, and haven't already handled it
    if (
      intentionalEthConnect &&
      ethAccount.isConnected &&
      ethAccount.address &&
      !hasHandledEthConnection.current
    ) {
      // Mark as handled FIRST to prevent re-entry
      hasHandledEthConnection.current = true;

      // Clear any cached Turbo clients since we have a new wallet
      clearEthereumTurboClientCache();

      // Resolve and set Ethereum address (handles checksummed vs lowercase)
      setEthereumAddress(ethAccount.address).then(() => {
        setIntentionalEthConnect(false);
        handleConnectionSuccess();
      }).catch((error) => {
        console.error('[Wallet Connection] Failed to set Ethereum address:', error);
        // Still close modal on error - address was set via fallback in setEthereumAddress
        setIntentionalEthConnect(false);
        handleConnectionSuccess();
      });
    }
  }, [ethAccount.isConnected, ethAccount.address, intentionalEthConnect, onClose]);

  // Reset the handled flag when the modal opens (component mounts)
  useEffect(() => {
    hasHandledEthConnection.current = false;
  }, []);

  // Solana wallet hooks - we call select() then connect() via useEffect,
  // because select() updates React state and the adapter isn't ready until
  // the next render. A setTimeout race doesn't reliably wait long enough.
  const { select: solanaSelect, connect: solanaConnect, wallet: solanaWallet, wallets: solanaWallets } = useWallet();
  const [pendingSolanaConnect, setPendingSolanaConnect] = useState(false);

  // Clean up switching flag if modal unmounts mid-connection
  useEffect(() => {
    return () => { (window as any).__SOLANA_SWITCHING__ = false; };
  }, []);

  // When Solana wallet connects, useWalletAccountListener sets the address.
  // We just watch for our store to reflect the Solana connection and close the modal.
  useEffect(() => {
    if (walletType === 'solana' && address) {
      setPendingSolanaConnect(false);
      setConnectingWallet(undefined);
      (window as any).__SOLANA_SWITCHING__ = false;
      handleConnectionSuccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletType, address]);

  // After select() changes the adapter, React re-renders and solanaWallet updates.
  // This effect fires when the adapter is ready, then calls connect().
  useEffect(() => {
    if (!pendingSolanaConnect || !solanaWallet) return;
    // Clear immediately so this effect doesn't re-fire on subsequent renders
    setPendingSolanaConnect(false);

    (async () => {
      try {
        await solanaConnect();
        // For wallets that auto-approve (Phantom with previously approved site),
        // connect() resolves silently. Check if we're now connected and handle it.
        // The wallet listener will also catch this, but we handle it here too
        // in case the listener hasn't fired yet.
        const pk = solanaWallet.adapter.publicKey;
        if (pk) {
          setAddress(pk.toString(), 'solana');
        }
      } catch (error) {
        console.error('[Solana] Connection failed:', error);
        setConnectingWallet(undefined);
        (window as any).__SOLANA_SWITCHING__ = false;
      }
    })();
  }, [pendingSolanaConnect, solanaWallet, solanaConnect, setAddress]);

  const connectSolanaWallet = (adapterName?: string) => {
    if (!adapterName) {
      window.open('https://phantom.app/', '_blank');
      return;
    }

    setConnectingWallet(`Connecting to ${adapterName}...`);
    // Signal to wallet listener to not clear state during the switch
    (window as any).__SOLANA_SWITCHING__ = true;
    solanaSelect(adapterName as any);
    // Don't call connect() here — wait for React to re-render with the new adapter.
    // The useEffect above will call connect() when solanaWallet is ready.
    setPendingSolanaConnect(true);
  };

  const connectWithEmail = async () => {
    // If already authenticated, just use the existing wallet
    if (authenticated && privyWallets && privyWallets.length > 0) {
      const privyWallet = privyWallets.find(w =>
        w.walletClientType === 'privy' ||
        w.walletClientType === 'embedded' ||
        !w.imported
      );

      if (privyWallet) {
        await setEthereumAddress(privyWallet.address);
        // Handle connection and navigate if needed
        setTimeout(() => handleConnectionSuccess(), 0);
        return;
      }
    }

    setConnectingWallet('Continue with email...');
    try {
      // Open Privy's built-in login modal
      login();
    } catch {
      setConnectingWallet(undefined);
    }
  };

  const connectWander = async () => {
    console.log('[WalletSelectionModal] connectWander called');
    console.log('[WalletSelectionModal] window.arweaveWallet exists:', !!window.arweaveWallet);
    if (window.arweaveWallet) {
      console.log('[WalletSelectionModal] arweaveWallet keys:', Object.keys(window.arweaveWallet));
    }
    setConnectingWallet('Connecting to Wander...');
    try {
      if (!window.arweaveWallet) {
        console.log('[WalletSelectionModal] No arweaveWallet found, opening wander.app');
        window.open('https://wander.app', '_blank');
        setConnectingWallet(undefined);
        return;
      }

      console.log('[WalletSelectionModal] Calling arweaveWallet.connect()...');
      await window.arweaveWallet.connect([
        'ACCESS_ADDRESS',
        'SIGN_TRANSACTION',
        'ACCESS_PUBLIC_KEY',
        'DISPATCH',
        'SIGNATURE', // Required for Turbo SDK file upload signing
      ]);
      console.log('[WalletSelectionModal] connect() succeeded, getting address...');

      const addr = await window.arweaveWallet.getActiveAddress();
      console.log('[WalletSelectionModal] Got address:', addr);
      // For Arweave, raw address = native address
      setAddress(addr, 'arweave');
      handleConnectionSuccess();
    } catch (error) {
      // Failed to connect Wander wallet
      console.error('[WalletSelectionModal] Wander connect error:', error);
    } finally {
      setConnectingWallet(undefined);
    }
  };

  const connectEthereumWallet = async () => {
    try {
      // If already connected via wagmi, disconnect first to allow wallet switching
      if (ethAccount.isConnected) {
        // Clear cached Turbo clients
        clearEthereumTurboClientCache();
        await disconnectAsync();
        // Small delay to allow disconnection to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Set the intentional connect flag so we capture the connection in useEffect
      setIntentionalEthConnect(true);

      // Open RainbowKit modal - this shows MetaMask, WalletConnect, Coinbase, and more
      if (openConnectModal) {
        openConnectModal();
      }
    } catch (error) {
      console.error('Failed to open wallet selection:', error);
      setIntentionalEthConnect(false);
    }
  };

  return (
    <BaseModal onClose={onClose} showCloseButton={true}>
      <div className="flex flex-col items-center justify-center text-foreground p-6 sm:p-8" style={{ minWidth: 'min(85vw, 480px)', maxWidth: '95vw' }}>
        {/* Header with logo and title */}
        <div className="mb-6 sm:mb-8 text-center">
          <img
            src="/brand/ario-full-black.svg"
            alt="ar.io"
            className="h-8 sm:h-10 mx-auto mb-4"
          />
          <h2 className="text-xl sm:text-2xl font-heading font-bold text-foreground">
            Sign in to your account
          </h2>
        </div>

        {showSolanaWallets ? (
          /* Solana wallet picker sub-view */
          <div className="flex w-full flex-col gap-3 sm:gap-4">
            <button
              className="flex items-center gap-2 text-sm text-foreground/60 hover:text-foreground transition-colors mb-1"
              onClick={() => setShowSolanaWallets(false)}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            {solanaWallets.filter(w => w.readyState === 'Installed' && !w.adapter.name.toLowerCase().includes('metamask')).map((w) => (
              <button
                key={w.adapter.name}
                className="w-full bg-card border border-border/20 p-3 sm:p-4 rounded-2xl hover:border-primary/50 hover:bg-card/80 transition-all text-left flex items-center gap-3 group"
                onClick={() => connectSolanaWallet(w.adapter.name)}
              >
                <img src={w.adapter.icon} alt={w.adapter.name} className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold mb-1 text-base">{w.adapter.name}</div>
                  <div className="text-xs sm:text-sm text-foreground/70">Solana wallet</div>
                </div>
              </button>
            ))}
            {solanaWallets.filter(w => w.readyState === 'Installed' && !w.adapter.name.toLowerCase().includes('metamask')).length === 0 && (
              <div className="text-center py-6 text-sm text-foreground/60">
                <p className="mb-3">No Solana wallets detected</p>
                <a href="https://phantom.app/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Install Phantom</a>
                {' or '}
                <a href="https://solflare.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Solflare</a>
              </div>
            )}
          </div>
        ) : (
          /* Main wallet selection view */
          <div className="flex w-full flex-col gap-3 sm:gap-4">
            {/* Email login option - prominently at the top */}
            <button
              className="w-full bg-card border border-border/20 p-3 sm:p-4 rounded-2xl hover:border-primary/50 hover:bg-card/80 transition-all text-left flex items-center gap-3 group"
              onClick={connectWithEmail}
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold mb-1 text-base">Email Sign-in</div>
                <div className="text-xs sm:text-sm text-foreground/70">No wallet needed</div>
              </div>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-border/20"></div>
              <div className="text-xs text-foreground/60">or connect a wallet</div>
              <div className="flex-1 h-px bg-border/20"></div>
            </div>

            <button
              className="w-full bg-card border border-border/20 p-3 sm:p-4 rounded-2xl hover:border-primary/50 hover:bg-card/80 transition-all text-left flex items-center gap-3 group"
              onClick={connectWander}
            >
              <img src="/wander-logo.png" alt="Wander" className="w-7 h-7 sm:w-8 sm:h-8 object-contain flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold mb-1 text-base">Wander</div>
                <div className="text-xs sm:text-sm text-foreground/70">Arweave wallet</div>
              </div>
            </button>

            <button
              className="w-full bg-card border border-border/20 p-3 sm:p-4 rounded-2xl hover:border-primary/50 hover:bg-card/80 transition-all text-left flex items-center gap-3 group"
              onClick={connectEthereumWallet}
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#627EEA] rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/>
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold mb-1 text-base">Ethereum Wallets</div>
                <div className="text-xs sm:text-sm text-foreground/70">MetaMask, WalletConnect, Coinbase</div>
              </div>
            </button>

            <button
              className="w-full bg-card border border-border/20 p-3 sm:p-4 rounded-2xl hover:border-primary/50 hover:bg-card/80 transition-all text-left flex items-center gap-3 group"
              onClick={() => setShowSolanaWallets(true)}
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#9945FF] rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4.52 16.57l2.47-2.59c.13-.14.32-.22.51-.22h14.28c.32 0 .48.39.25.62l-2.47 2.59c-.13.14-.32.22-.51.22H4.77c-.32 0-.48-.39-.25-.62z"/>
                  <path d="M4.52 4.22l2.5-2.59C7.15 1.49 7.34 1.41 7.53 1.41h14.28c.32 0 .48.39.25.62l-2.47 2.59c-.13.14-.32.22-.51.22H4.77c-.32 0-.48-.39-.25-.62z"/>
                  <path d="M19.48 10.35l-2.47-2.59c-.13-.14-.32-.22-.51-.22H2.22c-.32 0-.48.39-.25.62l2.47 2.59c.13.14.32.22.51.22h14.28c.32 0 .48-.39.25-.62z"/>
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold mb-1 text-base">Solana Wallets</div>
                <div className="text-xs sm:text-sm text-foreground/70">Phantom, Solflare, and more</div>
              </div>
            </button>
          </div>
        )}

        <div className="mt-6 sm:mt-8 text-center">
          <div className="text-xs text-foreground/80 px-2">
            By signing in, you agree to our{' '}
            <a
              href="https://ardrive.io/tos-and-privacy/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground transition-colors"
            >
              Terms and Conditions
            </a>
          </div>
        </div>

        {connectingWallet && (
          <BlockingMessageModal
            onClose={() => setConnectingWallet(undefined)}
            message={connectingWallet}
          />
        )}
      </div>
    </BaseModal>
  );
};

export default WalletSelectionModal;