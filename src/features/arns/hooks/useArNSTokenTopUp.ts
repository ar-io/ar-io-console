import { useCallback, useRef, useState } from 'react';
import { TurboFactory } from '@ardrive/turbo-sdk/web';

import { useArNSTurboSigner } from './useArNSTurboSigner';
import { useTurboConfig } from '../../../hooks/useTurboConfig';
import type { SupportedTokenType } from '../../../constants';
import type { TopUpStep } from '../purchase/topUpSteps';

/**
 * Credits lag the payment: a Solana transfer needs finality and Turbo then
 * credits it, and a card settles through a Stripe webhook. Ninety seconds was
 * optimistic — real SOL top-ups exceeded it and reported "taking longer than
 * usual" for a payment that was merely still in progress.
 *
 * Slower interval too: this used to dispatch `refresh-balance` every 2s, which
 * fans out to every balance consumer in the app — 45 rounds of that during one
 * purchase.
 */
const CREDIT_POLL_INTERVAL_MS = 5_000;
const CREDIT_POLL_TIMEOUT_MS = 5 * 60_000;

/**
 * Fund a name purchase with tokens, inline — no dialog.
 *
 * A token that isn't ARIO can't pay the registry, so it buys credits first.
 * That's two signatures with nothing to type between them, which is why this
 * lives on the checkout card instead of behind a modal.
 *
 * The subtle part is the gap: `topUpWithTokens` returns once the transfer is
 * accepted, but the credits are applied server-side a moment later. Registering
 * immediately would fail with "insufficient credits" having ALREADY taken the
 * user's money — so this waits for the balance to actually reflect the payment
 * before handing back.
 */
export function useArNSTokenTopUp() {
  const signer = useArNSTurboSigner();
  const [step, setStep] = useState<TopUpStep>({ phase: 'idle' });
  const fundedRef = useRef(false);
  const solanaConfig = useTurboConfig('solana');

  const reset = useCallback(() => {
    fundedRef.current = false;
    setStep({ phase: 'idle' });
  }, []);

  /**
   * Tops up and resolves once the credits are spendable. Rejects with the money
   * state intact so the caller can say whether anything was charged.
   */
  const fund = useCallback(
    async ({
      token,
      tokenAmount,
      creditsNeeded,
      readCredits,
    }: {
      token: SupportedTokenType;
      /**
       * Amount in the token's SMALLEST unit (lamports for SOL).
       *
       * Typed as bigint on purpose: the SDK documents this field the same way,
       * and passing whole tokens produced "0.019876422 cannot be converted to a
       * BigInt because it is not an integer" — a failure a cast had hidden.
       */
      tokenAmount: bigint;
      creditsNeeded: number;
      /** Reads the live credit balance; injected so this stays testable. */
      readCredits: () => Promise<number>;
    }): Promise<void> => {
      if (!signer.isReady || !signer.walletAdapter) {
        throw new Error('Connect a Solana wallet with a live signer to pay.');
      }
      fundedRef.current = false;
      setStep({ phase: 'funding' });

      try {
        const turbo = TurboFactory.authenticated({
          token: token as never,
          walletAdapter: signer.walletAdapter,
          ...solanaConfig,
        });
        await turbo.topUpWithTokens({ tokenAmount: tokenAmount.toString() });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Nothing left the wallet — say so, or they will assume it did.
        setStep({ phase: 'failed', message, funded: false });
        throw err;
      }

      // Past here the money is gone, so no failure below may claim otherwise.
      fundedRef.current = true;
      setStep({ phase: 'crediting' });

      const deadline = Date.now() + CREDIT_POLL_TIMEOUT_MS;
      for (;;) {
        let balance = 0;
        try {
          balance = await readCredits();
        } catch {
          // Transient read failure — the payment still landed; keep waiting.
        }
        if (balance >= creditsNeeded) break;
        if (Date.now() >= deadline) {
          setStep({
            phase: 'failed',
            funded: true,
            message:
              'Your payment went through, but the credits are taking longer than usual to appear.',
          });
          throw new Error('Credits did not arrive in time');
        }
        await new Promise((r) => setTimeout(r, CREDIT_POLL_INTERVAL_MS));
      }

      setStep({ phase: 'registering' });
      window.dispatchEvent(new CustomEvent('refresh-balance'));
    },
    [signer, solanaConfig],
  );

  /**
   * Wait for a payment to appear as credits, then hand off to registration.
   *
   * Shared with the card path: Stripe settles server-side and the credits are
   * applied a moment later, exactly like a token transfer. Registering into
   * that gap fails for insufficient credits having already charged the user.
   */
  const awaitCredits = useCallback(
    async ({
      creditsNeeded,
      readCredits,
    }: {
      creditsNeeded: number;
      readCredits: () => Promise<number>;
    }): Promise<void> => {
      fundedRef.current = true;
      setStep({ phase: 'crediting' });
      const deadline = Date.now() + CREDIT_POLL_TIMEOUT_MS;
      for (;;) {
        let balance = 0;
        try {
          balance = await readCredits();
        } catch {
          // Transient read failure — the payment still landed; keep waiting.
        }
        if (balance >= creditsNeeded) break;
        if (Date.now() >= deadline) {
          setStep({
            phase: 'failed',
            funded: true,
            message:
              'Your payment went through, but the credits are taking longer than usual to appear.',
          });
          throw new Error('Credits did not arrive in time');
        }
        await new Promise((r) => setTimeout(r, CREDIT_POLL_INTERVAL_MS));
      }
      setStep({ phase: 'registering' });
      window.dispatchEvent(new CustomEvent('refresh-balance'));
    },
    [],
  );

  /** Report a registration failure without implying the payment was lost. */
  const failAfterFunding = useCallback((message: string) => {
    setStep({ phase: 'failed', message, funded: fundedRef.current });
  }, []);

  return { fund, awaitCredits, reset, failAfterFunding, step };
}
