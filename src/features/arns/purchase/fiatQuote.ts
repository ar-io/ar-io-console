import type { ArNSFiatPurchaseQuote } from '@ardrive/turbo-sdk/web';

/**
 * Why a fiat quote could not be produced.
 *
 * These are not interchangeable: `disabled` is a normal service state that the
 * UI must degrade around (it is the default in the testnet sandbox), while
 * `invalid` is the user's input and belongs on the field. Collapsing both into
 * "something went wrong" is what turns a working sandbox into a bug report.
 */
export type QuoteFailure =
  | { kind: 'disabled' }
  | { kind: 'invalid'; message: string }
  | { kind: 'unavailable'; message: string };

interface Httpish {
  status?: number;
  response?: { status?: number; data?: unknown };
  message?: string;
}

export function classifyQuoteError(err: unknown): QuoteFailure {
  const e = (err ?? {}) as Httpish;
  const status = e.status ?? e.response?.status;
  const message = typeof e.message === 'string' ? e.message : String(err);

  // The route returns 503 with "Fiat (Stripe) ArNS payments are disabled" when
  // stripeEnabled is false. That is a configuration state, not a fault.
  if (status === 503 || /disabled/i.test(message)) return { kind: 'disabled' };
  if (status === 400) return { kind: 'invalid', message };
  return { kind: 'unavailable', message };
}

/** Milliseconds until the quote expires; negative once it has. */
export function msUntilExpiry(quote: Pick<ArNSFiatPurchaseQuote, 'quoteExpirationDate'>, now: number): number {
  const at = Date.parse(quote.quoteExpirationDate);
  // An unparseable expiry must not read as "expired an eternity ago" and nuke a
  // valid quote — treat it as no known deadline.
  return Number.isNaN(at) ? Number.POSITIVE_INFINITY : at - now;
}

export function isQuoteExpired(
  quote: Pick<ArNSFiatPurchaseQuote, 'quoteExpirationDate'>,
  now: number,
): boolean {
  return msUntilExpiry(quote, now) <= 0;
}

/**
 * Stripe will not process a charge below its per-currency minimum (about $0.50,
 * and Turbo's own floor is higher). A cheap name therefore gets charged MORE
 * than it costs, and the difference lands in the buyer's credit balance.
 *
 * That is fine — but only if we say so before charging. Silently taking $5 for
 * a $2 name is the kind of surprise that generates a chargeback.
 */
export function minimumChargeExcessWinc(quote: Pick<ArNSFiatPurchaseQuote, 'excessWincAmount'>): bigint {
  const raw = quote.excessWincAmount;
  if (raw == null || raw === '') return 0n;
  try {
    const v = BigInt(raw);
    return v > 0n ? v : 0n;
  } catch {
    return 0n;
  }
}

export function hasMinimumChargeExcess(quote: Pick<ArNSFiatPurchaseQuote, 'excessWincAmount'>): boolean {
  return minimumChargeExcessWinc(quote) > 0n;
}

/**
 * Fiat amounts arrive in the currency's smallest unit (cents). Zero-decimal
 * currencies (JPY, KRW) have no minor unit at all, so dividing by 100 there
 * would under-report the charge by 100x.
 */
const ZERO_DECIMAL = new Set(['jpy', 'krw', 'vnd', 'clp', 'isk', 'ugx', 'xaf', 'xof', 'xpf', 'bif', 'djf', 'gnf', 'kmf', 'mga', 'pyg', 'rwf', 'vuv']);

export function formatFiatAmount(smallestUnit: number, currency: string): string {
  const code = currency.toLowerCase();
  const zeroDecimal = ZERO_DECIMAL.has(code);
  const value = zeroDecimal ? smallestUnit : smallestUnit / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: zeroDecimal ? 0 : 2,
    }).format(value);
  } catch {
    // Unknown currency code — still show the number rather than nothing.
    return `${value.toFixed(zeroDecimal ? 0 : 2)} ${currency.toUpperCase()}`;
  }
}

/**
 * Whether the card can be confirmed client-side.
 *
 * `payment-intent` and an embedded checkout session both return a
 * `client_secret`; a hosted session returns a `url` to redirect to instead.
 * Confirming without a secret is not a recoverable error — it means we asked
 * for the wrong integration mode — so it is worth catching before Stripe is
 * handed a null.
 */
export function clientSecretOf(session: { client_secret?: string | null }): string | undefined {
  return session.client_secret ?? undefined;
}
