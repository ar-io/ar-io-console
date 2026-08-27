/**
 * Single source of truth for a block-explorer link to a top-up transaction,
 * keyed by the token the payment was made in. Returns `null` when there's no
 * known explorer for that token — callers render the id as plain text then.
 *
 * Consolidates what were previously divergent per-file maps (PaymentSuccessPanel
 * linked `ario` to Solscan while PendingTxRecoveryBanner used Viewblock).
 *
 * Mainnet explorers only for now; a testnet variant keyed off `configMode` can be
 * layered on later.
 */
export function getExplorerTxUrl(txId: string, tokenType: string): string | null {
  if (!txId) return null;
  switch (tokenType.toLowerCase()) {
    case 'solana':
    case 'ario': // ARIO top-ups settle on Solana post-migration
      return `https://solscan.io/tx/${txId}`;
    case 'ethereum':
    case 'usdc': // USDC on Ethereum mainnet
      return `https://etherscan.io/tx/${txId}`;
    case 'base-eth':
    case 'base-usdc':
    case 'base-ario':
      return `https://basescan.org/tx/${txId}`;
    case 'pol':
    case 'polygon-usdc':
      return `https://polygonscan.com/tx/${txId}`;
    case 'arweave':
      return `https://viewblock.io/arweave/tx/${txId}`;
    case 'kyve':
      return `https://www.mintscan.io/kyve/tx/${txId}`;
    default:
      return null;
  }
}
