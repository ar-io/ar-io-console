import { useQuery } from '@tanstack/react-query';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

import { getARIO } from '../../../utils';
import { useStore } from '../../../store/useStore';

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
  const { connection } = useConnection();
  const credits = useStore((s) => s.creditBalance);

  const arioQ = useQuery({
    queryKey: ['arns-ario-balances', address],
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
    queryKey: ['arns-sol-balance', address],
    enabled: !!address,
    staleTime: 30_000,
    queryFn: async () => {
      if (!address) return 0;
      try {
        return await connection.getBalance(new PublicKey(address));
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
