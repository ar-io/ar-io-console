import { useMemo, type ReactNode } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { getStripePromise } from '@/services/paymentService';

/**
 * Scopes the Stripe `<Elements>` context to the payment surfaces that actually
 * need it (the Top-Up / fiat panels). Previously `<Elements>` wrapped the whole
 * app in `WalletProviders`, which ran `loadStripe()` at module-eval time and
 * injected `js.stripe.com/v3` on EVERY page — including the logged-out homepage.
 * Mounting the provider only here (both consumers are lazy-loaded route panels)
 * keeps Stripe.js off the initial/critical path until a payment surface opens.
 *
 * `getStripePromise()` caches the promise per Stripe key, so this is safe to
 * mount in more than one place.
 */
export default function StripeElementsProvider({ children }: { children: ReactNode }) {
  const stripe = useMemo(() => getStripePromise(), []);
  return <Elements stripe={stripe}>{children}</Elements>;
}
