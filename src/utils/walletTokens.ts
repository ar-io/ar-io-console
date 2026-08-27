import type { SupportedTokenType } from '../constants';

export type WalletKind = 'arweave' | 'ethereum' | 'solana' | null;

/**
 * Crypto tokens a wallet can actually pay with, best-first.
 *
 * Order is the preference order, so the head of the list is the sensible
 * default for that wallet — an Ethereum user is offered Base USDC before
 * mainnet ETH because it is cheaper, not because of any ordering accident.
 */
export function availableTokensForWallet(
  walletType: WalletKind,
  isTokenSelectable: (t: SupportedTokenType) => boolean,
): SupportedTokenType[] {
  switch (walletType) {
    case 'arweave':
      return ['arweave'];
    case 'ethereum':
      return (
        ['base-usdc', 'base-eth', 'usdc', 'polygon-usdc', 'pol', 'ethereum'] as SupportedTokenType[]
      ).filter(isTokenSelectable);
    case 'solana':
      return ['solana'];
    default:
      return [];
  }
}

/**
 * The token a top-up should open on for this wallet.
 *
 * The top-up panel used to hard-code `'arweave'` as its initial selection
 * regardless of who was signed in. On a Solana session that meant the crypto
 * tab opened on AR and displayed the user's AR balance — zero, for a Solana
 * user — which reads as "you have no money" rather than "wrong token selected".
 *
 * Returns undefined when the wallet can pay with nothing (or is absent), so the
 * caller can leave the selection alone rather than inventing one.
 */
export function defaultTokenForWallet(
  walletType: WalletKind,
  isTokenSelectable: (t: SupportedTokenType) => boolean,
): SupportedTokenType | undefined {
  return availableTokensForWallet(walletType, isTokenSelectable)[0];
}
