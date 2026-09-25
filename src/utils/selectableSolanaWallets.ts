import { WalletReadyState } from '@solana/wallet-adapter-base';

/**
 * The Solana wallets a user can pick: every one installed in this browser.
 *
 * Both pickers (sign-in and linking) read this, so they cannot disagree about
 * which wallets exist. There is deliberately no name filter. One used to hide
 * anything called "MetaMask", from when that meant the old Snap; MetaMask's
 * built-in Solana support registers through Wallet Standard under that same
 * name, so the filter hid a working wallet that ArNS writes can use.
 */
export function selectableSolanaWallets<
  T extends { readyState: WalletReadyState },
>(wallets: readonly T[]): T[] {
  return wallets.filter((w) => w.readyState === WalletReadyState.Installed);
}
