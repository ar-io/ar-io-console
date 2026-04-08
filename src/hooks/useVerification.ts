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
  const { getCurrentConfig } = useStore();
  const [searchParams] = useSearchParams();

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const verify = useCallback(
    async (txId: string) => {
      setIsVerifying(true);
      setError(null);
      setResult(null);
      setElapsed(0);

      const start = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 1000);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

      try {
        const config = getCurrentConfig();
        const verification = await verifyTransaction(
          config.verifyApiUrl,
          txId,
          controller.signal
        );
        setResult(verification);
      } catch (err) {
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
        clearTimeout(timeoutId);
        if (timerRef.current) clearInterval(timerRef.current);
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

  return { verify, result, isVerifying, elapsed, error, reset, txParam };
}
