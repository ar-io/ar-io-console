import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useStore } from '../store/useStore';
import { getTurboBalance } from '../utils';

/**
 * Shared React Query hook for the user's Turbo credit balance.
 *
 * Single source of truth: replaces the manual fetch + useState + useEffect
 * patterns that were duplicated in Header and BalanceCard. The balance is
 * cached via React Query (`staleTime: 30s`) and synced to the Zustand store
 * so non-hook consumers (ArNS payment balances, pricing panels, etc.) can
 * still read `creditBalance` from the store.
 *
 * Listens for the `refresh-balance` custom event and invalidates the query
 * so post-payment updates propagate immediately (debounced at 150ms to
 * collapse rapid-fire dispatches from multi-item uploads).
 */
export function useCreditBalance() {
  const address = useStore((s) => s.address);
  const walletType = useStore((s) => s.walletType);
  const configMode = useStore((s) => s.configMode);
  const isPaymentServiceAvailable = useStore((s) => s.isPaymentServiceAvailable);
  const setCreditBalance = useStore((s) => s.setCreditBalance);
  const queryClient = useQueryClient();

  const paymentAvailable = isPaymentServiceAvailable();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['credit-balance', address, walletType, configMode],
    enabled: !!address && !!walletType && paymentAvailable,
    staleTime: 30_000,
    queryFn: async () => {
      const balance = await getTurboBalance(address!, walletType!);
      // effectiveBalance = owned + received shared credits (spendable total).
      const spendableWinc = balance.effectiveBalance ?? balance.winc;
      return Number(spendableWinc) / 1e12;
    },
  });

  // Sync to Zustand so store-based consumers stay current.
  const credits = paymentAvailable ? (data ?? 0) : 0;
  useEffect(() => {
    setCreditBalance(credits);
  }, [credits, setCreditBalance]);

  // Invalidate on `refresh-balance` (debounced 150ms — C5).
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const onRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['credit-balance'] });
      }, 150);
    };
    window.addEventListener('refresh-balance', onRefresh);
    return () => {
      window.removeEventListener('refresh-balance', onRefresh);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [queryClient]);

  return {
    /** Credit amount (numeric). 0 when unavailable or x402-only. */
    credits,
    /** True during initial load (no cached data yet). */
    isLoading,
    /** True during any fetch (including background refetch). */
    isFetching,
    /** Manually trigger a refetch (e.g. refresh button). */
    refetch: () => queryClient.invalidateQueries({ queryKey: ['credit-balance'] }),
  };
}
