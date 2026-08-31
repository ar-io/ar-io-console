import { isSdkToken, SupportedTokenType } from '../constants';
import { formatUnitsExact } from './formatUnits';

/** Decimal places of each supported token's smallest unit. */
const TOKEN_DECIMALS: Record<SupportedTokenType, number> = {
  arweave: 12,
  ario: 6, // 1 ARIO = 1,000,000 mARIO
  'base-ario': 6, // 1 ARIO = 1,000,000 mARIO (same as ARIO on AO)
  ethereum: 18,
  'base-eth': 18,
  solana: 9,
  kyve: 18,
  pol: 18,
  usdc: 6, // USDC uses 6 decimals
  'base-usdc': 6, // USDC uses 6 decimals
  'polygon-usdc': 6, // USDC uses 6 decimals
};

/**
 * Check if a wallet type supports just-in-time (on-demand) payments
 * Currently supported: SOL, Base-ETH, Base-USDC
 */
export function supportsJitPayment(tokenType: SupportedTokenType | null): boolean {
  return tokenType === 'solana' || tokenType === 'base-eth' || tokenType === 'base-usdc';
}

/**
 * Get the token conversion function for a given token type
 * Converts from readable amount to smallest unit (e.g., SOL → Lamports)
 */
export function getTokenConverter(tokenType: SupportedTokenType): ((amount: number) => number) | null {
  const decimals = TOKEN_DECIMALS[tokenType];
  return (amount: number) => Math.floor(amount * Math.pow(10, decimals));
}

/**
 * Convert smallest unit back to readable amount.
 *
 * NOTE: coerces through `number`, so it loses precision for 18-decimal tokens above
 * ~9e15 (Number.MAX_SAFE_INTEGER). For exact display/export of a smallest-unit
 * STRING, prefer `formatSmallestUnit`.
 */
export function fromSmallestUnit(amount: number, tokenType: SupportedTokenType): number {
  const decimals = TOKEN_DECIMALS[tokenType];
  return amount / Math.pow(10, decimals);
}

/**
 * Format an exact smallest-unit amount (as a string) to a human decimal string, with
 * no float precision loss — use for displaying/exporting payment amounts. Returns
 * `null` for an unknown token or a non-integer input.
 */
export function formatSmallestUnit(
  quantity: string,
  tokenType: SupportedTokenType,
  maxFractionDigits?: number,
): string | null {
  const decimals = TOKEN_DECIMALS[tokenType];
  if (decimals === undefined) return null;
  return formatUnitsExact(quantity, decimals, maxFractionDigits);
}

/**
 * Format token amount for display with appropriate precision
 * Uses dynamic precision to show very small amounts accurately
 */
export function formatTokenAmount(amount: number, tokenType: SupportedTokenType): string {
  // For very small amounts, use higher precision to avoid showing 0.0000
  // Increased threshold to 0.01 to catch small USDC amounts like 0.003734
  if (amount < 0.01 && amount > 0) {
    // Use up to 6 decimal places for very small amounts (USDC has 6 decimals)
    return amount.toFixed(6).replace(/\.?0+$/, ''); // Remove trailing zeros
  }

  // Standard precision for normal amounts
  const precision: Record<SupportedTokenType, number> = {
    ario: 2,        // 100.50 ARIO
    'base-ario': 2, // 100.50 ARIO (same as ARIO)
    solana: 6,      // 0.000001 SOL (increased from 4)
    'base-eth': 6,  // 0.000001 ETH (increased from 4)
    ethereum: 6,
    arweave: 4,
    kyve: 2,
    pol: 2,
    'usdc': 2,        // 10.50 USDC (stablecoin, dollars and cents)
    'base-usdc': 3,   // 10.500 USDC (one extra decimal for precision)
    'polygon-usdc': 2, // 10.50 USDC (stablecoin, dollars and cents)
  };

  return amount.toFixed(precision[tokenType]);
}

// Price cache to avoid spamming Turbo API
interface PriceCache {
  tokenPricePerCredit: number;
  usdPerToken: number | null;
  timestamp: number;
}

const priceCache = new Map<SupportedTokenType, PriceCache>();
const PRICE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/** 1 trillion winc = 1 credit. */
export const WINC_PER_CREDIT = 1_000_000_000_000;

/**
 * Tokens required per credit, given a GiB priced in both units.
 *
 * Extracted so the invariant that matters can actually be tested: the tokens a
 * payment buys must cover the winc the upload is billed. `wincPerGiB` must come
 * from the same source the upload is billed against (`/price/bytes`, which
 * INCLUDES the per-data-item fee) — pairing a fee-inclusive cost with a
 * fee-exclusive rate is what silently under-funded every base-usdc payment.
 */
export function tokenPricePerCredit({
  wincPerGiB,
  tokensPerGiB,
}: {
  wincPerGiB: number;
  tokensPerGiB: number;
}): number {
  const creditsPerGiB = wincPerGiB / WINC_PER_CREDIT;
  return tokensPerGiB / creditsPerGiB;
}

/**
 * Calculate the required token amount for a given credit shortage
 * Uses Turbo SDK's real-time pricing with caching to avoid spam
 */
export async function calculateRequiredTokenAmount({
  creditsNeeded,
  tokenType,
  bufferMultiplier = 1.05,
}: {
  creditsNeeded: number;
  tokenType: SupportedTokenType;
  bufferMultiplier?: number;
}): Promise<{
  tokenAmount: number; // In smallest unit (e.g., Lamports, Winston)
  tokenAmountReadable: number; // Human-readable (e.g., 0.0001)
  estimatedUSD: number | null;
}> {
  const now = Date.now();
  const cached = priceCache.get(tokenType);

  // Use cached price if available and fresh
  if (cached && (now - cached.timestamp) < PRICE_CACHE_DURATION) {
    const baseAmount = creditsNeeded * cached.tokenPricePerCredit;
    const bufferedAmount = baseAmount * bufferMultiplier;
    const converter = getTokenConverter(tokenType);
    const smallestUnit = converter ? converter(bufferedAmount) : 0;

    return {
      tokenAmount: smallestUnit,
      tokenAmountReadable: bufferedAmount,
      estimatedUSD: cached.usdPerToken ? bufferedAmount * cached.usdPerToken : null,
    };
  }

  // Fetch fresh pricing
  try {
    // Get current dev mode configuration from store
    const { useStore } = await import('../store/useStore');
    const turboConfig = useStore.getState().getCurrentConfig();

    const wincPerCredit = WINC_PER_CREDIT;
    const oneGiBBytes = 1024 * 1024 * 1024;

    let wincPerGiB: number;
    let tokensPerGiB: number;
    let usdPerToken: number | null = null;

    /*
      base-usdc is priced exactly like every other token: convert the CREDITS the
      upload needs into tokens.

      It used to be special-cased onto a raw byte-price quote from the x402
      endpoint, which omitted the per-data-item fee. `creditsNeeded` already
      includes that fee (callers build it from `totalCost`), so routing base-usdc
      through the same conversion is what makes the payment cover the upload —
      the old path bought as little as 54% of a small file's cost, and the buyer
      ate a failed upload on top of a settled payment.
    */
    {
      const { TurboFactory } = await import('@ardrive/turbo-sdk/web');

      // Create TurboFactory with proper config including dev mode RPC URLs
      if (!isSdkToken(tokenType)) {
        throw new Error(
          `${tokenType} is no longer supported by the Turbo SDK — it cannot be priced or settled.`,
        );
      }
      const turbo = TurboFactory.unauthenticated({
        token: tokenType,
        paymentServiceConfig: { url: turboConfig.paymentServiceUrl },
        gatewayUrl: turboConfig.tokenMap[tokenType]
      });

      // Get the cost in tokens for uploading credits worth of data
      const priceResult = await turbo.getUploadCosts({ bytes: [oneGiBBytes] });
      wincPerGiB = Number(priceResult[0]?.winc || 0);

      if (wincPerGiB === 0) {
        throw new Error('Failed to get pricing from Turbo SDK - wincPerGiB is 0');
      }

      // Get token price for 1 GiB worth of winc
      const tokenPriceForGiB = await turbo.getTokenPriceForBytes({ byteCount: oneGiBBytes });
      // SDK already returns price in readable token units (ARIO, not mARIO)
      tokensPerGiB = Number(tokenPriceForGiB.tokenPrice);

      // Try to get USD price from Turbo (getFiatRates or similar)
      try {
        const fiatRates = await turbo.getFiatRates();
        // fiatRates.fiat gives USD per GiB, we know tokens per GiB
        const usdPerGiB = fiatRates.fiat?.usd || 0;
        console.log(`[JIT ${tokenType}] getFiatRates USD per GiB:`, usdPerGiB);
        console.log(`[JIT ${tokenType}] Tokens per GiB:`, tokensPerGiB);
        if (usdPerGiB > 0 && tokensPerGiB > 0) {
          usdPerToken = usdPerGiB / tokensPerGiB;
          console.log(`[JIT ${tokenType}] Calculated USD per token:`, usdPerToken);
        }
      } catch (err) {
        console.warn('Failed to get USD price for JIT payment:', err);
      }
    }

    // Calculate: tokens per credit
    const creditsPerGiB = wincPerGiB / wincPerCredit;
    const tokenPrice = tokenPricePerCredit({ wincPerGiB, tokensPerGiB });

    console.log(`[JIT ${tokenType}] Winc per GiB:`, wincPerGiB);
    console.log(`[JIT ${tokenType}] Credits per GiB:`, creditsPerGiB);
    console.log(`[JIT ${tokenType}] Token price per credit:`, tokenPrice);

    // Cache the result
    priceCache.set(tokenType, {
      tokenPricePerCredit: tokenPrice,
      usdPerToken,
      timestamp: now,
    });

    // Calculate final amounts
    const baseAmount = creditsNeeded * tokenPrice;
    const bufferedAmount = baseAmount * bufferMultiplier;

    console.log(`[JIT ${tokenType}] Credits needed:`, creditsNeeded);
    console.log(`[JIT ${tokenType}] Base amount (no buffer):`, baseAmount);
    console.log(`[JIT ${tokenType}] Buffer multiplier:`, bufferMultiplier);
    console.log(`[JIT ${tokenType}] Buffered amount:`, bufferedAmount);
    console.log(`[JIT ${tokenType}] Estimated USD:`, usdPerToken ? bufferedAmount * usdPerToken : null);

    const converter = getTokenConverter(tokenType);
    const smallestUnit = converter ? converter(bufferedAmount) : 0;

    return {
      tokenAmount: smallestUnit,
      tokenAmountReadable: bufferedAmount,
      estimatedUSD: usdPerToken ? bufferedAmount * usdPerToken : null,
    };
  } catch (error) {
    console.error('Failed to calculate JIT payment amount from Turbo SDK:', error);
    // Fallback: return 0 and let user know pricing failed
    return {
      tokenAmount: 0,
      tokenAmountReadable: 0,
      estimatedUSD: null,
    };
  }
}

/**
 * Get the default maximum token amount for JIT payments
 * Same value ($20-25 equivalent) across all supported tokens
 */
export function getDefaultMaxTokenAmount(tokenType: SupportedTokenType): number {
  // Aim for ~$20-25 equivalent across all types
  const defaults: Record<SupportedTokenType, number> = {
    ario: 200,      // 200 ARIO ≈ $20 at $0.10/ARIO
    'base-ario': 200, // 200 ARIO ≈ $20 at $0.10/ARIO (on Base L2)
    solana: 0.15,   // 0.15 SOL ≈ $22.50 at $150/SOL
    'base-eth': 0.01, // 0.01 ETH ≈ $25 at $2500/ETH
    'base-usdc': 25,  // 25 USDC = $25 (stablecoin)
    arweave: 0,
    ethereum: 0,
    kyve: 0,
    pol: 0,
    'usdc': 0,        // Not supported for JIT (too slow)
    'polygon-usdc': 0, // Not supported for JIT (too slow)
  };

  return defaults[tokenType] || 0;
}
