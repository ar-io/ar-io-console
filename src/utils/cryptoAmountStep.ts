/**
 * What a TARGETED crypto top-up (a purchase's payment, opened from a checkout)
 * shows instead of its amount step.
 *
 * The amount step is a decision screen, and a targeted top-up has no decision
 * left: the checkout chose the token, and the amount is what the purchase
 * needs. So it goes straight to the confirmation, which prices the transfer
 * and holds the real Pay button, the same way the card path opens on the card
 * form. The amount step stays only where it carries a reason the user must
 * see: a wallet that can't send this token, or ARIO over its per-top-up cap.
 *
 * - `amount`: render the amount step as usual (also for every non-targeted
 *   top-up, which is the /topup page).
 * - `wait`: the target is still being priced.
 * - `error`: pricing the target failed; offer a retry.
 * - `advance`: move to the confirmation step.
 */
export type CryptoAmountStep = 'amount' | 'wait' | 'error' | 'advance';

export function cryptoAmountStep(p: {
  /** Embedded with a known purchase amount, opened on crypto. */
  targeted: boolean;
  /** The flow is on its first step (`selection`). */
  onAmountStep: boolean;
  /** Already advanced once; Back closes the host rather than coming here. */
  advanced: boolean;
  /** Token amount the target costs, once priced. */
  tokenAmount: number | undefined;
  pricingFailed: boolean;
  walletCanSend: boolean;
  overCap: boolean;
}): CryptoAmountStep {
  if (!p.targeted || !p.onAmountStep || p.advanced) return 'amount';
  if (!p.walletCanSend || p.overCap) return 'amount';
  if (p.tokenAmount !== undefined && p.tokenAmount > 0) return 'advance';
  if (p.pricingFailed) return 'error';
  return 'wait';
}
