/**
 * Wait for a crypto top-up to become spendable before uploading against it.
 *
 * Settling is NOT instant, and `confirmed` is not the common case. Measured
 * against the devnet bundler on Base Sepolia, a base-usdc top-up returns
 * `pending` and the balance does not reflect it for ~67 seconds. Uploading the
 * moment `topUpWithTokens` resolves walks into an insufficient-balance
 * rejection with the payment already settled — the same "paid, got nothing"
 * outcome a correctly-sized payment was supposed to eliminate.
 *
 * So wait for the credits to actually appear rather than trusting the status.
 *
 * Extracted because it was written once for single-file uploads and never
 * carried across to folder uploads, which left Deploy Site paying and then
 * uploading immediately for another two releases. One implementation, used by
 * both, is the only way that stays fixed.
 *
 * Everything is injected so the loop is testable: the balance read, the clock,
 * the sleep and the abort flag. `readBalance` returning undefined means "could
 * not read", which is deliberately NOT treated as "not settled" — see below.
 */

export type SettlementOutcome =
  /** Credits arrived. Safe to upload. */
  | { kind: 'settled' }
  /** The caller cancelled while waiting. No upload should follow. */
  | { kind: 'aborted' }
  /** Ran out of patience. The payment stands; the credits will land later. */
  | { kind: 'timeout' };

/** How long to wait before calling it indeterminate. */
export const TOPUP_SETTLE_TIMEOUT_MS = 5 * 60 * 1000;

/** How often to re-read the balance while waiting. */
export const TOPUP_SETTLE_POLL_MS = 3000;

/** How often a pending balance read checks for the deadline or a cancel. */
const READ_GUARD_MS = 250;

/**
 * `readBalance()`, or undefined once the deadline passes or the caller
 * cancels, whichever comes first.
 *
 * The production readers are turbo-sdk's `getBalance`, a bare fetch with no
 * timeout and no signal, so a hung connection would otherwise hold the loop
 * past its deadline and ignore a cancel. The read itself cannot be stopped;
 * a late result is simply not looked at.
 */
async function readWithin(
  readBalance: () => Promise<number | undefined>,
  deadline: number,
  now: () => number,
  sleep: (ms: number) => Promise<void>,
  isAborted: () => boolean,
): Promise<number | undefined> {
  let finished = false;
  const read = readBalance().finally(() => {
    finished = true;
  });
  const gaveUp = (async () => {
    for (;;) {
      await sleep(Math.max(0, Math.min(READ_GUARD_MS, deadline - now())));
      // The read answered first: stay out of the race so it wins.
      if (finished) return new Promise<never>(() => {});
      if (isAborted() || now() >= deadline) return undefined;
    }
  })();
  return Promise.race([read, gaveUp]);
}

export async function awaitCreditSettlement({
  creditedBefore,
  readBalance,
  now,
  sleep,
  isAborted,
  timeoutMs = TOPUP_SETTLE_TIMEOUT_MS,
  pollMs = TOPUP_SETTLE_POLL_MS,
}: {
  /**
   * Balance read BEFORE the top-up.
   *
   * Undefined means it could not be read, so there is nothing to compare
   * against and nothing can prove the credits arrived. That is reported as a
   * timeout, never as settled. Callers should not get here: without a
   * baseline they refuse to pay at all (BALANCE_UNREADABLE_MESSAGE).
   */
  creditedBefore: number | undefined;
  readBalance: () => Promise<number | undefined>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  isAborted: () => boolean;
  timeoutMs?: number;
  pollMs?: number;
}): Promise<SettlementOutcome> {
  if (creditedBefore === undefined) return { kind: 'timeout' };

  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    if (isAborted()) return { kind: 'aborted' };
    await sleep(pollMs);
    if (isAborted()) return { kind: 'aborted' };
    const current = await readWithin(readBalance, deadline, now, sleep, isAborted);
    /*
      A failed read is not a shortfall. The balance lookup can fail for its own
      reasons — a flaky gateway, a rate limit — and treating that as "not
      settled" would strand a user whose credits had in fact arrived.
    */
    if (current !== undefined && current > creditedBefore) {
      return { kind: 'settled' };
    }
  }
  return { kind: 'timeout' };
}

/**
 * What to tell someone whose payment landed but whose credits have not.
 *
 * Says the three things that stop a support ticket: the money is not lost,
 * nothing was uploaded, and they will not be charged twice.
 */
export const SETTLEMENT_TIMEOUT_MESSAGE =
  'Your payment went through but the credits have not landed yet. Nothing ' +
  'was uploaded and you will not be charged again — the credits will appear ' +
  'in your balance shortly, and uploading again will spend them.';

/**
 * What to tell someone whose balance could not be read before paying.
 *
 * Without that reading there is no way to tell when a payment's credits
 * arrive, so the upload would either run against credits that are not there
 * yet or stop after taking the money. Not paying is the only outcome that
 * needs no follow-up. The read goes to the same payment service that would
 * credit the top-up, so if it is unreachable, sending tokens now is the riskier
 * move anyway.
 */
export const BALANCE_UNREADABLE_MESSAGE =
  'We could not check your credit balance, so no payment was made and ' +
  'nothing was uploaded. Please try again in a moment.';
