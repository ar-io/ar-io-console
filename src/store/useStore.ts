import { resolveArNSAddress } from '../utils/arnsIdentity';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TurboCryptoFundResponse } from '@ardrive/turbo-sdk/web';
import { PaymentIntent, PaymentIntentResult } from '@stripe/stripe-js';
import {
  ARIO_CORE_PROGRAM_ID,
  ARIO_GAR_PROGRAM_ID,
  ARIO_ARNS_PROGRAM_ID,
  ARIO_ANT_PROGRAM_ID,
  DEVNET_PROGRAM_IDS,
} from '@ar.io/sdk/solana';
import { SupportedTokenType } from '../constants';
import { DEFAULT_BROWSE_CONFIG } from '../features/browse/utils/constants';
import { migratePageDef, type PageDef, type TemplateId } from '@/features/pages/schema';
import type { PriceDisplayCurrency } from '../features/arns/priceDisplay';

/**
 * Production RPC endpoints, each overridable at build time.
 *
 * Every one of these except Solana used to be a hard-coded free public RPC —
 * `mainnet.base.org` alone backed three tokens plus the wallet connector, and
 * Base's own docs say it is not for production use. Those endpoints rate-limit
 * aggressively, which makes them the most likely source of 429s in the app.
 *
 * Making them build-time vars lets a real provider be swapped in, or a leaked
 * key rotated, without a code change. Each falls back to the endpoint it
 * replaced, so an unset var changes nothing.
 *
 * NOTE: like every `VITE_` value these are inlined into the published bundle and
 * are therefore PUBLIC — permanently, once deployed to Arweave. Protect the
 * endpoint provider-side (referrer allowlist, method limits). Never treat one
 * of these as a secret.
 */
export const RPC_ENDPOINTS = {
  solana: import.meta.env.VITE_SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
  ethereum: import.meta.env.VITE_ETHEREUM_RPC || 'https://ethereum.publicnode.com',
  base: import.meta.env.VITE_BASE_RPC || 'https://mainnet.base.org',
  polygon: import.meta.env.VITE_POLYGON_RPC || 'https://polygon-bor-rpc.publicnode.com',
} as const;

// Preset configurations
const PRESET_CONFIGS = {
  production: {
    paymentServiceUrl: 'https://payment.ardrive.io',
    uploadServiceUrl: 'https://upload.ardrive.io',
    captureServiceUrl: 'https://vilenarios.com/local/capture',
    arioGatewayUrl: 'https://turbo-gateway.com',
    stripeKey:
      'pk_live_51JUAtwC8apPOWkDLMQqNF9sPpfneNSPnwX8YZ8y1FNDl6v94hZIwzgFSYl27bWE4Oos8CLquunUswKrKcaDhDO6m002Yj9AeKj',
    processId: 'qNvAoz0TgcH7DMg8BCVn8jF32QH5L6T29VjHxhHqqGE',
    coreProgramId: ARIO_CORE_PROGRAM_ID,
    garProgramId: ARIO_GAR_PROGRAM_ID,
    arnsProgramId: ARIO_ARNS_PROGRAM_ID,
    antProgramId: ARIO_ANT_PROGRAM_ID,
    tokenMap: {
      arweave: 'https://turbo-gateway.com',
      ario: 'https://turbo-gateway.com',
      'base-ario': RPC_ENDPOINTS.base,
      ethereum: RPC_ENDPOINTS.ethereum,
      'base-eth': RPC_ENDPOINTS.base,
      // Provider URL carries an auth token, so it is injected at build time rather
      // than committed. Vite inlines this into the bundle — it is NOT a secret, it
      // is merely un-committed. The endpoint is protected by referrer + method
      // whitelists on the provider side; treat the published value as public.
      // Same var as the wallet adapter (providers/WalletProviders.tsx) so both
      // halves of the app talk to one RPC.
      solana: RPC_ENDPOINTS.solana,
      kyve: 'https://api.kyve.network',
      pol: RPC_ENDPOINTS.polygon,
      // cloudflare-eth.com was the odd one out — a THIRD public Ethereum
      // endpoint alongside the two above. Same chain, so same endpoint.
      usdc: RPC_ENDPOINTS.ethereum,
      'base-usdc': RPC_ENDPOINTS.base,
      'polygon-usdc': RPC_ENDPOINTS.polygon,
    } as Record<SupportedTokenType, string>,
  },
  development: {
    paymentServiceUrl: 'https://payment.services.ar-io.dev',
    uploadServiceUrl: 'https://upload.services.ar-io.dev',
    captureServiceUrl: 'https://vilenarios.com/local/capture',
    arioGatewayUrl: 'https://ar-io.dev',
    stripeKey:
      'pk_test_51JUAtwC8apPOWkDLh2FPZkQkiKZEkTo6wqgLCtQoClL6S4l2jlbbc5MgOdwOUdU9Tn93NNvqAGbu115lkJChMikG00XUfTmo2z',
    processId: '', // Legacy AO field — not used on Solana devnet
    coreProgramId: DEVNET_PROGRAM_IDS.core,
    garProgramId: DEVNET_PROGRAM_IDS.gar,
    arnsProgramId: DEVNET_PROGRAM_IDS.arns,
    antProgramId: DEVNET_PROGRAM_IDS.ant,
    tokenMap: {
      arweave: 'https://ar-io.dev',
      ario: 'https://ar-io.dev',
      'base-ario': 'https://sepolia.base.org',
      ethereum: 'https://eth-sepolia.public.blastapi.io',
      'base-eth': 'https://sepolia.base.org',
      solana: 'https://api.devnet.solana.com',
      kyve: 'https://api.korellia.kyve.network',
      pol: 'https://rpc-amoy.polygon.technology',
      usdc: 'https://eth-sepolia.public.blastapi.io',
      'base-usdc': 'https://sepolia.base.org',
      'polygon-usdc': 'https://rpc-amoy.polygon.technology',
    } as Record<SupportedTokenType, string>,
  },
} as const;

export interface UploadResult {
  id: string;
  owner: string;
  dataCaches: string[];
  fastFinalityIndexes: string[];
  winc: string;
  timestamp?: number;
  fileName?: string; // Original file name
  fileSize?: number; // Original file size in bytes
  contentType?: string; // Original file MIME type
  receipt?: any; // Store the full receipt response
  // ArNS assignment fields
  arnsName?: string; // ArNS name assigned to this file
  undername?: string; // Undername if used
  arnsTransactionId?: string; // ArNS update transaction ID
}

interface DeployResult {
  type: 'manifest' | 'files' | 'arns-update';
  id?: string; // Manifest ID or ArNS transaction ID
  manifestId?: string;
  files?: Array<{
    id: string;
    path: string;
    size: number;
    receipt?: any;
  }>;
  timestamp?: number;
  receipt?: any; // Store receipt for manifest
  // Paths of files that failed to upload while the deploy still proceeded (under
  // the failure threshold) — so a partial deploy isn't recorded as fully clean.
  failedFiles?: string[];
  // ArNS-specific fields
  arnsName?: string; // ArNS name updated
  undername?: string; // Undername if used
  targetId?: string; // Transaction ID the name now points to
  arnsStatus?: 'success' | 'failed' | 'pending';
  arnsError?: string; // Error message if failed
  // App metadata fields (user-provided)
  appName?: string; // User's app/site name
  appVersion?: string; // User's app/site version
}

// File hash cache entry for Smart Deploy deduplication
interface FileHashEntry {
  txId: string;
  hash: string;
  size: number;
  contentType: string;
  timestamp: number;
}

// Deployed app metadata for App Details feature
interface DeployedAppEntry {
  appVersion: string;
  lastDeployed: number; // timestamp
}

// --- Pages feature (link-in-bio permaweb pages, PRD §7.7 / §10) -----------------

/** One immutable published version of a page (each Publish = a new HTML data item). */
export interface PageVersion {
  version: number;
  txId: string; // HTML data item id
  size: number; // bytes of the published HTML
  defHash: string; // hash of the PageDef (dedup / change detection)
  note?: string; // changelog note
  timestamp: number;
  arnsRepointTxId?: string; // ANT tx if this version was made live at the domain
}

/** A page the user created, grouped by a stable id across versions. */
export interface ConsolePage {
  id: string; // stable across versions (Page-Id tag)
  title: string;
  template: TemplateId; // origin marker only
  currentVersion: number; // 0 when a draft has never been published
  latestTxId: string; // newest HTML data item ('' for an unpublished draft)
  arns?: { name: string; undername?: string; targetTxId: string; arnsTxId?: string };
  versions: PageVersion[]; // newest-first
  def: PageDef; // last-edited source of truth (local cache)
  labels: string[]; // organizational, local only
  createdAt: number;
  updatedAt: number;
}

export interface PaymentInformation {
  paymentMethodId: string;
  email?: string;
}

export type ConfigMode = 'production' | 'development' | 'custom';
export type ThemeMode = 'light' | 'dark' | 'system';

// Browse Data feature types - imported from browse feature to avoid circular imports
import type { BrowseConfig, RoutingStrategy, VerificationMethod } from '../features/browse/types/index';
export type { BrowseConfig };
// Re-export with original names for backwards compatibility
export type BrowseRoutingStrategy = RoutingStrategy;
export type BrowseVerificationMethod = VerificationMethod;

export interface DeveloperConfig {
  paymentServiceUrl: string;
  uploadServiceUrl: string;
  captureServiceUrl: string;
  arioGatewayUrl: string;
  stripeKey: string;
  processId: string;
  coreProgramId: string;
  garProgramId: string;
  arnsProgramId: string;
  antProgramId: string;
  tokenMap: Record<SupportedTokenType, string>;
}

interface StoreState {
  // Wallet state
  address: string | null;
  walletType: 'arweave' | 'ethereum' | 'solana' | null;
  /**
   * Adapter name of a PRIMARY Solana session (e.g. 'Phantom').
   *
   * The Solana WalletProvider runs `autoConnect={false}`, so nothing restores
   * the adapter on reload. Linked wallets survive a refresh because their name
   * is persisted and re-selected; primary sessions had no equivalent, so they
   * were signed out on every page load — the identity ArNS is actually built
   * for got the worst treatment. Persisting the name lets the same
   * auto-reconnect cover both.
   */
  solanaWalletName: string | null;
  creditBalance: number;

  // Linked Solana wallet for ArNS (non-Solana primary users)
  linkedSolanaAddress: string | null;
  linkedSolanaWalletName: string | null;

  // ArNS state
  arnsNamesCache: Record<string, { name: string; logo?: string; timestamp: number }>;
  ownedArnsCache: Record<
    string,
    {
      names: Array<{
        name: string;
        processId: string;
        currentTarget?: string;
        undernames?: string[];
        ttl?: number;
        undernameTTLs?: Record<string, number>;
        type?: 'lease' | 'permabuy';
        endTimestamp?: number;
      }>;
      timestamp: number;
    }
  >;

  // Upload history state
  uploadHistory: UploadResult[];

  // Deploy history state
  deployHistory: DeployResult[];

  // Pages feature state (persisted, grouped by stable page id)
  pages: ConsolePage[];

  // Upload status cache (persisted) - stores full API response
  uploadStatusCache: Record<
    string,
    {
      status: 'CONFIRMED' | 'FINALIZED' | 'FAILED' | 'NOT_FOUND';
      bundleId?: string;
      info?: string;
      startOffsetInRootBundle?: number;
      rawContentLength?: number;
      payloadContentType?: string;
      payloadDataStart?: number;
      payloadContentLength?: number;
      winc?: string;
      timestamp: number; // When status was fetched
    }
  >;

  // Payment state - matching reference app exactly
  paymentAmount?: number;
  paymentIntent?: PaymentIntent;
  paymentInformation?: PaymentInformation;
  paymentIntentResult?: PaymentIntentResult;
  promoCode?: string;

  // Target wallet for payments (can be different from connected wallet)
  // This allows users to fund any wallet without authentication
  paymentTargetAddress: string | null;
  paymentTargetType: 'arweave' | 'ethereum' | 'solana' | null;

  // Crypto payment state
  cryptoTopupValue?: number;
  cryptoManualTopup: boolean;
  cryptoTopupResponse?: TurboCryptoFundResponse;

  // Just-in-time payment preferences (persistent)
  jitPaymentEnabled: boolean;
  jitMaxTokenAmount: Record<SupportedTokenType, number>; // Human-readable amounts (e.g., 0.15 SOL, 200 ARIO)
  jitBufferMultiplier: number; // Buffer multiplier for JIT payments (e.g., 1.1 = 10% buffer)

  // UI state
  showResumeTransactionPanel: boolean;

  // Theme state
  theme: ThemeMode;

  // Developer configuration state
  configMode: ConfigMode;
  customConfig: DeveloperConfig;

  // X402-only mode (disables payment service features)
  x402OnlyMode: boolean;

  // Smart Deploy state (file deduplication)
  fileHashCache: Record<string, FileHashEntry>;
  smartDeployEnabled: boolean;

  // Price-display preference (ARIO ⇄ USD toggle on priced surfaces)
  priceDisplayCurrency: PriceDisplayCurrency;

  // App Details state (deployed apps history)
  deployedApps: Record<string, DeployedAppEntry>; // Keyed by app name
  lastDeployedAppName: string | null; // Most recently deployed app for pre-fill

  // Browse Data feature state
  browseConfig: BrowseConfig;

  // Actions
  setAddress: (
    address: string | null,
    type: 'arweave' | 'ethereum' | 'solana' | null,
    /** Solana adapter name — persisted so the session survives a reload. */
    solanaWalletName?: string,
  ) => void;
  clearAddress: () => void;
  setLinkedSolanaWallet: (address: string, walletName: string) => void;
  clearLinkedSolanaWallet: () => void;
  getArNSAddress: () => string | null;
  setCreditBalance: (balance: number) => void;
  setArNSName: (address: string, name: string, logo?: string) => void;
  getArNSName: (address: string) => { name: string; logo?: string } | null;
  setOwnedArNSNames: (
    address: string,
    names: Array<{
      name: string;
      processId: string;
      currentTarget?: string;
      undernames?: string[];
      ttl?: number;
      undernameTTLs?: Record<string, number>;
      type?: 'lease' | 'permabuy';
      endTimestamp?: number;
    }>
  ) => void;
  getOwnedArNSNames: (address: string) => Array<{
    name: string;
    processId: string;
    currentTarget?: string;
    undernames?: string[];
    ttl?: number;
    undernameTTLs?: Record<string, number>;
    type?: 'lease' | 'permabuy';
    endTimestamp?: number;
  }> | null;
  addUploadResults: (results: UploadResult[]) => void;
  updateUploadWithArNS: (uploadId: string, arnsName: string, undername?: string, arnsTransactionId?: string) => void;
  clearUploadHistory: () => void;
  addDeployResults: (results: DeployResult[]) => void;
  clearDeployHistory: () => void;

  // Pages actions
  savePage: (page: ConsolePage) => void;
  upsertPageDraft: (id: string, def: PageDef) => void;
  addPageVersion: (pageId: string, version: PageVersion, def: PageDef) => void;
  updatePageArNS: (pageId: string, arns: ConsolePage['arns']) => void;
  setPageLabels: (pageId: string, labels: string[]) => void;
  duplicatePage: (pageId: string) => string;
  deletePage: (pageId: string) => void;
  getPage: (pageId: string) => ConsolePage | undefined;
  setUploadStatus: (
    txId: string,
    status: {
      status: 'CONFIRMED' | 'FINALIZED' | 'FAILED' | 'NOT_FOUND';
      bundleId?: string;
      info?: string;
      startOffsetInRootBundle?: number;
      rawContentLength?: number;
      payloadContentType?: string;
      payloadDataStart?: number;
      payloadContentLength?: number;
      winc?: string;
    }
  ) => void;
  getUploadStatus: (txId: string) => {
    status: 'CONFIRMED' | 'FINALIZED' | 'FAILED' | 'NOT_FOUND';
    bundleId?: string;
    info?: string;
    startOffsetInRootBundle?: number;
    rawContentLength?: number;
    payloadContentType?: string;
    payloadDataStart?: number;
    payloadContentLength?: number;
    winc?: string;
  } | null;

  // Payment actions - matching reference app
  setPaymentAmount: (amount?: number) => void;
  setPaymentIntent: (intent?: PaymentIntent) => void;
  setPaymentInformation: (info?: PaymentInformation) => void;
  setPaymentIntentResult: (result?: PaymentIntentResult) => void;
  setPromoCode: (code?: string) => void;
  setPaymentTarget: (address: string | null, type: 'arweave' | 'ethereum' | 'solana' | null) => void;
  clearPaymentTarget: () => void;

  // Crypto actions
  setCryptoTopupValue: (value?: number) => void;
  setCryptoManualTopup: (value: boolean) => void;
  setCryptoTopupResponse: (response?: TurboCryptoFundResponse) => void;
  setShowResumeTransactionPanel: (show: boolean) => void;
  clearAllPaymentState: () => void;

  // Theme actions
  setTheme: (theme: ThemeMode) => void;

  // Just-in-time payment actions
  setJitPaymentEnabled: (enabled: boolean) => void;
  setJitMaxTokenAmount: (token: SupportedTokenType, amount: number) => void;
  setJitBufferMultiplier: (multiplier: number) => void;

  // Developer configuration actions
  setConfigMode: (mode: ConfigMode) => void;
  updateCustomConfig: (key: keyof DeveloperConfig, value: string | Record<SupportedTokenType, string>) => void;
  updateTokenMap: (token: SupportedTokenType, url: string) => void;
  getCurrentConfig: () => DeveloperConfig;
  resetToDefaults: () => void;

  // X402-only mode actions
  setX402OnlyMode: (enabled: boolean) => void;
  isPaymentServiceAvailable: () => boolean;

  // Smart Deploy actions
  updateFileHashCache: (
    entries: Array<{
      hash: string;
      txId: string;
      size: number;
      contentType: string;
    }>
  ) => void;
  getFileHashEntry: (hash: string) => FileHashEntry | null;
  clearFileHashCache: () => void;
  setSmartDeployEnabled: (enabled: boolean) => void;
  setPriceDisplayCurrency: (currency: PriceDisplayCurrency) => void;

  // App Details actions
  saveDeployedApp: (appName: string, appVersion: string) => void;
  getDeployedApp: (appName: string) => DeployedAppEntry | null;
  getRecentAppNames: (limit?: number) => string[];
  getLastDeployedApp: () => { appName: string; appVersion: string } | null;

  // Browse Data feature actions
  setBrowseConfig: (config: Partial<BrowseConfig>) => void;
  resetBrowseConfig: () => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // Initial state
      address: null,
      walletType: null,
      solanaWalletName: null,
      creditBalance: 0,

      // Linked Solana wallet for ArNS
      linkedSolanaAddress: null,
      linkedSolanaWalletName: null,

      arnsNamesCache: {},
      ownedArnsCache: {},
      uploadHistory: [],
      deployHistory: [],
      pages: [],
      uploadStatusCache: {},

      // Theme state
      theme: 'system', // Default to system preference

      // Developer configuration state
      configMode: 'production',
      customConfig: PRESET_CONFIGS.production,

      // X402-only mode (disabled by default)
      x402OnlyMode: false,

      // Smart Deploy state (file deduplication)
      fileHashCache: {},
      smartDeployEnabled: true, // Default ON

      // Price-display preference — ARIO by default (native ArNS currency)
      priceDisplayCurrency: 'ario',

      // App Details state (deployed apps history)
      deployedApps: {},
      lastDeployedAppName: null,

      // Browse Data feature state
      browseConfig: DEFAULT_BROWSE_CONFIG,

      // Payment state
      paymentAmount: undefined,
      paymentIntent: undefined,
      paymentInformation: undefined,
      paymentIntentResult: undefined,
      promoCode: undefined,
      paymentTargetAddress: null,
      paymentTargetType: null,

      // Crypto state
      cryptoTopupValue: undefined,
      cryptoManualTopup: false,
      cryptoTopupResponse: undefined,
      showResumeTransactionPanel: false,

      // Just-in-time payment state (defaults - persistent)
      jitPaymentEnabled: true, // Default opt-in
      jitMaxTokenAmount: {
        ario: 200, // 200 ARIO ≈ $20
        'base-ario': 200, // 200 ARIO ≈ $20 (on Base L2)
        solana: 0.15, // 0.15 SOL ≈ $22.50
        'base-eth': 0.01, // 0.01 ETH ≈ $25
        'base-usdc': 25, // 25 USDC = $25 (stablecoin)
        arweave: 0,
        ethereum: 0,
        kyve: 0,
        pol: 0,
        usdc: 0, // Not supported for JIT (too slow)
        'polygon-usdc': 0, // Not supported for JIT (too slow)
      },
      jitBufferMultiplier: 1.1, // Default 10% buffer
      // Actions
      setAddress: (address, type, solanaWalletName) =>
        set({
          address,
          walletType: type,
          creditBalance: 0,
          // Keep the existing name when re-setting the same Solana session
          // (the listener calls this without a name on reconnect).
          solanaWalletName:
            type === 'solana'
              ? (solanaWalletName ?? get().solanaWalletName)
              : null,
        }),
      clearAddress: () =>
        set({
          address: null,
          walletType: null,
          solanaWalletName: null,
          creditBalance: 0,
          arnsNamesCache: {},
          ownedArnsCache: {},
          // linkedSolanaAddress and linkedSolanaWalletName are intentionally
          // preserved so users don't have to re-link every session. Use
          // clearLinkedSolanaWallet() to explicitly unlink.
        }),
      setLinkedSolanaWallet: (address, walletName) =>
        set({ linkedSolanaAddress: address, linkedSolanaWalletName: walletName }),
      clearLinkedSolanaWallet: () => {
        const { linkedSolanaAddress: addr, ownedArnsCache } = get();
        // Remove cached ArNS names for the linked address to avoid stale data
        if (addr && ownedArnsCache[addr]) {
          const rest = { ...ownedArnsCache };
          delete rest[addr];
          set({ linkedSolanaAddress: null, linkedSolanaWalletName: null, ownedArnsCache: rest });
        } else {
          set({ linkedSolanaAddress: null, linkedSolanaWalletName: null });
        }
      },
      getArNSAddress: () => {
        const { walletType, address, linkedSolanaAddress } = get();
        return resolveArNSAddress({ walletType, address, linkedSolanaAddress });
      },
      setCreditBalance: (balance) => set({ creditBalance: balance }),
      setArNSName: (address, name, logo) => {
        const cache = get().arnsNamesCache;
        set({
          arnsNamesCache: {
            ...cache,
            [address]: { name, logo, timestamp: Date.now() },
          },
        });
      },
      getArNSName: (address) => {
        const cache = get().arnsNamesCache;
        const entry = cache[address];
        // Cache for 24 hours to match reference implementation
        if (entry && Date.now() - entry.timestamp < 24 * 60 * 60 * 1000) {
          return { name: entry.name, logo: entry.logo };
        }
        return null;
      },
      setOwnedArNSNames: (address, names) => {
        const cache = get().ownedArnsCache;
        set({
          ownedArnsCache: {
            ...cache,
            [address]: { names, timestamp: Date.now() },
          },
        });
      },
      getOwnedArNSNames: (address) => {
        const cache = get().ownedArnsCache;
        const entry = cache[address];
        // Cache for 6 hours
        if (entry && Date.now() - entry.timestamp < 21600000) {
          return entry.names;
        }
        return null;
      },
      addUploadResults: (results) => {
        const currentHistory = get().uploadHistory;
        // Add new results to the beginning of the history (most recent first)
        set({ uploadHistory: [...results, ...currentHistory] });
      },
      updateUploadWithArNS: (uploadId, arnsName, undername, arnsTransactionId) => {
        const currentHistory = get().uploadHistory;
        const updatedHistory = currentHistory.map((upload) =>
          upload.id === uploadId ? { ...upload, arnsName, undername, arnsTransactionId } : upload
        );
        set({ uploadHistory: updatedHistory });
      },
      clearUploadHistory: () => set({ uploadHistory: [] }),
      addDeployResults: (results) => {
        const currentHistory = get().deployHistory;
        // Add new results to the beginning of the history (most recent first)
        set({ deployHistory: [...results, ...currentHistory] });
      },
      clearDeployHistory: () => set({ deployHistory: [], fileHashCache: {} }), // Also clear file hash cache

      // Pages actions — grouped by stable page id, newest-first like deployHistory
      savePage: (page) => {
        const pages = get().pages;
        const idx = pages.findIndex((p) => p.id === page.id);
        if (idx === -1) {
          set({ pages: [page, ...pages] });
        } else {
          const next = pages.slice();
          next[idx] = { ...page, updatedAt: Date.now() };
          set({ pages: next });
        }
      },
      upsertPageDraft: (id, def) => {
        const pages = get().pages;
        const idx = pages.findIndex((p) => p.id === id);
        const now = Date.now();
        if (idx === -1) {
          // A local draft with no published version yet.
          const page: ConsolePage = {
            id,
            title: def.title,
            template: def.template,
            currentVersion: 0,
            latestTxId: '',
            versions: [],
            def,
            labels: [],
            createdAt: now,
            updatedAt: now,
          };
          set({ pages: [page, ...pages] });
        } else {
          const next = pages.slice();
          next[idx] = { ...next[idx], def, title: def.title, template: def.template, updatedAt: now };
          set({ pages: next });
        }
      },
      addPageVersion: (pageId, version, def) => {
        const pages = get().pages;
        const idx = pages.findIndex((p) => p.id === pageId);
        const now = Date.now();
        if (idx === -1) {
          // No draft yet — create the page from this first version.
          const page: ConsolePage = {
            id: pageId,
            title: def.title,
            template: def.template,
            currentVersion: version.version,
            latestTxId: version.txId,
            versions: [version],
            def,
            labels: [],
            createdAt: now,
            updatedAt: now,
          };
          set({ pages: [page, ...pages] });
          return;
        }
        const page = pages[idx];
        // Idempotent by version number: replace a version in place (so a follow-up
        // call can stamp arnsRepointTxId), otherwise prepend it (newest-first).
        const verIdx = page.versions.findIndex((v) => v.version === version.version);
        const versions =
          verIdx >= 0
            ? page.versions.map((v, i) => (i === verIdx ? version : v))
            : [version, ...page.versions];
        // currentVersion / latestTxId track the highest version number.
        const top = versions.reduce((a, b) => (b.version > a.version ? b : a), versions[0]);
        const next = pages.slice();
        next[idx] = {
          ...page,
          versions,
          def,
          title: def.title,
          template: def.template,
          currentVersion: top.version,
          latestTxId: top.txId,
          updatedAt: now,
        };
        set({ pages: next });
      },
      updatePageArNS: (pageId, arns) => {
        const pages = get().pages;
        const idx = pages.findIndex((p) => p.id === pageId);
        if (idx === -1) return;
        const next = pages.slice();
        const current = next[idx];
        // Keep def.arnsName in sync with the assigned label so every consumer
        // (editor hydration, publish permalink, re-export) sees one source of truth.
        const label = arns ? (arns.undername ? `${arns.undername}_${arns.name}` : arns.name) : undefined;
        next[idx] = {
          ...current,
          arns,
          def: { ...current.def, arnsName: label },
          updatedAt: Date.now(),
        };
        set({ pages: next });
      },
      setPageLabels: (pageId, labels) => {
        const pages = get().pages;
        const idx = pages.findIndex((p) => p.id === pageId);
        if (idx === -1) return;
        const next = pages.slice();
        next[idx] = { ...next[idx], labels, updatedAt: Date.now() };
        set({ pages: next });
      },
      duplicatePage: (pageId) => {
        const pages = get().pages;
        const source = pages.find((p) => p.id === pageId);
        const g = globalThis as { crypto?: { randomUUID?: () => string } };
        const newId =
          g.crypto && typeof g.crypto.randomUUID === 'function'
            ? g.crypto.randomUUID()
            : `pg-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
        if (!source) return newId;
        const now = Date.now();
        // A duplicate is a fresh, unpublished branch: new id, no versions/domain.
        const title = `${source.title} (copy)`;
        const copy: ConsolePage = {
          id: newId,
          title,
          template: source.template,
          currentVersion: 0,
          latestTxId: '',
          versions: [],
          // Deep-clone so the duplicate never shares nested blocks/profile/theme
          // references with the source — editing one page (e.g. reordering blocks
          // in place) must never mutate the other.
          def: { ...structuredClone(source.def), id: newId, title },
          labels: [...source.labels],
          createdAt: now,
          updatedAt: now,
        };
        set({ pages: [copy, ...pages] });
        return newId;
      },
      deletePage: (pageId) => {
        // Removes the local record only — on-chain versions are permanent (PRD §14).
        set({ pages: get().pages.filter((p) => p.id !== pageId) });
      },
      getPage: (pageId) => get().pages.find((p) => p.id === pageId),
      setUploadStatus: (txId, status) => {
        const cache = get().uploadStatusCache;
        set({
          uploadStatusCache: {
            ...cache,
            [txId]: { ...status, timestamp: Date.now() },
          },
        });
      },
      getUploadStatus: (txId) => {
        const cache = get().uploadStatusCache;
        const cached = cache[txId];
        if (!cached) return null;

        // Cache expires after 1 hour for confirmed files, 24 hours for finalized
        const maxAge = cached.status === 'FINALIZED' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
        if (Date.now() - cached.timestamp > maxAge) {
          return null; // Expired
        }

        return { status: cached.status, info: cached.info };
      },

      // Payment actions - matching reference app exactly
      setPaymentAmount: (amount) => set({ paymentAmount: amount }),
      setPaymentIntent: (intent) => set({ paymentIntent: intent }),
      setPaymentInformation: (info) => set({ paymentInformation: info }),
      setPaymentIntentResult: (result) => set({ paymentIntentResult: result }),
      setPromoCode: (code) => set({ promoCode: code }),
      setPaymentTarget: (address, type) => set({ paymentTargetAddress: address, paymentTargetType: type }),
      clearPaymentTarget: () => set({ paymentTargetAddress: null, paymentTargetType: null }),

      // Crypto actions
      setCryptoTopupValue: (value) => set({ cryptoTopupValue: value }),
      setCryptoManualTopup: (value) => set({ cryptoManualTopup: value }),
      setCryptoTopupResponse: (response) => set({ cryptoTopupResponse: response }),
      setShowResumeTransactionPanel: (show) => set({ showResumeTransactionPanel: show }),
      clearAllPaymentState: () =>
        set({
          paymentAmount: undefined,
          paymentIntent: undefined,
          paymentInformation: undefined,
          paymentIntentResult: undefined,
          promoCode: undefined,
          paymentTargetAddress: null,
          paymentTargetType: null,
          cryptoTopupValue: undefined,
          cryptoManualTopup: false,
          cryptoTopupResponse: undefined,
          showResumeTransactionPanel: false,
        }),

      // Theme action
      setTheme: (theme) => set({ theme }),

      // Just-in-time payment actions
      setJitPaymentEnabled: (enabled) => set({ jitPaymentEnabled: enabled }),
      setJitMaxTokenAmount: (token, amount) => {
        const current = get().jitMaxTokenAmount;
        set({ jitMaxTokenAmount: { ...current, [token]: amount } });
      },
      setJitBufferMultiplier: (multiplier) => {
        set({ jitBufferMultiplier: multiplier });
      },
      // Developer configuration actions
      setConfigMode: (mode) => {
        const { configMode: currentMode, customConfig } = get();
        set({ configMode: mode });

        if (mode === 'custom') {
          // When switching TO custom mode, start from the current preset and
          // layer any existing user customizations on top. This ensures new
          // fields (e.g. Solana program IDs) always have production defaults
          // even if customConfig in localStorage predates their addition.
          const basePreset =
            currentMode !== 'custom' ? PRESET_CONFIGS[currentMode] : PRESET_CONFIGS.production;
          set({ customConfig: { ...basePreset, ...customConfig, tokenMap: { ...basePreset.tokenMap, ...customConfig.tokenMap } } });
        } else {
          // When switching AWAY from custom mode, update customConfig to the new preset
          set({ customConfig: PRESET_CONFIGS[mode] });
        }
      },

      updateCustomConfig: (key, value) => {
        const currentConfig = get().customConfig;
        set({
          customConfig: {
            ...currentConfig,
            [key]: value,
          },
        });
      },

      updateTokenMap: (token, url) => {
        const currentConfig = get().customConfig;
        set({
          customConfig: {
            ...currentConfig,
            tokenMap: {
              ...currentConfig.tokenMap,
              [token]: url,
            },
          },
        });
      },

      getCurrentConfig: () => {
        const { configMode, customConfig } = get();
        if (configMode === 'custom') {
          // Merge over production defaults so stale localStorage entries
          // never leave fields undefined after a schema migration.
          return { ...PRESET_CONFIGS.production, ...customConfig };
        }
        return PRESET_CONFIGS[configMode];
      },

      resetToDefaults: () => {
        const { configMode } = get();
        if (configMode !== 'custom') {
          set({ customConfig: PRESET_CONFIGS[configMode] });
        } else {
          set({ customConfig: PRESET_CONFIGS.production });
        }
      },

      // X402-only mode actions
      setX402OnlyMode: (enabled) => set({ x402OnlyMode: enabled }),
      isPaymentServiceAvailable: () => !get().x402OnlyMode,

      // Smart Deploy actions
      updateFileHashCache: (entries) => {
        const cache = get().fileHashCache;
        const newEntries: Record<string, FileHashEntry> = {};
        const MAX_CACHE_ENTRIES = 5000; // Limit to prevent localStorage overflow

        // Namespace entries by the active upload service (network). A file hashed
        // and uploaded on testnet must NOT be treated as already-uploaded on
        // mainnet — its txId doesn't exist there. Keying by the bundler URL keeps
        // prod/testnet/custom caches separate so Smart Deploy can never bake a
        // wrong-network txId into a manifest. (See getFileHashEntry.)
        const scope = get().getCurrentConfig().uploadServiceUrl;
        entries.forEach(({ hash, txId, size, contentType }) => {
          newEntries[`${scope}::${hash}`] = {
            txId,
            hash,
            size,
            contentType,
            timestamp: Date.now(),
          };
        });

        const mergedCache = { ...cache, ...newEntries };

        // LRU eviction: if cache exceeds limit, remove oldest entries
        const cacheKeys = Object.keys(mergedCache);
        if (cacheKeys.length > MAX_CACHE_ENTRIES) {
          // Sort by timestamp (oldest first) and remove excess
          const sortedEntries = cacheKeys
            .map((key) => ({
              key,
              timestamp: mergedCache[key].timestamp,
            }))
            .sort((a, b) => a.timestamp - b.timestamp);

          const entriesToRemove = sortedEntries.slice(0, cacheKeys.length - MAX_CACHE_ENTRIES);
          entriesToRemove.forEach(({ key }) => {
            delete mergedCache[key];
          });

          console.log(
            `Smart Deploy cache: evicted ${entriesToRemove.length} old entries (limit: ${MAX_CACHE_ENTRIES})`
          );
        }

        set({ fileHashCache: mergedCache });
      },
      getFileHashEntry: (hash) => {
        // Look up within the active upload service's namespace only, so a testnet
        // txId is never returned for a mainnet deploy (and vice versa). A miss just
        // means the file re-uploads on this network. No expiry otherwise.
        const scope = get().getCurrentConfig().uploadServiceUrl;
        const entry = get().fileHashCache[`${scope}::${hash}`];
        return entry || null;
      },
      clearFileHashCache: () => set({ fileHashCache: {} }),
      setSmartDeployEnabled: (enabled) => set({ smartDeployEnabled: enabled }),
      setPriceDisplayCurrency: (priceDisplayCurrency) =>
        set({ priceDisplayCurrency }),

      // App Details actions
      saveDeployedApp: (appName, appVersion) => {
        if (!appName.trim()) return; // Don't save empty app names
        const apps = get().deployedApps;
        set({
          deployedApps: {
            ...apps,
            [appName]: {
              appVersion,
              lastDeployed: Date.now(),
            },
          },
          lastDeployedAppName: appName,
        });
      },
      getDeployedApp: (appName) => {
        return get().deployedApps[appName] || null;
      },
      getRecentAppNames: (limit = 5) => {
        const apps = get().deployedApps;
        return Object.entries(apps)
          .sort(([, a], [, b]) => b.lastDeployed - a.lastDeployed)
          .slice(0, limit)
          .map(([name]) => name);
      },
      getLastDeployedApp: () => {
        const { lastDeployedAppName, deployedApps } = get();
        if (!lastDeployedAppName) return null;
        const app = deployedApps[lastDeployedAppName];
        if (!app) return null;
        return {
          appName: lastDeployedAppName,
          appVersion: app.appVersion,
        };
      },

      // Browse Data feature actions
      setBrowseConfig: (config) =>
        set((state) => ({
          browseConfig: { ...state.browseConfig, ...config },
        })),
      resetBrowseConfig: () => set({ browseConfig: DEFAULT_BROWSE_CONFIG }),
    }),
    {
      name: 'turbo-gateway-store',
      version: 1,
      // Identity migration. Without a `migrate`, zustand DISCARDS all persisted
      // state whenever the stored version != this version — silently wiping the
      // user's upload/deploy history, Pages drafts, custom config and session on
      // every version bump (and it already did so when v1 shipped). Every field
      // below is defensively normalized on read (see onRehydrateStorage and the
      // per-field getters), so passing the persisted state straight through is
      // safe and preserves user data across future bumps. Add per-version
      // transforms here as the shape evolves.
      migrate: (persistedState) => persistedState as StoreState,
      partialize: (state) => ({
        address: state.address,
        walletType: state.walletType,
        solanaWalletName: state.solanaWalletName,
        linkedSolanaAddress: state.linkedSolanaAddress,
        linkedSolanaWalletName: state.linkedSolanaWalletName,
        arnsNamesCache: state.arnsNamesCache,
        ownedArnsCache: state.ownedArnsCache,
        uploadHistory: state.uploadHistory,
        deployHistory: state.deployHistory,
        pages: state.pages,
        uploadStatusCache: state.uploadStatusCache,
        theme: state.theme,
        configMode: state.configMode,
        customConfig: state.customConfig,
        x402OnlyMode: state.x402OnlyMode,
        // JIT payment preferences
        jitPaymentEnabled: state.jitPaymentEnabled,
        jitMaxTokenAmount: state.jitMaxTokenAmount,
        jitBufferMultiplier: state.jitBufferMultiplier,
        // Smart Deploy state
        fileHashCache: state.fileHashCache,
        smartDeployEnabled: state.smartDeployEnabled,
        // Price-display preference
        priceDisplayCurrency: state.priceDisplayCurrency,
        // App Details state
        deployedApps: state.deployedApps,
        lastDeployedAppName: state.lastDeployedAppName,
        // Browse Data feature state
        browseConfig: state.browseConfig,
      }),
      // Defensively migrate/normalize persisted Pages defs on load so a corrupt or
      // older stored def can never throw the editor/renderer. validate/migrate is
      // idempotent (see schema.test.ts), so this is a no-op for already-valid defs.
      onRehydrateStorage: () => (state) => {
        if (!state || !Array.isArray(state.pages) || state.pages.length === 0) return;
        try {
          state.pages = state.pages.map((p) => {
            try {
              return {
                ...p,
                def: migratePageDef(p.def),
                // Defend downstream renders (PageCard, VersionHistory) against a
                // corrupt persisted shape — coerce the fields they iterate.
                versions: Array.isArray(p.versions) ? p.versions : [],
                currentVersion: typeof p.currentVersion === 'number' ? p.currentVersion : 0,
              };
            } catch {
              return p; // never drop a page over a bad def
            }
          });
        } catch {
          /* never block rehydration */
        }
      },
    }
  )
);

// Expose store to window for dynamic configuration access
if (typeof window !== 'undefined') {
  (window as any).__TURBO_STORE__ = useStore;
}
