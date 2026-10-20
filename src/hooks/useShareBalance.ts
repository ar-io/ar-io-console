import { useQuery } from '@tanstack/react-query';
import { useStore } from '../store/useStore';
import { getTurboBalance } from '../utils';
import { toShareableBalance, toShareRows } from '../utils/shareableCredits';

/**
 * The connected wallet's balance split the way sharing needs it: what it can
 * share, what other wallets shared with it (spend only), what it has shared
 * out, and the approvals in both directions grouped by wallet.
 *
 * Fetched here rather than read from the store's `creditBalance`, which is
 * `effectiveBalance`: it includes credits other wallets shared with this one,
 * which can be spent but not re-shared. One query key for every caller (Share
 * Credits, the Account page), so they share one cache and one refetch; the
 * 'credit-balance' prefix keeps it in the set that `refresh-balance`
 * invalidates.
 */
export function useShareBalance() {
  const { address, walletType, configMode } = useStore();
  const paymentAvailable = useStore((s) => s.isPaymentServiceAvailable());

  return useQuery({
    queryKey: ['credit-balance', 'shareable', address, walletType, configMode],
    enabled: !!address && !!walletType && paymentAvailable,
    staleTime: 30_000,
    queryFn: async () => {
      const response = await getTurboBalance(address!, walletType!);
      // getTurboBalance parses any response body, so a 5xx error body would
      // otherwise read as a zero balance. A real balance always has `winc`.
      if (response?.winc === undefined) throw new Error('Balance unavailable');
      return {
        ...toShareableBalance(response),
        given: toShareRows(response.givenApprovals, 'given'),
        received: toShareRows(response.receivedApprovals, 'received'),
      };
    },
  });
}
