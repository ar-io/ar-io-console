import { useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useStore } from '../store/useStore';
import { clearEthereumTurboClientCache } from './useEthereumTurboClient';
import { clearX402SignerCache } from './useX402Upload';

export function usePrivyWallet() {
  const { user, authenticated, ready, logout } = usePrivy();
  const { wallets } = useWallets();
  const { address, setAddress, clearAddress, clearAllPaymentState } = useStore();

  // Find the Privy embedded wallet
  const privyWallet = wallets.find(
    (wallet) => wallet.walletClientType === 'privy'
  );

  // Adopt the Privy wallet as the session ONLY when no session exists yet.
  //
  // The previous guard was `walletType !== 'ethereum'`, which protected a
  // connected MetaMask but not a connected Solana or Arweave wallet: a user who
  // had ever signed in by email carried a Privy session, and this effect would
  // then overwrite their Solana session with the embedded Ethereum address.
  // Establishing an identity is fine; replacing one the user already chose is
  // not. Mirrors the `!currentAddress` guard WalletSelectionModal already uses.
  useEffect(() => {
    if (authenticated && privyWallet && !address) {
      setAddress(privyWallet.address, 'ethereum');
    }
  }, [authenticated, privyWallet, setAddress, address]);

  // Handle logout
  const handlePrivyLogout = async () => {
    await logout();
    // Mirror the non-Privy disconnect: clear payment state + cached signers so
    // nothing leaks into the next session (CLAUDE.md gotcha #2).
    clearAllPaymentState();
    clearEthereumTurboClientCache();
    clearX402SignerCache();
    clearAddress();
  };

  return {
    isPrivyUser: authenticated && !!privyWallet,
    privyWallet,
    privyLogout: handlePrivyLogout,
    privyReady: ready,
    user,
  };
}