import { useCallback, useSyncExternalStore } from 'react';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { TurboFactory, TurboAuthenticatedClient, ArconnectSigner } from '@ardrive/turbo-sdk/web';
import { useWallet } from '@solana/wallet-adapter-react';
import { useStore } from '@/store/useStore';
import { useTurboConfig } from '@/hooks/useTurboConfig';
import { useEthereumTurboClient } from '@/hooks/useEthereumTurboClient';
import { paymentHistoryStatus, type PaymentHistoryStatus } from '@/utils/paymentHistoryStatus';

export type { PaymentHistoryStatus };

/** One row from the SDK's payment history — a discriminated union on `type`. */
export type PaymentHistoryItem = Awaited<
  ReturnType<TurboAuthenticatedClient['getPaymentHistory']>
>['payments'][number];

type HistoryPage = Awaited<ReturnType<TurboAuthenticatedClient['getPaymentHistory']>> & {
  /** When this page was fetched. Page one's is the history's age. */
  fetchedAt: number;
};

// Generous page size so almost every user sees their whole history in a single
// signed request — pagination costs another signature (the SDK signs a fresh
// nonce per request), so we keep pages large and only surface "Load more" when
// there genuinely is more.
const PAGE_SIZE = 50;

/** Query key root. `useCreditBalance` marks it stale on `refresh-balance`. */
export const PAYMENT_HISTORY_KEY = 'payment-history';

// The authenticated client, kept across visits to the page so "Load more" and
// Refresh don't rebuild the signer. Cleared by `useWalletAccountListener` on a
// wallet switch, like the Ethereum and x402 signer caches.
let clientCache: { key: string; client: TurboAuthenticatedClient } | null = null;

export function clearPaymentHistoryClientCache(): void {
  clientCache = null;
}

/**
 * The connected wallet's own top-up history via turbo-sdk `getPaymentHistory`.
 *
 * Every request is signed (the service reads the wallet from the signature),
 * so nothing fetches on its own: not on mount, focus or reconnect, only when
 * the user calls `load()`, `refresh()` or `loadMore()`. What loads is cached
 * for the session in the query cache, keyed by wallet and network, so leaving
 * the page and coming back shows it at once without another signature. A
 * result can only land under the wallet that asked for it, and
 * `useWalletAccountListener` drops other wallets' history when the session
 * changes. Kept in memory only: persisting it would show it to whoever uses
 * the browser next without the signature that gates it.
 *
 * `refresh-balance` (any top-up, share or revoke) marks it stale without
 * fetching (`useCreditBalance`), so the section can offer a refresh rather
 * than spring a wallet prompt.
 */
export function usePaymentHistory() {
  const { address, walletType, configMode } = useStore();
  const turboConfig = useTurboConfig();
  const { createEthereumTurboClient } = useEthereumTurboClient();
  const {
    publicKey: solanaPublicKey,
    signMessage: solanaSignMessage,
    signTransaction: solanaSignTransaction,
  } = useWallet();
  const queryClient = useQueryClient();
  const queryKey = [PAYMENT_HISTORY_KEY, address, walletType, configMode];
  const clientKey = `${address}|${walletType}|${configMode}`;

  const getClient = useCallback(async (): Promise<TurboAuthenticatedClient> => {
    if (!address || !walletType) throw new Error('Wallet not connected');
    if (clientCache?.key === clientKey) return clientCache.client;

    let client: TurboAuthenticatedClient;
    switch (walletType) {
      case 'arweave':
        if (!window.arweaveWallet) throw new Error('Wander wallet extension not found');
        client = TurboFactory.authenticated({
          ...turboConfig,
          signer: new ArconnectSigner(window.arweaveWallet),
        });
        break;
      case 'ethereum':
        // Reuses the console's cached Ethereum signer (custom connect message,
        // signed once per session) — same path Credit Sharing uses.
        client = await createEthereumTurboClient('ethereum');
        break;
      case 'solana':
        if (!solanaPublicKey || !solanaSignMessage || !solanaSignTransaction) {
          throw new Error('Solana wallet not connected. Please reconnect your Solana wallet.');
        }
        client = TurboFactory.authenticated({
          token: 'solana',
          walletAdapter: {
            publicKey: solanaPublicKey,
            signMessage: solanaSignMessage,
            signTransaction: solanaSignTransaction,
          },
          ...turboConfig,
        });
        break;
      default:
        throw new Error(`Unsupported wallet type: ${walletType}`);
    }
    clientCache = { key: clientKey, client };
    return client;
  }, [
    address,
    walletType,
    clientKey,
    turboConfig,
    createEthereumTurboClient,
    solanaPublicKey,
    solanaSignMessage,
    solanaSignTransaction,
  ]);

  const query = useInfiniteQuery({
    queryKey,
    // Only on an explicit click: every request asks the wallet to sign.
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
    // A declined signature is an answer, not a flake.
    retry: false,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<HistoryPage> => {
      const turbo = await getClient();
      const page = await turbo.getPaymentHistory(pageParam ? { limit: PAGE_SIZE, cursor: pageParam } : { limit: PAGE_SIZE });
      return { ...page, fetchedAt: Date.now() };
    },
    getNextPageParam: (last) => (last.hasMore && last.cursor ? last.cursor : undefined),
  });

  const toMessage = (e: unknown): string => {
    const msg = e instanceof Error ? e.message : String(e);
    if (/reject|denied|declin|cancel/i.test(msg)) {
      return 'Signature declined — approve the request to view your history.';
    }
    return "Couldn't load your payment history. Please try again.";
  };

  /** First page. Triggers the wallet signature. */
  // Every action waits for any fetch in flight: TanStack cancels a running
  // fetch when another starts (`cancelRefetch`), which would throw away a
  // signature the user has already given.
  const load = useCallback(async () => {
    if (!address || query.isFetching) return;
    await query.refetch();
  }, [address, query]);

  /**
   * Fetch the first page again, dropping later pages first: refetching an
   * infinite query refetches every page it holds, a signature each.
   *
   * Trimming writes the cache, which would stamp it "just now" and clear the
   * stale mark before anything is fetched; keep the old timestamp, and if the
   * refresh fails (a declined signature, say) mark it stale again, so old rows
   * never read as current.
   */
  const refresh = useCallback(async () => {
    if (!address || query.isFetching) return;
    const key = [PAYMENT_HISTORY_KEY, address, walletType, configMode];
    const before = queryClient.getQueryState(key);
    queryClient.setQueryData<InfiniteData<HistoryPage, string | undefined>>(
      key,
      (d) => (d ? { pages: d.pages.slice(0, 1), pageParams: d.pageParams.slice(0, 1) } : d),
      { updatedAt: before?.dataUpdatedAt },
    );
    const result = await query.refetch();
    if (result.isError && before?.isInvalidated) {
      await queryClient.invalidateQueries({ queryKey: key, exact: true, refetchType: 'none' });
    }
  }, [address, walletType, configMode, query, queryClient]);

  /**
   * Next page (keeps existing rows on failure). Page one is unchanged, so a
   * stale history stays stale: TanStack clears the invalidation on any
   * successful fetch, so restore it if it was set before or during this one.
   */
  const loadMore = useCallback(async () => {
    if (!query.hasNextPage || query.isFetching) return;
    const key = [PAYMENT_HISTORY_KEY, address, walletType, configMode];
    const hash = queryClient.getQueryCache().find({ queryKey: key, exact: true })?.queryHash;
    let wasInvalidated = !!queryClient.getQueryState(key)?.isInvalidated;
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'invalidate' && event.query.queryHash === hash) {
        wasInvalidated = true;
      }
    });
    try {
      const result = await query.fetchNextPage();
      if (!result.isError && wasInvalidated) {
        await queryClient.invalidateQueries({ queryKey: key, exact: true, refetchType: 'none' });
      }
    } finally {
      unsubscribe();
    }
  }, [address, walletType, configMode, query, queryClient]);

  // TanStack never reports a disabled query as stale (`isStale` checks
  // `enabled` first), so read the invalidation `refresh-balance` leaves on it
  // straight from the cache. A successful fetch clears it.
  const invalidated = useSyncExternalStore(
    (onChange) => queryClient.getQueryCache().subscribe(onChange),
    () => queryClient.getQueryState([PAYMENT_HISTORY_KEY, address, walletType, configMode])?.isInvalidated ?? false,
  );

  const hasData = !!query.data;
  const status: PaymentHistoryStatus = paymentHistoryStatus({
    hasData,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isError: query.isError,
  });

  return {
    payments: query.data?.pages.flatMap((p) => p.payments) ?? [],
    hasMore: !!query.hasNextPage,
    status,
    error: query.isError ? toMessage(query.error) : null,
    /** When the cached history was fetched (ms), or undefined before the first load. */
    loadedAt: query.data?.pages[0]?.fetchedAt,
    /** True once a top-up, share or revoke has happened since it was fetched. */
    stale: hasData && invalidated,
    load,
    refresh,
    loadMore,
  };
}
