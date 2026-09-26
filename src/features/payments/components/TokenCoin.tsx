import { Wallet } from 'lucide-react';

import type { SupportedTokenType } from '../../../constants';

/**
 * Brand coins for the tokens people recognise by their mark.
 *
 * ARIO and SOL are drawn on the same dark disc at the same size, so they read
 * as a matched set rather than two logos that happen to share a row. USDC is
 * the exception: its blue disc is part of the mark itself, and Circle asks that
 * its colours not be altered, so it is used as published. Every USDC shares the
 * one coin, since the chain is already named beside it. Anything without its
 * own mark keeps a line icon: inventing a logo for it would be noise.
 */
const TOKEN_COIN: Partial<Record<SupportedTokenType, string>> = {
  ario: 'brand/ario-token-logo.svg',
  solana: 'brand/solana-token-logo.svg',
  'solana-usdc': 'brand/usdc-token-logo.svg',
  'base-usdc': 'brand/usdc-token-logo.svg',
  usdc: 'brand/usdc-token-logo.svg',
  'polygon-usdc': 'brand/usdc-token-logo.svg',
};

export function TokenCoin({
  token,
  muted = false,
}: {
  token: SupportedTokenType;
  muted?: boolean;
}) {
  const coin = TOKEN_COIN[token];
  if (!coin) {
    return <Wallet className="h-4 w-4 text-foreground/60" aria-hidden="true" />;
  }
  return (
    <img
      src={`${import.meta.env.BASE_URL}${coin}`}
      alt=""
      aria-hidden="true"
      // Sized to sit on the same baseline as the 16px line icons beside it.
      className={`h-5 w-5 flex-none rounded-full transition-opacity ${
        muted ? 'opacity-80' : ''
      }`}
    />
  );
}
