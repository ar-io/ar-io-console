/**
 * How a billable upload pays: per request over x402, or by buying credits first.
 *
 * Both spend the same base-usdc. The difference is WHEN, and it is the whole
 * reason to prefer x402 where it applies.
 *
 * Buying credits first is a separate on-chain payment that settles
 * asynchronously. Measured against the devnet bundler on Base Sepolia, a
 * base-usdc top-up returns `pending` and the balance does not reflect it for
 * ~67 seconds — so the upload path has to sit and poll for the credits to
 * become spendable, and every second of that is a window where the money has
 * moved and the user has nothing. `useFileUpload` carries an explicit wait loop
 * for exactly this.
 *
 * x402 pays the upload request itself. No credits in between, nothing to settle,
 * no poll, and no interval where a payment exists without an upload.
 *
 * Chunking is why this is only now worth doing. A chunked x402 upload used to
 * be impossible — the bundler could not charge for a multipart upload, so the
 * SDK fell back to a single request and capped x402 at the single-item limit
 * however the caller configured chunking. The bundler settles at create as of
 * turbo-sdk 1.43.0-alpha.5, so both paths can pay.
 */
import type { SupportedTokenType } from '../constants';

export type UploadFundingPlan =
  /** Pay the upload request itself. No credits, no settlement wait. */
  | { kind: 'x402' }
  /** Buy credits with the chosen token, then upload against the balance. */
  | { kind: 'topup'; token: SupportedTokenType }
  /** Nothing to pay here — free tier, or an existing credit balance. */
  | { kind: 'none' };

/**
 * The one token x402 settles in.
 *
 * Not a preference. The protocol is USDC on Base, and the bundler prices in
 * mUSDC, so any other token has to go through a top-up whatever the mode says.
 */
export const X402_TOKEN: SupportedTokenType = 'base-usdc';

export function chooseUploadFunding({
  cryptoPayment,
  token,
  walletType,
  x402Enabled,
}: {
  /** The caller asked to pay with crypto for this upload. */
  cryptoPayment?: boolean;
  /** Token the user chose to pay in. */
  token?: SupportedTokenType | null;
  /** Session wallet family — x402 signs with an EVM key. */
  walletType?: string | null;
  /** x402 is available on this bundler / turned on for this session. */
  x402Enabled?: boolean;
}): UploadFundingPlan {
  // No crypto payment requested: the upload is free or paid from a balance.
  if (!cryptoPayment || !token) return { kind: 'none' };

  /*
    Every condition is required, and none may be inferred from another.

    `x402Enabled` alone is not enough: the mode restricts the token but says
    nothing about the wallet, and a Solana or Arweave session cannot produce
    the EVM signature the protocol needs. Falling through to a top-up is the
    correct answer for them, not an error — they can still pay, just not this
    way.
  */
  if (x402Enabled && walletType === 'ethereum' && token === X402_TOKEN) {
    return { kind: 'x402' };
  }

  return { kind: 'topup', token };
}

/** True when the upload pays for itself and no pre-payment should be made. */
export function paysPerRequest(plan: UploadFundingPlan): boolean {
  return plan.kind === 'x402';
}
