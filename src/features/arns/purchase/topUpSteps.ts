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

/**
 * How the payment was made, because it changes how many prompts are left.
 *
 * A token purchase is two signatures; a card purchase is one. The card path
 * never enters `funding` — it starts at `crediting` — so counting steps for it
 * announced "Step 2 of 2" to someone who had never been shown a step 1, and
 * asked them to approve "the second prompt" when they only ever get one.
 */
export type FundingSource = 'wallet' | 'card';

/** What the button says. Naming the step beats a bare spinner across two signatures. */
export function stepLabel(
  step: TopUpStep,
  funding: FundingSource = 'wallet',
): string | undefined {
  switch (step.phase) {
    case 'funding':
      return 'Step 1 of 2 — approve the payment in your wallet';
    case 'crediting':
      /*
        Reached by BOTH paths: a card settles server-side and a transfer settles
        on-chain, and either way the credits land a moment later.

        Says the name is NOT bought yet. "Adding credits" left users watching a
        spinner unsure whether the purchase was already happening — the one
        thing they most want to know while waiting.
      */
      return 'Payment confirmed — waiting for credits (the name is not bought yet)';
    case 'registering':
      return funding === 'card'
        ? 'Approve the registration to claim the name'
        : 'Step 2 of 2 — approve the registration to claim the name';
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

/**
 * What the user should do while this runs.
 *
 * The button label names the STEP; this names the expectation. A two-signature
 * flow with a minutes-long gap in the middle looks stalled otherwise, and the
 * most costly reaction to a screen that looks stalled is to leave it.
 */
export function waitingNotice(
  step: TopUpStep,
  funding: FundingSource = 'wallet',
): string | undefined {
  switch (step.phase) {
    case 'funding':
      return 'Keep this tab open — this takes two wallet prompts.';
    case 'crediting':
      /*
        The one stretch with nothing to approve, so it looks the most stuck.
        Name what we are doing (checking, on a timer) rather than only asking
        for patience — a silent wait with no stated mechanism reads as a hang.
      */
      return 'Checking every few seconds for your credits. Your payment is safe — if this takes too long you can finish registering later without paying again.';
    case 'registering':
      return funding === 'card'
        ? 'Keep this tab open — approve the prompt in your Solana wallet to claim the name.'
        : 'Keep this tab open — approve the second prompt to claim the name.';
    default:
      return undefined;
  }
}

/** Money is committed from the moment the transfer is signed. */
export function isMoneyAtRisk(step: TopUpStep): boolean {
  return step.phase === 'funding' || step.phase === 'crediting' || step.phase === 'registering';
}
