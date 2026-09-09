import type { PaymentHistoryItem } from '@/hooks/usePaymentHistory';

/**
 * What a payment row is, tolerating kinds this build has never heard of.
 *
 * The SDK types the history as a closed union of `'crypto' | 'fiat'`, and the
 * row renderer trusted it: `isCrypto = item.type === 'crypto'`, with everything
 * else falling into the fiat branch and reading `receiptId`. A row that is
 * neither — a kind the service added, or one missing its reference — therefore
 * hit `undefined.slice(0, 8)`, and because a throw during render unmounts the
 * route, ONE unrecognised payment took down the whole Account page.
 *
 * A closed union is a promise about a payload we do not control. This treats it
 * as the open set it actually is.
 */
export type PaymentKind = 'crypto' | 'fiat' | 'unknown';

export function paymentKind(item: PaymentHistoryItem): PaymentKind {
  const type = (item as { type?: unknown }).type;
  return type === 'crypto' || type === 'fiat' ? type : 'unknown';
}

export interface PaymentReference {
  /** `tx` links to an explorer; `receipt` is copyable but not linkable. */
  kind: 'tx' | 'receipt';
  value: string;
}

/**
 * The row's reference, read from the DATA rather than inferred from `type`.
 *
 * Deriving it from the payload is the actual fix: a crypto row missing its
 * `transactionId` and an unknown row missing everything both now resolve to
 * `null` and render nothing, instead of slicing undefined.
 */
export function paymentReference(
  item: PaymentHistoryItem,
): PaymentReference | null {
  const row = item as { transactionId?: unknown; receiptId?: unknown };
  if (typeof row.transactionId === 'string' && row.transactionId !== '') {
    return { kind: 'tx', value: row.transactionId };
  }
  if (typeof row.receiptId === 'string' && row.receiptId !== '') {
    return { kind: 'receipt', value: row.receiptId };
  }
  return null;
}

/** `abc123…7f9`, or the whole string when it is already short. */
export function shortReference(value: string): string {
  return value.length <= 12 ? value : `${value.slice(0, 6)}…${value.slice(-4)}`;
}

type CryptoRow = Extract<PaymentHistoryItem, { type: 'crypto' }>;
type FiatRow = Extract<PaymentHistoryItem, { type: 'fiat' }>;

/*
  Type guards rather than a bare string compare, so the narrowing the union
  provides is not lost. Reading `item.tokenType` still has to be gated on the
  row actually BEING a crypto row — the tolerance added here is about not
  crashing on kinds we do not know, not about reading fields off them.
*/
export function isCryptoPayment(item: PaymentHistoryItem): item is CryptoRow {
  return paymentKind(item) === 'crypto';
}

export function isFiatPayment(item: PaymentHistoryItem): item is FiatRow {
  return paymentKind(item) === 'fiat';
}
