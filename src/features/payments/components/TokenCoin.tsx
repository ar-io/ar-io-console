import { Wallet } from 'lucide-react';

import type { SupportedTokenType } from '../../../constants';

/**
 * Brand coins for every token the payment picker can show.
 *
 * ARIO and SOL are drawn on the same dark disc at the same size, so they read
 * as a matched set rather than two logos that happen to share a row. USDC and
 * ETH keep their own published discs, POL is Polygon's mark on its own purple,
 * and AR's mark is already a ring. Every USDC shares one coin and every ETH
 * another, since the network is named beside it.
 *
 * Only a token that can no longer be offered (KYVE) falls back to a line icon,
 * and it never reaches a picker.
 */
const TOKEN_COIN: Partial<Record<SupportedTokenType, string>> = {
  ario: 'brand/ario-token-logo.svg',
  'base-ario': 'brand/ario-token-logo.svg',
  solana: 'brand/solana-token-logo.svg',
  'solana-usdc': 'brand/usdc-token-logo.svg',
  'base-usdc': 'brand/usdc-token-logo.svg',
  usdc: 'brand/usdc-token-logo.svg',
  'polygon-usdc': 'brand/usdc-token-logo.svg',
  ethereum: 'brand/eth-token-logo.svg',
  'base-eth': 'brand/eth-token-logo.svg',
  pol: 'brand/pol-token-logo.svg',
  arweave: 'brand/ar-token-logo.svg',
};

export function TokenCoin({
  token,
  muted = false,
  size = 'md',
}: {
  token: SupportedTokenType;
  muted?: boolean;
  /** 'md' is 20px, for picker rows; 'sm' is 16px, for compact pills. */
  size?: 'sm' | 'md';
}) {
  const coin = TOKEN_COIN[token];
  const box = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  if (!coin) {
    return <Wallet className={`${box} flex-none text-foreground/60`} aria-hidden="true" />;
  }
  return (
    <img
      src={`${import.meta.env.BASE_URL}${coin}`}
      alt=""
      aria-hidden="true"
      className={`${box} flex-none rounded-full transition-opacity ${
        muted ? 'opacity-80' : ''
      }`}
    />
  );
}
