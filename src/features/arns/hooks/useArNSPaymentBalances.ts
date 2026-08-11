import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { address as toSolanaAddress } from '@solana/kit';

import { getARIO, getSolanaReadRpc } from '../../../utils';
import { useStore } from '../../../store/useStore';
import { useArNSConfigKey } from './useArNSConfigKey';

const M_ARIO_PER_ARIO = 1e6;
const LAMPORTS_PER_SOL = 1e9;

export interface ArNSPaymentBalances {
  /** Liquid ARIO (wallet token balance). */
  liquidArio: number;
  /** Staked + vaulted ARIO (delegations). */
  stakedArio: number;
  /** liquid + staked. */
  totalArio: number;
  /** Native SOL (for gas/rent). */
  sol: number;
  /** Turbo Credits. */
  credits: number;
  loading: boolean;
}

/** Structural view of the ARIO reads we need for balances. */
type ARIOBalanceReadable = {
  getBalance(p: { address: string }): Promise<number>;
  getDelegations(p: {
    address: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ items?: Array<{ balance?: number }>; nextCursor?: string }>;
};

/**
 * The balances that gate/inform ArNS payment: liquid ARIO, staked+vaulted ARIO
 * (for the 'stakes'/'any' funding sources), native SOL (every buy needs SOL for
 * rent/gas), and Turbo Credits. ARIO/SOL are fetched live and cached; credits
 * come from the store.
 */
export function useArNSPaymentBalances(
  address: string | undefined,
): ArNSPaymentBalances {
  const credits = useStore((s) => s.creditBalance);
  const configKey = useArNSConfigKey();
  const queryClient = useQueryClient();

  // Refetch the ARIO + SOL balances the moment any payment/write dispatches
  // 'refresh-balance', instead of waiting out the 30s staleTime — otherwise an
  // ARIO-funded ArNS action leaves the balance panel stale until it goes cold.
  // Debounced at 150ms to collapse rapid-fire dispatches (multi-item uploads).
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const onRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['arns-ario-balances'] });
        queryClient.invalidateQueries({ queryKey: ['arns-sol-balance'] });
      }, 150);
    };
    window.addEventListener('refresh-balance', onRefresh);
    return () => {
      window.removeEventListener('refresh-balance', onRefresh);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [queryClient]);

  const arioQ = useQuery({
    queryKey: ['arns-ario-balances', configKey, address],
    enabled: !!address,
    staleTime: 30_000,
    queryFn: async () => {
      if (!address) return { liquidMARIO: 0, stakedMARIO: 0 };
      const ario = getARIO() as unknown as ARIOBalanceReadable;
      const liquidMARIO = await ario.getBalance({ address }).catch(() => 0);

      // Sum every delegation (stake + vault) for the staked/vaulted total.
      // Bound the loop: a repeated/non-advancing `nextCursor` from the SDK
      // would otherwise spin forever, so cap the page count and break on a
      // cursor we've already seen.
      const MAX_PAGES = 50;
      let stakedMARIO = 0;
      let cursor: string | undefined;
      const seen = new Set<string>();
      let pages = 0;
      do {
        const page = await ario
          .getDelegations({ address, limit: 100, cursor })
          .catch(() => ({ items: [], nextCursor: undefined }));
        for (const d of page.items ?? []) stakedMARIO += d.balance ?? 0;
        cursor = page.nextCursor;
        if (cursor && seen.has(cursor)) break;
        if (cursor) seen.add(cursor);
      } while (cursor && ++pages < MAX_PAGES);

      return { liquidMARIO, stakedMARIO };
    },
  });

  const solQ = useQuery({
    // Keyed by configKey since the RPC/cluster is config-derived.
    queryKey: ['arns-sol-balance', configKey, address],
    enabled: !!address,
    staleTime: 30_000,
    queryFn: async () => {
      if (!address) return 0;
      try {
        // Query SOL on the CONSOLE-CONFIG cluster (same RPC the ARIO balance and
        // the ArNS buy tx use) — NOT the wallet-adapter connection, whose
        // endpoint is fixed to mainnet/VITE_SOLANA_RPC. Otherwise a Testnet/
        // devnet wallet reads 0 SOL because it's queried against mainnet.
        const rpc = getSolanaReadRpc();
        const { value } = await rpc.getBalance(toSolanaAddress(address)).send();
        return Number(value);
      } catch {
        return 0;
      }
    },
  });

  const liquidArio = (arioQ.data?.liquidMARIO ?? 0) / M_ARIO_PER_ARIO;
  const stakedArio = (arioQ.data?.stakedMARIO ?? 0) / M_ARIO_PER_ARIO;

  return {
    liquidArio,
    stakedArio,
    totalArio: liquidArio + stakedArio,
    sol: (solQ.data ?? 0) / LAMPORTS_PER_SOL,
    credits,
    loading: arioQ.isLoading || solQ.isLoading,
  };
}
