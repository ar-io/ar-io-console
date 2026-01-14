/**
 * Hot Wallet Hook
 *
 * Manages the lifecycle of a temporary Ethereum hot wallet for the "Try It Out" feature.
 * The wallet is generated client-side, encrypted, and stored in localStorage.
 *
 * Features:
 * - Generate new random wallet using ethers.js
 * - Restore existing wallet from encrypted localStorage
 * - Create InjectedEthereumSigner for Turbo SDK compatibility
 * - Export seed phrase for user backup
 * - Track seed export status
 * - Explicit disconnect to clear wallet data
 */

import { useState, useCallback, useRef } from 'react';
import { Wallet, HDNodeWallet } from 'ethers';
import { InjectedEthereumSigner } from '@ar.io/sdk/web';
import { TurboFactory, TurboAuthenticatedClient } from '@ardrive/turbo-sdk/web';
import { useStore } from '../store/useStore';
import {
  encryptAndStoreMnemonic,
  decryptMnemonic,
  getStoredHotWallet,
  markSeedExported,
  clearHotWallet,
} from '../utils/hotWalletCrypto';

// Module-level cache for the hot wallet instance and signer
// HDNodeWallet is returned by Wallet.createRandom() and Wallet.fromPhrase()
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let hotWalletInstance: HDNodeWallet | null = null;
let hotWalletSigner: InjectedEthereumSigner | null = null;

export function useHotWallet() {
  const {
    address,
    setAddress,
    clearAddress,
    clearAllPaymentState,
    getCurrentConfig,
    isHotWallet,
    setIsHotWallet,
    hotWalletSeedExported,
    setHotWalletSeedExported,
  } = useStore();

  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initPromiseRef = useRef<Promise<string | null> | null>(null);

  /**
   * Check if hot wallet exists in session storage
   */
  const hasStoredHotWallet = useCallback(() => {
    return getStoredHotWallet() !== null;
  }, []);

  /**
   * Create the InjectedEthereumSigner adapter for a wallet
   */
  const createSignerAdapter = useCallback(async (wallet: HDNodeWallet | Wallet): Promise<InjectedEthereumSigner> => {
    const userAddress = wallet.address;

    // Create provider adapter that InjectedEthereumSigner expects
    const injectedProvider = {
      getSigner: () => ({
        signMessage: async (message: string | Uint8Array | { raw?: string }) => {
          // Handle different message types
          if (typeof message === 'string') {
            return await wallet.signMessage(message);
          } else if (message instanceof Uint8Array) {
            return await wallet.signMessage(message);
          }
          // Object with raw property
          const msg = message.raw || '';
          return await wallet.signMessage(msg);
        },
        getAddress: async () => userAddress,
      }),
    };

    const signer = new InjectedEthereumSigner(injectedProvider as any);

    // Set the public key by signing a message and recovering
    // This is required by InjectedEthereumSigner
    const { ethers } = await import('ethers');
    const connectMessage = 'Sign this message to connect your hot wallet to Turbo Gateway';
    const signature = await wallet.signMessage(connectMessage);
    const messageHash = ethers.hashMessage(connectMessage);
    const recoveredKey = ethers.SigningKey.recoverPublicKey(messageHash, signature);
    signer.publicKey = Buffer.from(ethers.getBytes(recoveredKey));

    return signer;
  }, []);

  /**
   * Generate a new hot wallet
   */
  const generateHotWallet = useCallback(async (): Promise<string> => {
    setIsInitializing(true);
    setError(null);

    try {
      // Generate wallet with cryptographically secure randomness
      const wallet = Wallet.createRandom();

      if (!wallet.mnemonic) {
        throw new Error('Failed to generate mnemonic');
      }

      // Store encrypted in sessionStorage
      await encryptAndStoreMnemonic(wallet.mnemonic.phrase, wallet.address);

      // Cache in memory
      hotWalletInstance = wallet;
      hotWalletSigner = await createSignerAdapter(wallet);

      // Update store
      setAddress(wallet.address, 'ethereum');
      setIsHotWallet(true);
      setHotWalletSeedExported(false);

      return wallet.address;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate wallet';
      setError(msg);
      throw err;
    } finally {
      setIsInitializing(false);
    }
  }, [setAddress, setIsHotWallet, setHotWalletSeedExported, createSignerAdapter]);

  /**
   * Restore existing hot wallet from session storage
   */
  const restoreHotWallet = useCallback(async (): Promise<string | null> => {
    const stored = getStoredHotWallet();
    if (!stored) return null;

    setIsInitializing(true);
    setError(null);

    try {
      const mnemonic = await decryptMnemonic();
      if (!mnemonic) {
        throw new Error('Failed to decrypt wallet');
      }

      const wallet = Wallet.fromPhrase(mnemonic);

      // Verify address matches stored address
      if (wallet.address.toLowerCase() !== stored.address.toLowerCase()) {
        throw new Error('Wallet address mismatch');
      }

      // Cache in memory
      hotWalletInstance = wallet;
      hotWalletSigner = await createSignerAdapter(wallet);

      // Update store
      setAddress(wallet.address, 'ethereum');
      setIsHotWallet(true);
      setHotWalletSeedExported(stored.seedExported);

      return wallet.address;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to restore wallet';
      setError(msg);
      // Clear corrupted data
      clearHotWallet();
      throw err;
    } finally {
      setIsInitializing(false);
    }
  }, [setAddress, setIsHotWallet, setHotWalletSeedExported, createSignerAdapter]);

  /**
   * Initialize hot wallet - restore existing or generate new
   */
  const initializeHotWallet = useCallback(async (): Promise<string | null> => {
    // Prevent concurrent initialization
    if (initPromiseRef.current) {
      return initPromiseRef.current;
    }

    initPromiseRef.current = (async () => {
      try {
        if (hasStoredHotWallet()) {
          return await restoreHotWallet();
        } else {
          return await generateHotWallet();
        }
      } catch {
        return null;
      } finally {
        initPromiseRef.current = null;
      }
    })();

    return initPromiseRef.current;
  }, [hasStoredHotWallet, restoreHotWallet, generateHotWallet]);

  /**
   * Get the seed phrase words for export
   */
  const getSeedPhrase = useCallback(async (): Promise<string[]> => {
    const mnemonic = await decryptMnemonic();
    if (!mnemonic) {
      throw new Error('No wallet found');
    }
    return mnemonic.split(' ');
  }, []);

  /**
   * Mark seed phrase as exported
   */
  const confirmSeedExported = useCallback(() => {
    markSeedExported();
    setHotWalletSeedExported(true);
  }, [setHotWalletSeedExported]);

  /**
   * Disconnect and clear the hot wallet
   */
  const disconnectHotWallet = useCallback(() => {
    clearHotWallet();
    hotWalletInstance = null;
    hotWalletSigner = null;
    clearAllPaymentState();
    clearAddress();
    setIsHotWallet(false);
    setHotWalletSeedExported(false);
  }, [clearAddress, clearAllPaymentState, setIsHotWallet, setHotWalletSeedExported]);

  /**
   * Create an authenticated Turbo client for the hot wallet
   */
  const createHotWalletTurboClient = useCallback(async (): Promise<TurboAuthenticatedClient> => {
    if (!hotWalletSigner) {
      throw new Error('Hot wallet not initialized');
    }

    const config = getCurrentConfig();

    return TurboFactory.authenticated({
      signer: hotWalletSigner,
      token: 'ethereum',
      paymentServiceConfig: { url: config.paymentServiceUrl },
      uploadServiceConfig: { url: config.uploadServiceUrl },
    });
  }, [getCurrentConfig]);

  return {
    // State
    isHotWallet,
    isInitializing,
    error,
    seedExported: hotWalletSeedExported,
    hotWalletAddress: isHotWallet ? address : null,

    // Actions
    initializeHotWallet,
    generateHotWallet,
    restoreHotWallet,
    disconnectHotWallet,
    getSeedPhrase,
    confirmSeedExported,
    createHotWalletTurboClient,

    // Utilities
    hasStoredHotWallet,
  };
}

/**
 * Get the cached hot wallet signer (for use in other hooks)
 * Returns null if no hot wallet is active
 */
export function getHotWalletSigner(): InjectedEthereumSigner | null {
  return hotWalletSigner;
}

/**
 * Check if hot wallet is currently active (has cached signer)
 */
export function isHotWalletActive(): boolean {
  return hotWalletSigner !== null;
}

/**
 * Clear the hot wallet cache (called when switching wallets)
 */
export function clearHotWalletCache(): void {
  hotWalletInstance = null;
  hotWalletSigner = null;
}
