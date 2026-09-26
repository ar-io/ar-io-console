import { useEffect, useState } from 'react';

import type { TokenBalanceResult } from '../../hooks/useTokenBalance';

/**
 * A `useTokenBalance` result as the payment picker needs it: a known balance,
 * or `undefined` while it is not.
 *
 * `useTokenBalance` starts at `{ balance: 0, loading: false }` and only flips
 * `loading` once its effect has run, so for the first render an unread
 * balance is indistinguishable from an empty wallet. That is harmless for a
 * label and wrong for a decision: a one-time preselection taken on that frame
 * would treat every row as empty and lock in the fallback. So a read counts as
 * settled only once it has been seen loading for this `readKey`, or has
 * failed.
 *
 * `readKey` identifies the read (wallet and token); `null` means none is
 * running, and nothing is reported.
 */
export function useBalanceRead(
  result: TokenBalanceResult,
  readKey: string | null,
): { balance: number | undefined; loading: boolean } {
  const [startedFor, setStartedFor] = useState<string | null>(null);
  useEffect(() => {
    if (readKey && result.loading) setStartedFor(readKey);
  }, [readKey, result.loading]);

  if (!readKey) return { balance: undefined, loading: false };
  // A failed read is settled, and unknown: it never reads as zero.
  if (result.error) return { balance: undefined, loading: false };
  if (startedFor !== readKey || result.loading) {
    return { balance: undefined, loading: true };
  }
  return { balance: result.balance, loading: false };
}
