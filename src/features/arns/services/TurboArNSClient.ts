import {
  TokenType,
  TurboFactory,
  TurboUnauthenticatedClient,
} from '@ardrive/turbo-sdk/web';

import { lowerCaseDomain, sleep } from '../utils';

/**
 * TurboArNSClient — the reusable service that drives the bundler's credit-paid
 * ArNS surface. Ported from arns-react `src/services/turbo/TurboArNSClient.ts`
 * and adapted to console:
 *
 *  - Framework-agnostic (plain `fetch` + turbo-sdk); holds no React state.
 *  - Signers are INJECTED per call, not constructed from a wallet-connector
 *    façade. Console produces a Solana `walletAdapter` (`{ publicKey,
 *    signMessage, signTransaction }`) from `useWallet()`; that is passed in,
 *    mirroring console's own upload/share authed-client plumbing. arns-react
 *    instead read `window.solana` — the departure the task calls for.
 *  - Trimmed to Phase 1 scope: pricing + Buy-Name + status polling. The intent
 *    switch and the `AuthenticatedArNSPurchaseClient` interface already carry
 *    Extend / Increase-Undername / Upgrade so those slot in without reshaping
 *    the client; custodial transfer/manage (Model A) are intentionally omitted
 *    for now and can be added as sibling methods later.
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

/**
 * The subset of the turbo-sdk authenticated client used to settle an ArNS
 * purchase with credits. Declared structurally so it can be injected in tests
 * without standing up the whole SDK.
 */
export interface AuthenticatedArNSPurchaseClient {
  buyArNSName(params: {
    name: string;
    type?: 'lease' | 'permabuy';
    years?: number;
    /**
     * ANT the name resolves to. Required for Model B (user-owned ANT); OMITTED
     * for Model A (custodial) — the bundler provisions + custodies it.
     */
    processId?: string;
    paidBy?: string[];
  }): Promise<ArNSPurchaseResult>;
  extendArNSLease(params: {
    name: string;
    years: number;
    paidBy?: string[];
  }): Promise<ArNSPurchaseResult>;
  increaseArNSUndernameLimit(params: {
    name: string;
    increaseQty: number;
    paidBy?: string[];
  }): Promise<ArNSPurchaseResult>;
  upgradeArNSName(params: {
    name: string;
    paidBy?: string[];
  }): Promise<ArNSPurchaseResult>;
}

/** Shape returned by the turbo-sdk `*ArNSName`/`*ArNSLease` purchase methods. */
export type ArNSPurchaseResult = {
  /** UUID that is both the idempotency key and the status-lookup key. */
  nonce: string;
  purchaseReceipt?: { nonce: string; messageId?: string } & Record<
    string,
    unknown
  >;
  arioWriteResult?: { id: string };
};

/**
 * Progress phases emitted while settling a purchase so the UI can surface a
 * signing/polling message without echoing raw chain errors.
 */
export type ArNSSettlementPhase =
  | 'submitting'
  | 'submitted'
  | 'resumed'
  | 'polling'
  | 'success';

export type ArNSSettlementStatus = {
  phase: ArNSSettlementPhase;
  nonce?: string;
  messageId?: string;
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

export type ExecuteArNSIntentParams = {
  intent: TurboArNSIntent;
  name: string;
  type?: 'lease' | 'permabuy';
  years?: number;
  increaseQty?: number;
  /** ANT (Metaplex Core asset) the name resolves to — required for Buy-Name. */
  processId?: string;
  paidBy?: string[];
  /** Connected wallet's token type. Phase 1 supports `solana` (Model B). */
  tokenType?: TokenType;
  /** Solana wallet adapter used to build the authed client (Model B). */
  walletAdapter?: SolanaWalletAdapter;
  /** Inject a pre-built authenticated client (used by tests). */
  purchaseClient?: AuthenticatedArNSPurchaseClient;
  /**
   * Resume polling an already-submitted purchase (e.g. after a reload) instead
   * of submitting a fresh one. The nonce is the server-side idempotency key, so
   * resuming never risks a double debit.
   */
  resumeNonce?: string;
  onStatus?: (status: ArNSSettlementStatus) => void;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
};

/**
 * Thrown when the bundler responds `402` — the wallet lacks the Turbo Credits
 * to cover the purchase. Deterministic (not retried); the UI routes to Top-Up.
 */
export class InsufficientCreditsError extends Error {
  public readonly code = 'INSUFFICIENT_CREDITS' as const;
  constructor(message = 'Insufficient Turbo Credits for this purchase.') {
    super(message);
    this.name = 'InsufficientCreditsError';
  }
}

/** Thrown when the purchase terminally fails on-chain (`failedDate` set). */
export class ArNSPurchaseFailedError extends Error {
  public readonly code = 'ARNS_PURCHASE_FAILED' as const;
  constructor(
    message = 'The ArNS purchase failed to settle on-chain.',
    public readonly nonce?: string,
  ) {
    super(message);
    this.name = 'ArNSPurchaseFailedError';
  }
}

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

    // The alpha SDK exposes getArNSPriceForName on the unauthenticated client.
    const price = await (
      turbo as unknown as {
        getArNSPriceForName: (
          p: Record<string, unknown>,
        ) => Promise<TurboArNSIntentPriceResponse>;
      }
    ).getArNSPriceForName(params);
    return price;
  }

  /** Poll target for a submitted purchase (`GET /v1/arns/purchase/:nonce`). */
  public async getIntentStatus(nonce: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.paymentUrl}/v1/arns/purchase/${nonce}`, {
      method: 'GET',
    });
    return res.json();
  }

  /**
   * Settle an ArNS purchase (Phase 1: Buy-Name) by debiting the connected
   * wallet's Turbo Credit balance via the bundler payment-service, then poll to
   * a terminal state.
   *
   * Resilience (mirrors arns-react):
   * - The turbo-sdk purchase method mints a UUID nonce that is BOTH the
   *   idempotency key and the status key; we capture it and never blind-re-call
   *   the mint (which could double debit). The SDK's own HTTP retry reuses the
   *   same signed nonce, so it is debit-safe.
   * - `resumeNonce` lets a reload resume POLLING an already-submitted purchase.
   * - A `402` maps to {@link InsufficientCreditsError} so the caller can route
   *   to Top-Up. Only a `messageId` (success) or `failedDate` (failure) is
   *   terminal; transient poll errors are ignored.
   */
  public async executeArNSIntent({
    intent,
    name,
    type,
    years,
    increaseQty,
    processId,
    paidBy,
    tokenType = 'solana',
    walletAdapter,
    purchaseClient,
    resumeNonce,
    onStatus,
    pollIntervalMs = 2500,
    pollTimeoutMs = 120_000,
  }: ExecuteArNSIntentParams): Promise<ArNSSettlementResult> {
    let nonce = resumeNonce;

    if (!nonce) {
      onStatus?.({ phase: 'submitting' });
      const client =
        purchaseClient ??
        this.buildAuthenticatedPurchaseClient({ walletAdapter, tokenType });
      try {
        const result = await this.submitArNSPurchase(client, {
          intent,
          name,
          type,
          years,
          increaseQty,
          processId,
          paidBy,
          tokenType,
        });
        nonce = result.nonce ?? result.purchaseReceipt?.nonce;
      } catch (error) {
        throw this.mapArNSPurchaseError(error);
      }
      if (!nonce) {
        throw new Error(
          'ArNS purchase did not return a nonce; cannot track settlement.',
        );
      }
      onStatus?.({ phase: 'submitted', nonce });
    } else {
      onStatus?.({ phase: 'resumed', nonce });
    }

    return this.pollArNSPurchaseToTerminal({
      nonce,
      name,
      onStatus,
      pollIntervalMs,
      pollTimeoutMs,
    });
  }

  /**
   * Build the authenticated turbo-sdk client that signs the request nonce.
   *
   * Phase 1: Solana (Model B) only — built from console's injected wallet
   * adapter (`{ publicKey, signMessage, signTransaction }`), exactly as
   * console's upload/share authed clients are. Arweave/Ethereum (Model A) will
   * pass an arbundles signer here in a later phase.
   */
  private buildAuthenticatedPurchaseClient({
    walletAdapter,
    tokenType = 'solana',
  }: {
    walletAdapter?: SolanaWalletAdapter;
    tokenType?: TokenType;
  }): AuthenticatedArNSPurchaseClient {
    if (tokenType !== 'solana') {
      throw new Error(
        `Paying for ArNS with credits is only supported for Solana wallets in this release (got ${tokenType}).`,
      );
    }
    if (!walletAdapter || !walletAdapter.publicKey) {
      throw new Error(
        'A connected Solana wallet is required to authenticate this request.',
      );
    }
    return TurboFactory.authenticated({
      token: 'solana',
      walletAdapter: walletAdapter as unknown,
      paymentServiceConfig: { url: this.paymentUrl },
    } as Parameters<typeof TurboFactory.authenticated>[0]) as unknown as AuthenticatedArNSPurchaseClient;
  }

  /** Map an ArNS intent to the matching turbo-sdk per-intent purchase method. */
  private submitArNSPurchase(
    client: AuthenticatedArNSPurchaseClient,
    {
      intent,
      name,
      type,
      years,
      increaseQty,
      processId,
      paidBy,
      tokenType = 'solana',
    }: {
      intent: TurboArNSIntent;
      name: string;
      type?: 'lease' | 'permabuy';
      years?: number;
      increaseQty?: number;
      processId?: string;
      paidBy?: string[];
      tokenType?: TokenType;
    },
  ): Promise<ArNSPurchaseResult> {
    const domain = lowerCaseDomain(name);
    switch (intent) {
      case 'Buy-Name': {
        // Model B (Solana) MUST supply the client-spawned ANT's processId.
        if (tokenType === 'solana' && !processId) {
          throw new Error(
            'A processId (ANT) is required to buy an ArNS name with credits.',
          );
        }
        return client.buyArNSName({
          name: domain,
          type,
          years,
          ...(processId ? { processId } : {}),
          paidBy,
        });
      }
      case 'Extend-Lease': {
        if (years === undefined) {
          throw new Error('years is required to extend an ArNS lease.');
        }
        return client.extendArNSLease({ name: domain, years, paidBy });
      }
      case 'Increase-Undername-Limit': {
        if (increaseQty === undefined) {
          throw new Error(
            'increaseQty is required to increase the undername limit.',
          );
        }
        return client.increaseArNSUndernameLimit({
          name: domain,
          increaseQty,
          paidBy,
        });
      }
      case 'Upgrade-Name':
        return client.upgradeArNSName({ name: domain, paidBy });
      default:
        throw new Error(
          `Unsupported ArNS intent for credit settlement: ${String(intent)}`,
        );
    }
  }

  /**
   * Poll `GET /v1/arns/purchase/:nonce` to a terminal state. `messageId` ⇒
   * success; `failedDate` ⇒ failure. Transient network errors are non-terminal.
   */
  private async pollArNSPurchaseToTerminal({
    nonce,
    name,
    onStatus,
    pollIntervalMs,
    pollTimeoutMs,
  }: {
    nonce: string;
    name: string;
    onStatus?: (status: ArNSSettlementStatus) => void;
    pollIntervalMs: number;
    pollTimeoutMs: number;
  }): Promise<ArNSSettlementResult> {
    const deadline = Date.now() + pollTimeoutMs;

    while (Date.now() < deadline) {
      onStatus?.({ phase: 'polling', nonce });
      let record: Record<string, unknown> | undefined;
      try {
        record = await this.getIntentStatus(nonce);
      } catch {
        record = undefined; // transient — keep polling
      }

      const messageId = record?.messageId as string | undefined;
      if (messageId) {
        onStatus?.({ phase: 'success', nonce, messageId });
        return { nonce, messageId, receipt: record ?? {} };
      }
      if (record?.failedDate) {
        throw new ArNSPurchaseFailedError(
          `The purchase of '${name}' failed to settle on-chain.`,
          nonce,
        );
      }

      await sleep(pollIntervalMs);
    }

    throw new Error(
      `Timed out waiting for the '${name}' purchase to settle (nonce ${nonce}). ` +
        'Your credits are safe; the purchase may still complete — check back shortly.',
    );
  }

  /**
   * Normalize a purchase error. A bundler `402` (surfaced by the turbo-sdk as a
   * `FailedRequestError` with `status === 402`, or a "(Status 402)" message)
   * becomes a typed {@link InsufficientCreditsError}.
   */
  private mapArNSPurchaseError(error: unknown): Error {
    const status = (error as { status?: number })?.status;
    const message = error instanceof Error ? error.message : String(error);
    if (status === 402 || /\(Status 402\)/.test(message)) {
      return new InsufficientCreditsError();
    }
    return error instanceof Error ? error : new Error(message);
  }
}
