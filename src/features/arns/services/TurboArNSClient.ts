import {
  TokenType,
  TurboFactory,
  TurboUnauthenticatedClient,
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
    paymentAmount: number;
    quotedPaymentAmount: string;
    adjustments: Array<unknown>;
    fees: Array<unknown>;
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
export type SolanaWalletAdapter = {
  publicKey: unknown;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction?: unknown;
};




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
  }: {
    name: string;
    intent?: TurboArNSIntent;
    type?: 'lease' | 'permabuy';
    years?: number;
    increaseQty?: number;
  }): Promise<TurboArNSIntentPriceResponse> {
    const turbo = this.unauthenticated('solana');
    const domain = lowerCaseDomain(name);

    // `getArNSPriceForName` takes a discriminated union keyed on `intent`; build
    // the intent-specific param object so each carries only its valid fields
    // (Extend needs years, Increase needs increaseQty, Upgrade needs neither).
    let params: Record<string, unknown>;
    switch (intent) {
      case 'Extend-Lease':
        params = { intent, name: domain, years };
        break;
      case 'Increase-Undername-Limit':
        params = { intent, name: domain, increaseQty };
        break;
      case 'Upgrade-Name':
        params = { intent, name: domain };
        break;
      case 'Buy-Name':
      default:
        params = {
          intent,
          name: domain,
          ...(type ? { type } : {}),
          ...(type === 'lease' && years ? { years } : {}),
        };
    }

    const price = await turbo.getArNSPriceForName(
      params as Parameters<typeof turbo.getArNSPriceForName>[0],
    );
    return price as TurboArNSIntentPriceResponse;
  }

  /** Poll target for a submitted purchase (`GET /v1/arns/purchase/:nonce`). */
  public async getIntentStatus(nonce: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.paymentUrl}/v1/arns/purchase/${nonce}`, {
      method: 'GET',
    });
    return res.json();
  }

}
