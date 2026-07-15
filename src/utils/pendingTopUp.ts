const STORAGE_KEY = 'pendingTopUpTransactions';

export interface PendingTopUpTx {
  txId: string;
  tokenType: string;
  amount: number;
  timestamp: number;
}

// Max age before a pending TX is considered stale and auto-cleaned (7 days)
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function savePendingTopUpTx(tx: PendingTopUpTx): void {
  const existing = getPendingTopUpTxs();
  // Don't duplicate
  if (existing.some((t) => t.txId === tx.txId)) return;
  existing.push(tx);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function getPendingTopUpTxs(): PendingTopUpTx[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    const txs: PendingTopUpTx[] = parsed.filter(
      (tx: any) => tx && typeof tx.txId === 'string' && typeof tx.timestamp === 'number',
    );
    // Auto-clean stale entries
    const now = Date.now();
    const fresh = txs.filter((tx) => now - tx.timestamp < MAX_AGE_MS);
    if (fresh.length !== parsed.length) {
      if (fresh.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      }
    }
    return fresh;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

export function removePendingTopUpTx(txId: string): void {
  const txs = getPendingTopUpTxs().filter((tx) => tx.txId !== txId);
  if (txs.length === 0) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(txs));
  }
}
