/**
 * Single source of truth for how a wallet is labeled in the UI. Both the header
 * profile dropdown (`Header.tsx`) and the account wallet card (`WalletIdentityCard.tsx`)
 * render through this so the two surfaces can't drift.
 *
 * We label by network/ecosystem (Arweave / Ethereum / Solana) rather than by wallet
 * brand (Wander / Phantom), so the primary and linked wallets read consistently.
 */
export const WALLET_NETWORK_LABELS: Record<string, string> = {
  arweave: 'Arweave',
  ethereum: 'Ethereum',
  solana: 'Solana',
};

/** Human network label for a wallet type; falls back to the raw type, or '' if null. */
export function getWalletNetworkLabel(walletType?: string | null): string {
  if (!walletType) return '';
  return WALLET_NETWORK_LABELS[walletType] ?? walletType;
}
