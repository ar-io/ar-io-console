import { SupportedTokenType, SOLANA_USDC_CONFIG } from '../constants';

/**
 * The tokens one Solana wallet can pay with.
 *
 * Both are signed by the same ed25519 key on the same chain: SOL natively, and
 * USDC as an SPL transfer from a token account the wallet owns.
 */
export type SolanaChainToken = 'solana' | 'solana-usdc';

export function isSolanaChainToken(
  token: string | null | undefined,
): token is SolanaChainToken {
  return token === 'solana' || token === 'solana-usdc';
}

/**
 * Which token a Solana wallet's Turbo client must be built with.
 *
 * A client is bound to one token at construction, and it spends whatever that
 * token is: `token: 'solana'` sends lamports no matter which token the caller
 * selected. Every upload path takes an override for exactly this reason and
 * the Solana branches used to ignore it, so choosing USDC produced a SOL
 * client that then received an amount converted with USDC's six decimals. A 25
 * USDC cap became 25,000,000 lamports, 0.025 SOL: the wrong asset, in the
 * wrong amount, with nothing thrown.
 *
 * Anything that is not a Solana-chain token falls back to SOL rather than
 * being passed through, because a Solana wallet cannot sign for it at all and
 * a client built on it would fail further from the cause.
 */
export function solanaClientToken(
  requested?: SupportedTokenType | string | null,
): SolanaChainToken {
  return isSolanaChainToken(requested) ? requested : 'solana';
}

/**
 * The USDC mint on the cluster with this genesis hash, or undefined for a
 * cluster with no known USDC mint (a localnet, say).
 *
 * Undefined rather than a fallback on purpose: guessing the mainnet mint on an
 * unknown cluster reads zero, and a funded wallet that shows zero reads as
 * money missing. A caller should say the token is unavailable instead.
 */
export function solanaUsdcMintForGenesis(
  genesisHash: string | null | undefined,
): string | undefined {
  if (!genesisHash) return undefined;
  return SOLANA_USDC_CONFIG.mintsByGenesisHash[genesisHash];
}
