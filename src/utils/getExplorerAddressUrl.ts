/**
 * Single source of truth for a block-explorer link to a wallet address, keyed by
 * the connected wallet's ecosystem. Returns `null` when there's no known explorer
 * (callers render the address as plain text then).
 *
 * Companion to `getExplorerTxUrl` (which is keyed by payment token). Wallet types
 * map to one ecosystem each, so this only needs the three console supports.
 *
 * Mainnet explorers only for now; a testnet variant keyed off `configMode` can be
 * layered on later.
 */
export function getExplorerAddressUrl(address: string, walletType: string): string | null {
  if (!address) return null;
  switch (walletType.toLowerCase()) {
    case 'ethereum':
      return `https://etherscan.io/address/${address}`;
    case 'solana':
      return `https://solscan.io/account/${address}`;
    case 'arweave':
      return `https://viewblock.io/arweave/address/${address}`;
    default:
      return null;
  }
}
