import type { SupportedTokenType } from '../constants';

/**
 * Tokens with no endpoint of their own, because they live on another token's
 * chain. The value is the token whose endpoint they use.
 *
 * USDC on Solana is an SPL token on the same chain as SOL, so it has exactly
 * one correct RPC: SOL's. Storing it as a second key let the two disagree, and
 * the code already read both: balances and the top-up used `tokenMap.solana`,
 * while pricing used `tokenMap['solana-usdc']`. A custom config that changed
 * only the Solana endpoint split them. Worse, custom mode merges shallowly, so
 * a config saved before this token existed had no `solana-usdc` key at all.
 */
export const DERIVED_TOKEN_ENDPOINTS: Partial<
  Record<SupportedTokenType, SupportedTokenType>
> = {
  'solana-usdc': 'solana',
};

/** The token whose endpoint this one follows, or undefined if it has its own. */
export function endpointSourceFor(
  token: string,
): SupportedTokenType | undefined {
  return DERIVED_TOKEN_ENDPOINTS[token as SupportedTokenType];
}

/**
 * Returns the map with every derived token set to its source's endpoint.
 *
 * Applied where the active config is resolved rather than where it is edited,
 * because editing is not the only way a map arrives: persisted configs predate
 * the token, and presets could drift. A derived token whose source has no
 * endpoint is left as it was.
 */
export function withDerivedEndpoints<
  T extends Partial<Record<SupportedTokenType, string>>,
>(tokenMap: T): T {
  const out: Partial<Record<SupportedTokenType, string>> = { ...tokenMap };
  for (const [token, source] of Object.entries(DERIVED_TOKEN_ENDPOINTS)) {
    const url = tokenMap[source as SupportedTokenType];
    if (url) out[token as SupportedTokenType] = url;
  }
  return out as T;
}
