/**
 * Can a persisted primary Solana session be restored on page load?
 *
 * The Solana `WalletProvider` runs `autoConnect={false}`, so a reload starts
 * with no `publicKey` even though the store still holds the address. The old
 * behaviour was to treat that as stale and sign the user out — every reload,
 * unconditionally. Linked wallets never had this problem because their adapter
 * name was persisted and re-selected.
 *
 * This is the decision that replaces the unconditional sign-out, kept pure so
 * it can be tested without a wallet.
 */
export function canRestoreSolanaSession({
  walletType,
  address,
  solanaPublicKey,
  solanaWalletName,
  installedWalletNames,
}: {
  walletType: string | null;
  address: string | null;
  /** Present ⇒ the adapter is already live; nothing to restore. */
  solanaPublicKey: string | null;
  /** Adapter name remembered at connect time. Absent on pre-fix sessions. */
  solanaWalletName: string | null;
  installedWalletNames: string[];
}): { action: 'none' | 'defer-to-reconnect' | 'clear' } {
  // Not a primary Solana session, or already connected — nothing to decide.
  if (walletType !== 'solana' || !address || solanaPublicKey) {
    return { action: 'none' };
  }
  // A session saved before the adapter name was persisted, or whose wallet is
  // no longer installed, genuinely cannot be restored. One last sign-out.
  if (!solanaWalletName || !installedWalletNames.includes(solanaWalletName)) {
    return { action: 'clear' };
  }
  return { action: 'defer-to-reconnect' };
}
