import { useCallback, useEffect, useRef, useState } from 'react';
import { TurboFactory, TurboAuthenticatedClient, ArconnectSigner } from '@ardrive/turbo-sdk/web';
import { useWallet } from '@solana/wallet-adapter-react';
import { useStore } from '../store/useStore';
import { useTurboConfig } from './useTurboConfig';
import { useEthereumTurboClient } from './useEthereumTurboClient';

/** One row from the SDK's payment history — a discriminated union on `type`. */
export type PaymentHistoryItem = Awaited<
  ReturnType<TurboAuthenticatedClient['getPaymentHistory']>
>['payments'][number];

export type PaymentHistoryStatus = 'idle' | 'loading' | 'loadingMore' | 'loaded' | 'error';

// Generous page size so almost every user sees their whole history in a single
// signed request — pagination costs another signature (the SDK signs a fresh
// nonce per request), so we keep pages large and only surface "Load more" when
// there genuinely is more.
const PAGE_SIZE = 50;

/**
 * Opt-in fetch of the connected wallet's own top-up history via the turbo-sdk
 * `getPaymentHistory` API. The call is authenticated and signature-scoped (the
 * service reads the wallet from the request signature), so nothing loads until
 * the user explicitly calls `load()` — that click is what triggers the wallet
 * signature. The authenticated client is cached per session so paging reuses the
 * same signer.
 */
export function usePaymentHistory() {
  const { address, walletType } = useStore();
  const turboConfig = useTurboConfig();
  const { createEthereumTurboClient } = useEthereumTurboClient();
  const {
    publicKey: solanaPublicKey,
    signMessage: solanaSignMessage,
    signTransaction: solanaSignTransaction,
  } = useWallet();

  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<PaymentHistoryStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Cache the authenticated client for the session (keyed by address) so paging
  // doesn't rebuild the signer. A wallet switch invalidates it.
  const clientRef = useRef<{ address: string; client: TurboAuthenticatedClient } | null>(null);

  const getClient = useCallback(async (): Promise<TurboAuthenticatedClient> => {
    if (!address || !walletType) throw new Error('Wallet not connected');
    if (clientRef.current?.address === address) return clientRef.current.client;

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
        if (!solanaPublicKey || !solanaSignMessage) {
          throw new Error('Solana wallet not connected. Please reconnect your Solana wallet.');
        }
        client = TurboFactory.authenticated({
          token: 'solana',
          walletAdapter: {
            publicKey: solanaPublicKey,
            signMessage: solanaSignMessage,
            signTransaction: solanaSignTransaction!,
          },
          ...turboConfig,
        });
        break;
      default:
        throw new Error(`Unsupported wallet type: ${walletType}`);
    }
    clientRef.current = { address, client };
    return client;
  }, [
    address,
    walletType,
    turboConfig,
    createEthereumTurboClient,
    solanaPublicKey,
    solanaSignMessage,
    solanaSignTransaction,
  ]);

  const toMessage = (e: unknown): string => {
    const msg = e instanceof Error ? e.message : String(e);
    if (/reject|denied|declin|cancel/i.test(msg)) {
      return 'Signature declined — approve the request to view your history.';
    }
    return "Couldn't load your payment history. Please try again.";
  };

  /** First page. Triggers the wallet signature. */
  const load = useCallback(async () => {
    if (!address) return;
    setStatus('loading');
    setError(null);
    try {
      const turbo = await getClient();
      const res = await turbo.getPaymentHistory({ limit: PAGE_SIZE });
      setPayments(res.payments);
      setCursor(res.cursor);
      setHasMore(res.hasMore);
      setStatus('loaded');
    } catch (e) {
      setError(toMessage(e));
      setStatus('error');
    }
  }, [address, getClient]);

  /** Next page (keeps existing rows on failure). */
  const loadMore = useCallback(async () => {
    if (!cursor || status === 'loadingMore') return;
    setStatus('loadingMore');
    setError(null);
    try {
      const turbo = await getClient();
      const res = await turbo.getPaymentHistory({ limit: PAGE_SIZE, cursor });
      setPayments((prev) => [...prev, ...res.payments]);
      setCursor(res.cursor);
      setHasMore(res.hasMore);
      setStatus('loaded');
    } catch (e) {
      setError(toMessage(e));
      setStatus('loaded');
    }
  }, [cursor, status, getClient]);

  const reset = useCallback(() => {
    clientRef.current = null;
    setPayments([]);
    setCursor(null);
    setHasMore(false);
    setStatus('idle');
    setError(null);
  }, []);

  // Clear everything when the wallet changes so one wallet's history never shows
  // under another.
  useEffect(() => {
    reset();
  }, [address, walletType, reset]);

  return { payments, hasMore, status, error, load, loadMore, reset };
}
