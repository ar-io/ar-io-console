/**
 * Deep-link parsing for the Top Up page.
 *
 * External apps (e.g. ArDrive Desktop) can open the Console at
 * `/topup?destinationAddress=<arweaveAddr>&source=ardrive-desktop` (optionally
 * `&amount=<usd>&token=<ar|eth|sol>`) to pre-seed where purchased credits are
 * delivered. Parsing is intentionally strict and side-effect free so the caller
 * can treat a missing/invalid `destinationAddress` as "behave exactly as today".
 */
import { validateWalletAddress } from './addressValidation';
import type { SupportedTokenType } from '../constants';

export interface TopUpDeepLink {
  /** Valid Arweave address to receive credits, or `null` when absent/invalid. */
  destinationAddress: string | null;
  /** Pre-selected USD amount (> 0), or `null` when absent/invalid. */
  amount: number | null;
  /** Pre-selected crypto token, or `null` when absent/unrecognized. */
  token: SupportedTokenType | null;
  /** Originating app identifier (e.g. `ardrive-desktop`), or `null`. */
  source: string | null;
}

const EMPTY_DEEP_LINK: TopUpDeepLink = {
  destinationAddress: null,
  amount: null,
  token: null,
  source: null,
};

/** Maps the short `token` query values to the app's token identifiers. */
const TOKEN_ALIASES: Record<string, SupportedTokenType> = {
  ar: 'arweave',
  eth: 'ethereum',
  sol: 'solana',
};

/**
 * Parses Top Up deep-link parameters from a URLSearchParams-like object.
 *
 * All secondary hints (`amount`, `token`, `source`) are only honored when a
 * valid Arweave `destinationAddress` is present, so a stray `?amount=` on its
 * own never changes the page's default behavior.
 */
export function parseTopUpDeepLink(searchParams: URLSearchParams): TopUpDeepLink {
  const rawDestination = searchParams.get('destinationAddress');
  if (!rawDestination) {
    return EMPTY_DEEP_LINK;
  }

  const destination = rawDestination.trim();
  const validation = validateWalletAddress(destination);
  // The destination is always an Arweave address (43-char base64url). Anything
  // else (Ethereum/Solana/malformed) is ignored to fall back to today's flow.
  if (!validation.isValid || validation.type !== 'arweave') {
    return EMPTY_DEEP_LINK;
  }

  return {
    destinationAddress: destination,
    amount: parseAmount(searchParams.get('amount')),
    token: parseToken(searchParams.get('token')),
    source: parseSource(searchParams.get('source')),
  };
}

function parseAmount(raw: string | null): number | null {
  if (!raw) return null;
  const amount = Number(raw);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function parseToken(raw: string | null): SupportedTokenType | null {
  if (!raw) return null;
  return TOKEN_ALIASES[raw.trim().toLowerCase()] ?? null;
}

function parseSource(raw: string | null): string | null {
  if (!raw) return null;
  const source = raw.trim();
  return source === '' ? null : source;
}

/**
 * Human-readable label for the deep-link source, used in the funding badge.
 * Returns `null` when there is no source to attribute.
 */
export function formatDeepLinkSource(source: string | null): string | null {
  if (!source) return null;
  if (source === 'ardrive-desktop') return 'ArDrive Desktop';
  return source;
}
