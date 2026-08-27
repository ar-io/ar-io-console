import {
  ArNSFiatPurchaseQuoteResponse,
  ArNSPurchaseResponse,
  Currency,
  SolanaWalletAdapter as TurboSolanaWalletAdapter,
  TurboArNSNamesResponse,
  TokenType,
  TurboFactory,
  TurboUnauthenticatedClient,
  TurboAuthenticatedClient,
} from '@ardrive/turbo-sdk/web';

import { lowerCaseDomain } from '../utils';

/**
 * TurboArNSClient — read-only access to the bundler's ArNS surface.
 *
 * Framework-agnostic (plain `fetch` + turbo-sdk), holds no React state.
 *
 * **Scope, deliberately narrow.** This file once carried a full credit-settlement
 * layer ported from arns-react — `executeArNSIntent`, an authenticated purchase
 * client, submit + poll + error mapping. It was complete, plausible, and had
 * **zero callers**: buying actually goes through `@ar.io/sdk`'s atomic
 * `buyRecord` (see `useBuyArNSName`), and fiat purchases will go through
 * turbo-sdk's quote endpoint. It was removed rather than left as a third,
 * untested way to buy a name.
 *
 * What survives is what is used:
 *  - `getArNSPrice` — live, drives `useArNSPrice` for all four intents.
 *  - `getIntentStatus` — the one-shot status read. Its polling loop was the
 *    salvageable part of the deleted layer and now lives, tested, in
 *    `purchase/pollPurchase.ts`; this method is its transport.
 *
 * If you are about to add a purchase method here, check first whether it
 * belongs in turbo-sdk instead — the settlement endpoints are Turbo's, and a
 * client that duplicates them is how the last one became dead code.
 */

/** ArNS purchase intents settleable with credits (Phase 1 wires Buy-Name). */
export type TurboArNSIntent =
  | 'Buy-Name'
  | 'Extend-Lease'
  | 'Increase-Undername-Limit'
  | 'Upgrade-Name';

export interface TurboArNSClientConfig {
  paymentUrl: string;
  uploadUrl: string;
  gatewayUrl: string;
}

/** Price response for an ArNS intent (`GET /v1/arns/price/:intent/:name`). */
export type TurboArNSIntentPriceResponse = {
  mARIO: string;
  winc: string;
  fiatEstimate?: {
    /** Name price incl. the Turbo infra fee, in the currency's smallest unit. */
    paymentAmount: number;
    quotedPaymentAmount: string;
    adjustments: Array<unknown>;
    fees: Array<unknown>;
    /**
     * SOL rent for spawning a Turbo-owned ANT, recovered as a surcharge. The
     * infra fee deliberately does NOT apply to it — it is cost recovery, not
     * revenue. Present only for intents that can provision (Buy-Name).
     */
    antSpawnSurchargeAmount?: number;
    /** `paymentAmount` + the surcharge — what a CUSTODIAL card buy costs. */
    paymentAmountWithAntSpawn?: number;
  };
};





export type ArNSSettlementResult = {
  /** UUID nonce used for the purchase (idempotency + status key). */
  nonce: string;
  /** Solana tx id of the on-chain ArNS write. Drives success UI. */
  messageId: string;
  /** The terminal purchase record from the status endpoint. */
  receipt: Record<string, unknown>;
};

/**
 * The Solana wallet adapter console feeds the authed turbo client. Matches the
 * `{ publicKey, signMessage, signTransaction }` object console already builds
 * for uploads/shares from `useWallet()`.
 */
/**
 * Re-export of the SDK's adapter type rather than a looser local shape.
 *
 * The local version typed `publicKey` as `unknown`, so anything built against
 * it needed a cast to reach `TurboFactory.authenticated` — and a cast on a
 * money path is exactly where a wrong argument hides. Aliasing the real type
 * makes a mismatch a build error.
 */
export type SolanaWalletAdapter = TurboSolanaWalletAdapter;




export class TurboArNSClient {
  public readonly paymentUrl: string;
  public readonly uploadUrl: string;
  public readonly gatewayUrl: string;

  constructor({ paymentUrl, uploadUrl, gatewayUrl }: TurboArNSClientConfig) {
    this.paymentUrl = paymentUrl;
    this.uploadUrl = uploadUrl;
    this.gatewayUrl = gatewayUrl;
  }

  /** Unauthenticated turbo client for read-only calls (pricing). */
  private unauthenticated(
    tokenType: TokenType = 'solana',
  ): TurboUnauthenticatedClient {
    return TurboFactory.unauthenticated({
      paymentServiceConfig: { url: this.paymentUrl },
      uploadServiceConfig: { url: this.uploadUrl },
      gatewayUrl: this.gatewayUrl,
      token: tokenType,
    });
  }

  /**
   * Live price for an ArNS intent, in winc (credits) + mARIO. Uses the SDK's
   * `getArNSPriceForName` (proven in the spike smoke) rather than a hand-rolled
   * fetch, so signing/headers stay correct. The bundler's `/v1/arns/price`
   * route treats the signature as optional, so this needs no wallet.
   */
  public async getArNSPrice({
    name,
    intent = 'Buy-Name',
    type,
    years,
    increaseQty,
    currency,
  }: {
    name: string;
    intent?: TurboArNSIntent;
    type?: 'lease' | 'permabuy';
    years?: number;
    increaseQty?: number;
    /**
     * Ask for the bundler's `fiatEstimate` alongside the winc price.
     *
     * Worth the extra plumbing because the two numbers are NOT the same price.
     * `winc` is computed with `feeMode: "none"`, while both the fiat estimate
     * and the real card quote use `feeMode: "invert"` — the infra fee added on
     * top. Deriving USD from `winc` therefore under-quotes what a card charges.
     *
     * Sent by hand: the SDK's query builder whitelists
     * type/years/increaseQty/processId/paidBy and silently drops `currency`, so
     * `getArNSPriceForName` can never surface this field.
     */
    currency?: string;
  }): Promise<TurboArNSIntentPriceResponse> {
    const params = intentParams({ name, intent, type, years, increaseQty });

    if (currency) {
      const query = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (k !== 'intent' && k !== 'name' && v !== undefined) {
          query.set(k, String(v));
        }
      }
      query.set('currency', currency);
      const url =
        `${this.paymentUrl}/v1/arns/price/${encodeURIComponent(intent.toLowerCase())}` +
        `/${encodeURIComponent(String(params.name))}?${query.toString()}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`ArNS price lookup failed (${res.status})`);
      }
      return (await res.json()) as TurboArNSIntentPriceResponse;
    }

    const turbo = this.unauthenticated('solana');

    const price = await turbo.getArNSPriceForName(
      params as Parameters<typeof turbo.getArNSPriceForName>[0],
    );
    return price as TurboArNSIntentPriceResponse;
  }

  /**
   * Quote a **fiat (card) purchase** — the one-step card → name path.
   *
   * Distinct from `getArNSPrice`, which prices the purchase in credits/mARIO.
   * This records a quote server-side and returns a Stripe PaymentIntent to
   * confirm against; the resulting `nonce` is what settlement is polled by. The
   * route needs no signature (`address` is a path param), so it runs on the
   * unauthenticated client like pricing does.
   *
   * Throws on `503` when fiat is switched off service-side — a normal state in
   * the testnet sandbox. Callers classify with `classifyQuoteError` and degrade
   * to the credit paths rather than reporting a fault.
   */
  public async getFiatQuote({
    name,
    address,
    currency = 'usd',
    intent = 'Buy-Name',
    type,
    years,
    increaseQty,
    promoCodes,
  }: {
    name: string;
    address: string;
    currency?: Currency;
    intent?: TurboArNSIntent;
    type?: 'lease' | 'permabuy';
    years?: number;
    increaseQty?: number;
    promoCodes?: string[];
  }): Promise<ArNSFiatPurchaseQuoteResponse> {
    const turbo = this.unauthenticated('solana');
    const params = {
      ...intentParams({ name, intent, type, years, increaseQty }),
      address,
      currency,
      // A PaymentIntent yields a client_secret we can confirm inline, keeping
      // the user on the checkout instead of redirecting to a hosted page.
      method: 'payment-intent' as const,
      ...(promoCodes?.length ? { promoCodes } : {}),
    };
    return turbo.getArNSFiatPurchaseQuote(
      params as Parameters<typeof turbo.getArNSFiatPurchaseQuote>[0],
    );
  }

  /**
   * Settle an ArNS intent against the signer's TURBO CREDIT balance.
   *
   * This is the only way to spend credits. `@ar.io/sdk`'s Solana writes accept
   * `fundFrom: 'turbo'` and then ignore it — every branch treats it as
   * `'balance'` and debits the wallet's ARIO — so routing a credits purchase
   * through `buyRecord` charged the wrong asset entirely.
   *
   * `processId` matters for a Buy: supplied, the name is assigned to an ANT the
   * user already owns; omitted, the bundler provisions a TURBO-OWNED one. Only
   * the deliberately-custodial card path wants the latter.
   */
  public async purchaseWithCredits({
    walletAdapter,
    client,
    name,
    intent = 'Buy-Name',
    type,
    years,
    increaseQty,
    processId,
    paidBy,
  }: {
    /**
     * Typed against the SDK's own adapter rather than this file's looser
     * local alias — a cast here would silence the compiler on a call that
     * spends money.
     */
    walletAdapter?: TurboSolanaWalletAdapter;
    /**
     * A client already authenticated as the payer. Preferred.
     *
     * The service identifies the payer from the request SIGNATURE — its
     * middleware accepts Arweave, Ethereum, Solana and ED25519 — and debits
     * that identity's credits. Building a Solana client here regardless meant
     * an Arweave or Ethereum holder could not spend their own credits on a
     * name they own, which is every custodial buyer.
     */
    client?: TurboAuthenticatedClient;
    name: string;
    intent?: TurboArNSIntent;
    type?: 'lease' | 'permabuy';
    years?: number;
    increaseQty?: number;
    /** User-owned ANT for a Buy. Omit ONLY when Turbo should custody it. */
    processId?: string;
    paidBy?: string | string[];
  }): Promise<ArNSPurchaseResponse> {
    if (!client && !walletAdapter) {
      throw new Error(
        'purchaseWithCredits needs either an authenticated client or a Solana wallet adapter.',
      );
    }
    const turbo =
      client ??
      TurboFactory.authenticated({
        token: 'solana',
        walletAdapter: walletAdapter as TurboSolanaWalletAdapter,
        paymentServiceConfig: { url: this.paymentUrl },
        uploadServiceConfig: { url: this.uploadUrl },
        gatewayUrl: this.gatewayUrl,
      });
    const params = {
      ...intentParams({ name, intent, type, years, increaseQty }),
      ...(processId ? { processId } : {}),
      ...(paidBy ? { paidBy } : {}),
    };
    return turbo.purchaseArNSName(
      params as Parameters<typeof turbo.purchaseArNSName>[0],
    );
  }

  /**
   * Names this address PURCHASED through Turbo, each flagged `custodial`.
   *
   * The only way to discover a Turbo-held name. A custodial ANT is owned by
   * Turbo on-chain, so `getArNSRecordsForAddress` — which returns Owned union
   * Controlled for the *user's* address — cannot see it at all. Without this,
   * the name a card purchase just bought is invisible in the console.
   *
   * Receipt history, not a live ownership check: absence proves nothing (the
   * name may have been bought elsewhere), and `custodial: false` covers both a
   * self-custody purchase and one since transferred out.
   *
   * Open by address, no signature — same as `/v1/account/balance`.
   */
  public async getTurboNames(address: string): Promise<TurboArNSNamesResponse> {
    const turbo = this.unauthenticated('solana');
    return turbo.getArNSNames(address);
  }

  /**
   * Poll target for a submitted purchase (`GET /v1/arns/purchase/:nonce`).
   *
   * Uses the SDK method rather than a raw fetch so a non-2xx becomes a thrown
   * error instead of a parsed error *body* that the poller would read as a
   * status record — a 404 shaped like `{error}` has no `messageId` and no
   * `failedDate`, so it would look like "still pending" forever.
   */
  public async getIntentStatus(nonce: string): Promise<Record<string, unknown>> {
    const turbo = this.unauthenticated('solana');
    const status = await turbo.getArNSPurchaseStatus({ nonce });
    return status as unknown as Record<string, unknown>;
  }

}

/**
 * Build the intent-specific half of a params object.
 *
 * `getArNSPriceForName` and `getArNSFiatPurchaseQuote` take the SAME
 * discriminated union keyed on `intent`, where each branch carries only its own
 * fields (Extend needs years, Increase needs increaseQty, Upgrade needs
 * neither). Shared so the price a user is shown and the quote they are charged
 * can never be built from different rules.
 */
function intentParams({
  name,
  intent,
  type,
  years,
  increaseQty,
}: {
  name: string;
  intent: TurboArNSIntent;
  type?: 'lease' | 'permabuy';
  years?: number;
  increaseQty?: number;
}): Record<string, unknown> {
  const domain = lowerCaseDomain(name);
  switch (intent) {
    case 'Extend-Lease':
      return { intent, name: domain, years };
    case 'Increase-Undername-Limit':
      return { intent, name: domain, increaseQty };
    case 'Upgrade-Name':
      return { intent, name: domain };
    case 'Buy-Name':
    default:
      return {
        intent,
        name: domain,
        ...(type ? { type } : {}),
        // Permabuy must OMIT years entirely — sending it is rejected.
        ...(type === 'lease' && years ? { years } : {}),
      };
  }
}
