import {
  Receipt,
  CreditCard,
  Coins,
  ExternalLink,
  Gift,
  ShieldCheck,
  Loader2,
  RefreshCw,
  Inbox,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePaymentHistory, type PaymentHistoryItem } from '@/hooks/usePaymentHistory';
import { wincPerCredit, tokenLabels, type SupportedTokenType } from '@/constants';
import { fromSmallestUnit } from '@/utils/jitPayment';
import { getExplorerTxUrl } from '@/utils/getExplorerTxUrl';
import CopyButton from '@/components/CopyButton';

// ---- formatting helpers ------------------------------------------------------

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

function formatCredits(wincCredited: string): string {
  const c = Number(wincCredited) / wincPerCredit;
  if (!Number.isFinite(c)) return '0.00';
  return c.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Fiat `paymentAmount` is in the currency's minor unit (e.g. USD cents). */
function formatFiat(paymentAmount: string, currencyType: string): string {
  const major = Number(paymentAmount) / 100;
  const currency = currencyType?.toUpperCase() || 'USD';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}

/** Crypto `tokenQuantity` is in smallest units; best-effort human amount. */
function formatCryptoAmount(tokenQuantity: string, tokenType: string): string {
  const label = tokenLabels[tokenType as SupportedTokenType] ?? tokenType.toUpperCase();
  let human: number | null = null;
  try {
    const v = fromSmallestUnit(Number(tokenQuantity), tokenType as SupportedTokenType);
    if (Number.isFinite(v)) human = v;
  } catch {
    /* unknown token decimals — fall back to the label + USD equivalent only */
  }
  if (human == null) return label;
  return `${human.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${label}`;
}

// ---- row ---------------------------------------------------------------------

function PaymentRow({ item }: { item: PaymentHistoryItem }) {
  const isCrypto = item.type === 'crypto';
  const credits = formatCredits(item.wincCredited);
  const explorerUrl = isCrypto ? getExplorerTxUrl(item.transactionId, item.tokenType) : null;

  return (
    <div className="flex items-start justify-between gap-4 border-t border-border/20 py-4">
      {/* what + when */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1 rounded-full border border-border/20 bg-background px-2 py-0.5 text-xs font-medium text-foreground/80">
            {isCrypto ? (
              <Coins className="h-3 w-3 text-primary" />
            ) : (
              <CreditCard className="h-3 w-3 text-primary" />
            )}
            {isCrypto ? 'Crypto' : 'Card'}
          </span>
          <span className="font-medium text-foreground tabular-nums">
            {isCrypto
              ? formatCryptoAmount(item.tokenQuantity, item.tokenType)
              : formatFiat(item.paymentAmount, item.currencyType)}
          </span>
          <span className="text-xs text-foreground/60">
            {isCrypto
              ? `≈ $${Number(item.usdEquivalent).toFixed(2)}`
              : `via ${item.paymentProvider || 'card'}`}
          </span>
        </div>

        {!isCrypto && item.giftMessage && (
          <div className="mb-1 flex items-center gap-1.5 text-xs italic text-foreground/80">
            <Gift className="h-3 w-3 flex-shrink-0 not-italic text-primary" />
            <span className="truncate">“{item.giftMessage}”</span>
          </div>
        )}

        <div className="text-xs text-foreground/60">{formatDateTime(item.date)}</div>
      </div>

      {/* credits + reference */}
      <div className="flex-shrink-0 text-right">
        <div className="font-semibold tabular-nums text-success">+{credits}</div>
        <div className="text-[10px] uppercase tracking-wider text-foreground/60">credits</div>

        <div className="mt-1.5 text-xs">
          {isCrypto ? (
            explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-primary hover:underline"
                title={item.transactionId}
              >
                {item.transactionId.slice(0, 6)}…{item.transactionId.slice(-4)}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="font-mono text-foreground/60" title={item.transactionId}>
                {item.transactionId.slice(0, 6)}…{item.transactionId.slice(-4)}
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1 font-mono text-foreground/60">
              <span title={item.receiptId}>
                {item.receiptId.slice(0, 8)}…
              </span>
              <CopyButton textToCopy={item.receiptId} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- section -----------------------------------------------------------------

export default function PaymentHistorySection() {
  const navigate = useNavigate();
  const { payments, hasMore, status, error, load, loadMore } = usePaymentHistory();

  return (
    <div className="rounded-2xl border border-border/20 bg-card">
      {/* Header (matches CreditSharingSection) */}
      <div className="flex items-center gap-3 p-4 sm:p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/20 bg-foreground/20">
          <Receipt className="h-5 w-5 text-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground">Top-up History</h3>
          <p className="text-sm text-foreground/80">Every credit purchase you’ve made</p>
        </div>
        {status === 'loaded' && payments.length > 0 && (
          <span className="ml-auto text-xs text-foreground/60">Newest first</span>
        )}
      </div>

      {/* Opt-in */}
      {status === 'idle' && (
        <div className="px-4 pb-6 text-center sm:px-6">
          <p className="mx-auto mb-4 max-w-md text-sm text-foreground/80">
            See every credit top-up on this wallet — crypto and card — in one place.
          </p>
          <button
            onClick={load}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Receipt className="h-4 w-4" />
            View my top-up history
          </button>
          <div className="mx-auto mt-4 flex max-w-md items-start gap-2 rounded-xl border border-border/20 bg-background p-3 text-left text-xs text-foreground/80">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            <span>
              Requires a wallet signature so the service can confirm it’s you.{' '}
              <span className="font-medium text-foreground">Nothing is sent on-chain</span> and no
              fee is charged.
            </span>
          </div>
        </div>
      )}

      {/* Loading (first page) */}
      {status === 'loading' && (
        <div className="px-4 pb-4 sm:px-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4 border-t border-border/20 py-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-40 animate-pulse rounded bg-foreground/10" />
                <div className="h-3 w-28 animate-pulse rounded bg-foreground/10" />
              </div>
              <div className="h-5 w-16 animate-pulse rounded bg-foreground/10" />
            </div>
          ))}
          <div className="flex items-center justify-center gap-2 pt-4 text-sm text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading your history…
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="px-4 pb-6 text-center sm:px-6">
          <p className="mb-4 text-sm text-error">{error}</p>
          <button
            onClick={load}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-foreground bg-transparent px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/5"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      )}

      {/* Empty */}
      {(status === 'loaded' || status === 'loadingMore') && payments.length === 0 && (
        <div className="px-4 pb-8 pt-2 text-center sm:px-6">
          <Inbox className="mx-auto mb-3 h-10 w-10 text-foreground/30" />
          <h4 className="mb-1 font-bold text-foreground">No top-ups yet</h4>
          <p className="mx-auto mb-4 max-w-xs text-sm text-foreground/80">
            Credit purchases you make will show up here.
          </p>
          <button
            onClick={() => navigate('/topup')}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Buy Credits
          </button>
        </div>
      )}

      {/* List */}
      {(status === 'loaded' || status === 'loadingMore') && payments.length > 0 && (
        <div className="px-4 pb-4 sm:px-6">
          {payments.map((item, i) => (
            <PaymentRow key={`${item.type}-${item.date}-${i}`} item={item} />
          ))}

          {error && <p className="pt-3 text-center text-xs text-error">{error}</p>}

          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={loadMore}
                disabled={status === 'loadingMore'}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border/20 bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'loadingMore' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Load more
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
