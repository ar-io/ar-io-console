/**
 * The two-step token purchase, as states rather than a modal.
 *
 * Paying for a name with SOL is a top-up followed by a registration: two
 * signatures, no typing in between. That never needed a dialog — the checkout
 * card already shows the price, the method and the button, so a modal only
 * added a box that appears, spins and closes. What it DID provide was a place
 * to say which step you were on, which is what this replaces.
 */
export type TopUpStep =
  | { phase: 'idle' }
  | { phase: 'funding' }
  /** Transfer confirmed; waiting for credits to appear on the balance. */
  | { phase: 'crediting' }
  | { phase: 'registering' }
  | { phase: 'failed'; message: string; funded: boolean };

/** What the button says. Naming the step beats a bare spinner across two signatures. */
export function stepLabel(step: TopUpStep): string | undefined {
  switch (step.phase) {
    case 'funding':
      return 'Step 1 of 2 — confirm the payment in your wallet';
    case 'crediting':
      return 'Payment received — adding credits';
    case 'registering':
      return 'Step 2 of 2 — confirm the registration';
    default:
      return undefined;
  }
}

/**
 * Whether a failure left the user's money spent.
 *
 * The distinction decides the whole message. Failing during `funding` means the
 * transfer never landed and nothing was lost. Failing after it means they paid
 * and hold credits — the name simply is not registered yet, and telling them
 * "purchase failed" would imply a refund they should not wait for.
 */
export function failureAdvice(step: TopUpStep): string | undefined {
  if (step.phase !== 'failed') return undefined;
  return step.funded
    ? 'Your credits are safe on your balance — you can finish registering without paying again.'
    : 'Nothing was charged.';
}

/** Money is committed from the moment the transfer is signed. */
export function isMoneyAtRisk(step: TopUpStep): boolean {
  return step.phase === 'funding' || step.phase === 'crediting' || step.phase === 'registering';
}
