/**
 * The address ArNS acts as, for a given session.
 *
 * A linked Solana wallet is a SECONDARY identity attached to a primary session,
 * not an identity of its own — and it persists to localStorage, where the
 * primary session does not. So disconnecting the main wallet left this
 * returning the linked address: the app still believed it had an ArNS identity
 * and kept the buy button live for a signed-out user.
 *
 * No session means no identity, whatever is still in storage.
 */
export function resolveArNSAddress({
  walletType,
  address,
  linkedSolanaAddress,
}: {
  walletType: string | null | undefined;
  address: string | null | undefined;
  linkedSolanaAddress: string | null | undefined;
}): string | null {
  // Signed out. The persisted link belongs to a session that no longer exists.
  if (!walletType || !address) return null;
  // A Solana session IS the ArNS identity; no link required.
  if (walletType === 'solana') return address;
  return linkedSolanaAddress ?? null;
}
