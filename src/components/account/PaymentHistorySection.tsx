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
  Download,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePaymentHistory, type PaymentHistoryItem } from '@/hooks/usePaymentHistory';
import { wincPerCredit, tokenLabels, type SupportedTokenType } from '@/constants';
import { formatSmallestUnit } from '@/utils/jitPayment';
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
  // Top-ups are always positive credits, and PaymentRow renders a fixed "+" prefix,
  // so treat non-positive/invalid as "0.00" (avoids malformed output like "+-0.01").
  if (!Number.isFinite(c) || c <= 0) return '0.00';
  // A small top-up (< 0.01 credit) would round to a misleading "0.00" at two
  // decimals — widen the precision so the real amount still shows.
  if (c < 0.01) {
    return c.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  }
  return c.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Fiat `paymentAmount` is in the currency's minor unit (e.g. USD cents). */
function formatFiat(paymentAmount: string, currencyType: string): string {
  const major = Number(paymentAmount) / 100;
  // Manually-granted / promotional credits come through with no real charge
  // (e.g. 0.00 WINC via admin) — label them instead of showing a meaningless "0.00".
  if (!Number.isFinite(major) || major <= 0) return 'Credit grant';
  const currency = currencyType?.toUpperCase() || 'USD';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}

/** USD equivalent for a crypto top-up — never a misleading "≈ $0.00"; null = omit. */
function formatUsdEquiv(usdEquivalent: string): string | null {
  const n = Number(usdEquivalent);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 0.01) return '≈ <$0.01';
  return `≈ $${n.toFixed(2)}`;
}

/** Crypto `tokenQuantity` is in smallest units; exact human amount (capped for display). */
function formatCryptoAmount(tokenQuantity: string, tokenType: string): string {
  const label = tokenLabels[tokenType as SupportedTokenType] ?? tokenType.toUpperCase();
  const amount = formatSmallestUnit(tokenQuantity, tokenType as SupportedTokenType, 6);
  return amount == null ? label : `${amount} ${label}`;
}

// ---- CSV export --------------------------------------------------------------

/** Quote every cell (doubling internal quotes) so commas/quotes/newlines are safe. */
function csvCell(value: string | number): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

/** Format a numeric field for the CSV, leaving invalid input blank rather than "NaN". */
function csvNum(value: number, digits?: number): string {
  if (!Number.isFinite(value)) return '';
  return digits === undefined ? String(value) : value.toFixed(digits);
}

/**
 * Build a CSV from the loaded top-up rows. Exports what's loaded (see the button title).
 * Note: the token Amount uses the same `fromSmallestUnit` conversion as the on-screen
 * display; the accounting columns (USD Value, Credits) are computed independently and
 * blanked when a value isn't finite.
 */
function buildTopupCsv(payments: PaymentHistoryItem[]): string {
  const header = ['Date', 'Method', 'Amount', 'USD Value', 'Credits', 'Reference'];
  const rows = payments.map((p) => {
    const credits = csvNum(Number(p.wincCredited) / wincPerCredit);
    if (p.type === 'crypto') {
      const label = tokenLabels[p.tokenType as SupportedTokenType] ?? p.tokenType.toUpperCase();
      // Full precision (no digit cap) — the CSV is for accounting, so keep it exact.
      const v = formatSmallestUnit(p.tokenQuantity, p.tokenType as SupportedTokenType);
      const amount = v == null ? label : `${v} ${label}`;
      return [p.date, 'Crypto', amount, csvNum(Number(p.usdEquivalent), 2), credits, p.transactionId];
    }
    const currency = (p.currencyType || 'USD').toUpperCase();
    const native = csvNum(Number(p.paymentAmount) / 100, 2);
    // usdEquivalent isn't provided for fiat, so only fill USD Value when the charge is USD.
    const usd = currency === 'USD' ? native : '';
    return [p.date, 'Card', native ? `${native} ${currency}` : currency, usd, credits, p.receiptId];
  });
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

function downloadTopupCsv(payments: PaymentHistoryItem[]): void {
  const blob = new Blob([buildTopupCsv(payments)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'turbo-topup-history.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
          {isCrypto ? (
            formatUsdEquiv(item.usdEquivalent) && (
              <span className="text-xs text-foreground/60">{formatUsdEquiv(item.usdEquivalent)}</span>
            )
          ) : (
            <span className="text-xs text-foreground/60">via {item.paymentProvider || 'card'}</span>
          )}
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
      <div className="flex flex-wrap items-center gap-3 p-4 sm:p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/20 bg-foreground/20">
          <Receipt className="h-5 w-5 text-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground">Top-up History</h3>
          <p className="text-sm text-foreground/80">Every credit purchase you’ve made</p>
        </div>
        {(status === 'loaded' || status === 'loadingMore') && payments.length > 0 && (
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => downloadTopupCsv(payments)}
              title="Export loaded top-up history as CSV"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/20 bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-card"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
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

      {/* List — bounded height so a long history scrolls inside the card rather
          than growing the whole page. */}
      {(status === 'loaded' || status === 'loadingMore') && payments.length > 0 && (
        <div className="px-4 pb-4 sm:px-6">
          {/* pr-2 keeps the scrollbar from crowding the credits/tx column */}
          <div className="max-h-[28rem] overflow-y-auto pr-2">
            {payments.map((item, i) => (
              <PaymentRow key={`${item.type}-${item.date}-${i}`} item={item} />
            ))}
          </div>

          {error && <p className="pt-3 text-center text-xs text-error">{error}</p>}

          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={loadMore}
                disabled={status === 'loadingMore'}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border/20 bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 disabled:cursor-not-allowed"
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
