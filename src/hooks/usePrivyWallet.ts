import { useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useStore } from '../store/useStore';
import { clearEthereumTurboClientCache } from './useEthereumTurboClient';
import { clearX402SignerCache } from './useX402Upload';

export function usePrivyWallet() {
  const { user, authenticated, ready, logout } = usePrivy();
  const { wallets } = useWallets();
  const { setAddress, clearAddress, clearAllPaymentState, walletType } = useStore();

  // Find the Privy embedded wallet
  const privyWallet = wallets.find(
    (wallet) => wallet.walletClientType === 'privy'
  );

  // Update store when Privy wallet is connected
  useEffect(() => {
    if (authenticated && privyWallet && walletType !== 'ethereum') {
      // Set the address in the store when Privy wallet is available
      setAddress(privyWallet.address, 'ethereum');
    }
  }, [authenticated, privyWallet, setAddress, walletType]);

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