import { useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import {
  verifyTransaction,
  type VerificationResult,
} from '../services/verificationService';

export function useVerification() {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { getCurrentConfig } = useStore();
  const [searchParams] = useSearchParams();

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

      try {
        const config = getCurrentConfig();
        const baseUrl = config.verifyApiUrl;
        const verification = await verifyTransaction(baseUrl, txId);
        setResult(verification);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('fetch') ||
          msg.includes('network') ||
          msg.includes('502') ||
          msg.includes('Failed')
        ) {
          setError(
            'The verification service is temporarily unavailable. Please try again in a moment.'
          );
        } else {
          setError(msg || 'Verification failed');
        }
      } finally {
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

  // Deep link param
  const txParam = searchParams.get('tx');

  return { verify, result, isVerifying, elapsed, error, reset, txParam };
}
