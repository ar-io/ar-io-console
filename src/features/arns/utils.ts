/**
 * Small, dependency-light helpers local to the ArNS feature.
 *
 * arns-react imports `lowerCaseDomain` / `isValidSolanaAddress` / `sleep` from a
 * large shared `@src/utils` barrel. Console has no equivalents, so we keep tiny
 * self-contained copies here rather than growing the global util surface.
 */
import { PublicKey } from '@solana/web3.js';

/** Winston credits per 1 Turbo Credit (1 Credit = 1e12 winc = 1 AR-equivalent). */
export const WINC_PER_CREDIT = 1_000_000_000_000;

/** ArNS names are case-insensitive; the registry keys on the lowercased form. */
export function lowerCaseDomain(name: string): string {
  return name.trim().toLowerCase();
}

/** winc (string or number) → Turbo Credits (number). */
export function wincToCredits(winc: string | number): number {
  return Number(winc) / WINC_PER_CREDIT;
}

/**
 * True when `value` is a valid Solana pubkey (base58, 32 bytes). ANTs are Solana
 * assets, so any on-chain owner/target must decode to a real pubkey.
 */
export function isValidSolanaAddress(value: string | undefined | null): boolean {
  if (!value) return false;
  try {
    // Throws on malformed base58 / wrong length.
    void new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

/** ArNS names may not start or end with a hyphen (matches the registry rule). */
export function isValidArNSName(name: string): boolean {
  const n = lowerCaseDomain(name);
  return n.length > 0 && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(n);
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
