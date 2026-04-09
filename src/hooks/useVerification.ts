import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import {
  verifyTransaction,
  type VerificationResult,
} from '../services/verificationService';

const VERIFY_TIMEOUT_MS = 60_000;

export function useVerification() {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { getCurrentConfig } = useStore();
  const [searchParams] = useSearchParams();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const cancel = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    if (timerRef.current) clearInterval(timerRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timerRef.current = null;
    abortRef.current = null;
    timeoutRef.current = null;
    setIsVerifying(false);
    setElapsed(0);
  }, []);

  const verify = useCallback(
    async (txId: string) => {
      // Abort any in-flight request and clear its timer
      if (abortRef.current) abortRef.current.abort();
      if (timerRef.current) clearInterval(timerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      setIsVerifying(true);
      setError(null);
      setResult(null);
      setElapsed(0);

      const controller = new AbortController();
      abortRef.current = controller;

      const start = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 1000);

      timeoutRef.current = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

      try {
        const config = getCurrentConfig();
        const verification = await verifyTransaction(
          config.verifyApiUrl,
          txId,
          controller.signal
        );
        setResult(verification);

        // Update URL for deep-linking / sharing
        const url = new URL(window.location.href);
        url.searchParams.set('tx', txId);
        window.history.replaceState({}, '', url.toString());
      } catch (err) {
        // Ignore errors from aborted requests (user cancelled or re-verified)
        if (controller.signal.aborted) return;

        const isNetworkError =
          err instanceof TypeError ||
          (err instanceof DOMException && err.name === 'AbortError');
        const msg = err instanceof Error ? err.message : String(err);

        if (isNetworkError || msg.includes('aborted')) {
          setError(
            'The verification service is not responding. Check your connection and try again.'
          );
        } else if (
          msg.includes('502') ||
          msg.includes('503') ||
          msg.includes('504')
        ) {
          setError(
            'The verification service is temporarily unavailable. Please try again in a moment.'
          );
        } else {
          setError(msg || 'Verification failed');
        }
      } finally {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (timerRef.current) clearInterval(timerRef.current);
        timeoutRef.current = null;
        timerRef.current = null;
        abortRef.current = null;
        setIsVerifying(false);
      }
    },
    [getCurrentConfig]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setElapsed(0);
  }, []);

  const txParam = searchParams.get('tx') || null;

  return { verify, cancel, result, isVerifying, elapsed, error, reset, txParam };
}
