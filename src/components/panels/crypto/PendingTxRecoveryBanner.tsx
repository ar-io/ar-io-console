import { useState, useEffect } from 'react';
import { TurboFactory } from '@ardrive/turbo-sdk/web';
import { AlertTriangle, RefreshCw, X, ExternalLink } from 'lucide-react';
import { getPendingTopUpTxs, removePendingTopUpTx, PendingTopUpTx } from '../../../utils/pendingTopUp';
import { tokenLabels, SupportedTokenType } from '../../../constants';
import { useTurboConfig } from '../../../hooks/useTurboConfig';
import CopyButton from '../../CopyButton';

export default function PendingTxRecoveryBanner() {
  const [pendingTxs, setPendingTxs] = useState<PendingTopUpTx[]>([]);
  const [retryingTxId, setRetryingTxId] = useState<string | null>(null);
  const [retryMessages, setRetryMessages] = useState<Record<string, string>>({});
  const turboConfig = useTurboConfig();

  useEffect(() => {
    setPendingTxs(getPendingTopUpTxs());
  }, []);

  if (pendingTxs.length === 0) return null;

  const handleRetry = async (tx: PendingTopUpTx) => {
    setRetryingTxId(tx.txId);
    setRetryMessages((prev) => ({ ...prev, [tx.txId]: 'Submitting transaction to ar.io...' }));

    try {
      const turbo = TurboFactory.unauthenticated({
        ...turboConfig,
        token: tx.tokenType as any,
      });

      const response = await turbo.submitFundTransaction({ txId: tx.txId });

      if (response.status === 'failed') {
        setRetryMessages((prev) => ({
          ...prev,
          [tx.txId]: 'Transaction not confirmed yet on-chain. Please wait a few minutes and try again.',
        }));
      } else {
        removePendingTopUpTx(tx.txId);
        setPendingTxs((prev) => prev.filter((t) => t.txId !== tx.txId));
        setRetryMessages((prev) => {
          const next = { ...prev };
          delete next[tx.txId];
          return next;
        });
        window.dispatchEvent(new CustomEvent('refresh-balance'));
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        setRetryMessages((prev) => ({
          ...prev,
          [tx.txId]: 'Transaction not found on-chain yet. Please wait 1-2 minutes and try again.',
        }));
      } else {
        setRetryMessages((prev) => ({ ...prev, [tx.txId]: `Retry failed: ${errorMessage}` }));
      }
    } finally {
      setRetryingTxId(null);
    }
  };

  const handleDismiss = (txId: string) => {
    removePendingTopUpTx(txId);
    setPendingTxs((prev) => prev.filter((t) => t.txId !== txId));
    setRetryMessages((prev) => {
      const next = { ...prev };
      delete next[txId];
      return next;
    });
  };

  const getExplorerUrl = (tx: PendingTopUpTx): string | null => {
    switch (tx.tokenType) {
      case 'ethereum':
      case 'usdc':
        return `https://etherscan.io/tx/${tx.txId}`;
      case 'base-eth':
      case 'base-usdc':
      case 'base-ario':
        return `https://basescan.org/tx/${tx.txId}`;
      case 'pol':
      case 'polygon-usdc':
        return `https://polygonscan.com/tx/${tx.txId}`;
      case 'solana':
        return `https://solscan.io/tx/${tx.txId}`;
      case 'arweave':
      case 'ario':
        return `https://viewblock.io/arweave/tx/${tx.txId}`;
      default:
        return null;
    }
  };

  const formatAge = (timestamp: number): string => {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="mb-4 sm:mb-6 space-y-3">
      {pendingTxs.map((tx) => {
        const explorerUrl = getExplorerUrl(tx);
        const tokenLabel =
          tokenLabels[tx.tokenType as SupportedTokenType] || tx.tokenType;

        return (
          <div
            key={tx.txId}
            className="bg-warning/10 border border-warning/20 rounded-2xl p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium text-foreground">
                    Pending {tokenLabel} Top-Up
                  </div>
                  <button
                    onClick={() => handleDismiss(tx.txId)}
                    className="p-1 text-foreground/30 hover:text-foreground/60 transition-colors flex-shrink-0"
                    title="Dismiss (transaction ID will be lost)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-foreground/80 mt-1">
                  Your on-chain transaction was sent {formatAge(tx.timestamp)}{' '}
                  but credits weren't delivered. Retry to notify the ar.io
                  backend.
                </p>

                <div className="flex items-center gap-2 mt-2">
                  <code className="text-xs font-mono text-foreground/60 truncate">
                    {tx.txId.slice(0, 10)}...{tx.txId.slice(-8)}
                  </code>
                  <CopyButton textToCopy={tx.txId} />
                  {explorerUrl && (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-foreground/40 hover:text-primary transition-colors"
                      title="View on block explorer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {retryMessages[tx.txId] && (
                  <p className={`text-xs mt-2 ${retryingTxId === tx.txId ? 'text-foreground/60' : 'text-warning'}`}>
                    {retryMessages[tx.txId]}
                  </p>
                )}

                <button
                  onClick={() => handleRetry(tx)}
                  disabled={retryingTxId !== null}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${retryingTxId === tx.txId ? 'animate-spin' : ''}`}
                  />
                  {retryingTxId === tx.txId ? 'Retrying...' : 'Retry Submission'}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
