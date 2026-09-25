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
  T extends { readyState: WalletReadyState; adapter: { name: string } },
>(wallets: readonly T[]): T[] {
  // One entry per name: the adapter resolves a selection by name, so a second
  // wallet with the same name (the old Solflare MetaMask Snap also calls itself
  // "MetaMask") could never be selected, and would collide as a React key.
  const seen = new Set<string>();
  return wallets.filter((w) => {
    if (w.readyState !== WalletReadyState.Installed || seen.has(w.adapter.name)) return false;
    seen.add(w.adapter.name);
    return true;
  });
}
