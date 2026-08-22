import {
  ARIO,
  ANT,
  SolanaANTRegistryReadable,
  getPrimaryNamePDA,
  getPrimaryNameReversePDA,
  hashName,
  type SolanaSigner,
} from '@ar.io/sdk/solana';
import {
  getMigratePrimaryNameReverseInstruction,
  getRemovePrimaryNameInstructionAsync,
} from '@ar.io/solana-contracts/core';
import {
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
} from '@solana-program/compute-budget';
import {
  appendTransactionMessageInstructions,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  fetchEncodedAccount,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  address,
} from '@solana/kit';
import type {
  Address,
  SignatureBytes,
  Transaction as KitTransaction,
  TransactionWithLifetime,
  TransactionWithinSizeLimit,
} from '@solana/kit';
import { VersionedMessage, VersionedTransaction } from '@solana/web3.js';
import { APP_NAME, APP_VERSION } from '../constants';

/**
 * Get current developer configuration from store
 */
const getCurrentConfig = () => {
  if (typeof window !== 'undefined' && (window as any).__TURBO_STORE__) {
    return (window as any).__TURBO_STORE__.getState().getCurrentConfig();
  }

  // Fallback to production defaults
  return {
    tokenMap: { solana: 'https://api.mainnet-beta.solana.com' },
    coreProgramId: undefined,
    garProgramId: undefined,
    arnsProgramId: undefined,
    antProgramId: undefined,
  };
};

const getSolanaRpcUrl = () => {
  const config = getCurrentConfig();
  return config.tokenMap?.solana || 'https://api.mainnet-beta.solana.com';
};

const getSolanaWsUrl = (rpcUrl: string) => {
  if (rpcUrl.startsWith('https://')) return rpcUrl.replace('https://', 'wss://');
  if (rpcUrl.startsWith('http://')) return rpcUrl.replace('http://', 'ws://');
  return rpcUrl;
};

/**
 * The RPC + WS-subscription transport pair for write-enabled clients.
 *
 * Memoised per network config, for the same reason the read clients below are:
 * every `createSolanaRpc` attaches listeners to shared Node-polyfilled emitters,
 * and every `createSolanaRpcSubscriptions` opens a WebSocket. This used to be
 * rebuilt on EVERY call — and there are ~30 call sites, one per write action
 * (buy, renew, set record, transfer, controllers, undernames…). Nothing closed
 * them, so a session doing several writes accumulated sockets against the RPC
 * provider's connection limit.
 *
 * Deliberately caches only the TRANSPORT, never the client. The SDK client is
 * still constructed per call with the caller's signer, so a cached client can
 * never sign with a stale wallet — the failure mode that produced the
 * pay-from-the-wrong-wallet bug.
 */
let cachedWriteSig: string | null = null;
let cachedWriteRpc: ReturnType<typeof createSolanaRpc> | null = null;
let cachedWriteSubs: ReturnType<typeof createSolanaRpcSubscriptions> | null = null;

const getSolanaRpcClients = () => {
  const sig = configSignature();
  if (sig !== cachedWriteSig) {
    cachedWriteSig = sig;
    cachedWriteRpc = null;
    cachedWriteSubs = null;
  }
  const rpcUrl = getSolanaRpcUrl();
  if (!cachedWriteRpc) cachedWriteRpc = createSolanaRpc(rpcUrl);
  if (!cachedWriteSubs) {
    cachedWriteSubs = createSolanaRpcSubscriptions(getSolanaWsUrl(rpcUrl));
  }
  return { rpc: cachedWriteRpc, rpcSubscriptions: cachedWriteSubs };
};

// --- Cached read clients (one per active network config) ---------------------
// getARIO/getANT/getSolanaReadRpc/getANTRegistry used to rebuild a fresh
// createSolanaRpc(...) + SDK client on EVERY call. Each new RPC attaches
// listeners to shared Node-polyfilled emitters (abort signals, the @solana/rpc
// coalescer), so a read-heavy page like /domains — header primary-name lookup +
// registry index + per-keystroke availability fallbacks + lazy getANT() — blew
// past the default 10-listener ceiling ("MaxListenersExceededWarning") and
// churned redundant RPCs. Memoize a singleton per network-config signature: a
// gateway/program-ID/RPC/mode change yields a new signature and rebuilds; within
// a config everything reuses the SAME rpc + clients.

/** Stable identity of the active Solana read config (RPC URL + program IDs). */
const configSignature = () => {
  const c = getCurrentConfig();
  return [
    getSolanaRpcUrl(),
    c.coreProgramId ?? '',
    c.garProgramId ?? '',
    c.arnsProgramId ?? '',
    c.antProgramId ?? '',
  ].join('|');
};

let cachedSig: string | null = null;
let cachedRpc: ReturnType<typeof createSolanaRpc> | null = null;
let cachedArio: ReturnType<typeof ARIO.init> | null = null;
let cachedRegistry: SolanaANTRegistryReadable | null = null;
const antClientCache = new Map<string, ReturnType<typeof ANT.init>>();

/** Drop every cached read client when the network config changes. No-op otherwise. */
const syncConfigCache = () => {
  const sig = configSignature();
  if (sig !== cachedSig) {
    cachedSig = sig;
    cachedRpc = null;
    cachedArio = null;
    cachedRegistry = null;
    antClientCache.clear();
  }
};

/** The one shared read RPC for the active config (rebuilt only on config change). */
const readRpc = () => {
  syncConfigCache();
  if (!cachedRpc) cachedRpc = createSolanaRpc(getSolanaRpcUrl());
  return cachedRpc;
};

/**
 * A raw Solana read RPC bound to the active config's endpoint. For low-level
 * reads (e.g. the MPL Core owner-scan in ACL-drift detection) that the SDK
 * clients don't expose. Shared singleton per config.
 */
export const getSolanaReadRpc = () => readRpc();

/**
 * ANT Registry read client bound to the active config's ANT program. Exposes
 * `accessControlList({ address })` → `{ Owned, Controlled }`, the wallet's
 * on-chain ACL used for ownership-drift detection. Cached per config.
 */
export const getANTRegistry = () => {
  syncConfigCache();
  if (!cachedRegistry) {
    const config = getCurrentConfig();
    cachedRegistry = new SolanaANTRegistryReadable({
      rpc: readRpc() as any,
      antProgramId: config.antProgramId as Address | undefined,
    });
  }
  return cachedRegistry;
};

/**
 * Get ARIO read-only client with dynamic Solana configuration. Cached per config.
 */
export const getARIO = () => {
  syncConfigCache();
  if (!cachedArio) {
    const config = getCurrentConfig();
    cachedArio = ARIO.init({
      rpc: readRpc(),
      coreProgramId: config.coreProgramId as Address | undefined,
      garProgramId: config.garProgramId as Address | undefined,
      arnsProgramId: config.arnsProgramId as Address | undefined,
      antProgramId: config.antProgramId as Address | undefined,
    });
  }
  return cachedArio;
};

/**
 * Get ANT read-only client for a specific processId (ANT asset address on Solana).
 * Cached per (config, processId) so repeated target resolutions reuse one client.
 * @param processId - The ANT process ID
 */
const MAX_ANT_CLIENTS = 256; // bound the per-processId cache (browse/account can touch many names)

export const getANT = async (processId: string) => {
  syncConfigCache();
  const existing = antClientCache.get(processId);
  if (existing) {
    // Refresh LRU position so hot ANTs survive eviction.
    antClientCache.delete(processId);
    antClientCache.set(processId, existing);
    return existing;
  }
  const config = getCurrentConfig();
  const client = ANT.init({
    processId,
    rpc: readRpc(),
    antProgramId: config.antProgramId as Address | undefined,
  });
  // Evict the oldest entry when over the cap (Map preserves insertion order).
  if (antClientCache.size >= MAX_ANT_CLIENTS) {
    const oldest = antClientCache.keys().next().value;
    if (oldest !== undefined) antClientCache.delete(oldest);
  }
  antClientCache.set(processId, client);
  return client;
};

/**
 * Create an ARIO write-enabled client bound to a Solana signer.
 *
 * Used for on-chain ArNS purchases via `buyRecord` — which, on @ar.io/sdk
 * >= 4.1.0-alpha.5, atomically mints a fresh user-owned ANT AND assigns the
 * name in a single transaction when `processId` is omitted (no client
 * pre-spawn, no orphaned-ANT window). Mirrors `getWritableANT` but targets the
 * ARIO registry program set.
 */
export const getWritableARIO = (signer: SolanaSigner) => {
  const config = getCurrentConfig();
  const { rpc, rpcSubscriptions } = getSolanaRpcClients();

  return ARIO.init({
    rpc,
    rpcSubscriptions,
    signer,
    coreProgramId: config.coreProgramId as Address | undefined,
    garProgramId: config.garProgramId as Address | undefined,
    arnsProgramId: config.arnsProgramId as Address | undefined,
    antProgramId: config.antProgramId as Address | undefined,
  });
};

/**
 * Create ANT write-enabled client for a specific processId using a Solana signer.
 */
export const getWritableANT = async (processId: string, signer: SolanaSigner) => {
  const config = getCurrentConfig();
  const { rpc, rpcSubscriptions } = getSolanaRpcClients();

  return ANT.init({
    processId,
    rpc,
    rpcSubscriptions,
    signer,
    antProgramId: config.antProgramId as Address | undefined,
  });
};

/**
 * Remove the connected wallet's primary (reverse-resolution) name.
 *
 * There is no high-level SDK method for this on Solana — `ARIO.removePrimaryNames`
 * throws "not applicable on Solana". So, like the arns-react app, we build the
 * ario-core instructions directly and send them via `@solana/kit`:
 *   1. `migrate_primary_name_reverse` — ONLY when the reverse PDA hasn't been
 *      migrated to the current layout yet (older records); skipped otherwise.
 *   2. `remove_primary_name` — clears the forward + reverse mapping.
 *
 * A single signature, gas-only (no ARIO price). The removed name still exists
 * and is still owned — only the reverse (name → wallet) link is cleared.
 */
export const removePrimaryName = async (
  name: string,
  signer: SolanaSigner,
): Promise<string> => {
  const config = getCurrentConfig();
  const { rpc, rpcSubscriptions } = getSolanaRpcClients();
  const coreProgram = config.coreProgramId
    ? (address(config.coreProgramId) as Address)
    : undefined;

  const [primaryNamePda] = coreProgram
    ? await getPrimaryNamePDA(signer.address, coreProgram)
    : await getPrimaryNamePDA(signer.address);
  const [primaryNameReversePda] = coreProgram
    ? await getPrimaryNameReversePDA(name, coreProgram)
    : await getPrimaryNameReversePDA(name);

  const ixs: any[] = [];

  // The reverse PDA only needs migrating when it predates the current layout;
  // if it already exists in the new form, skip the migrate ix.
  const reverseAccount = await fetchEncodedAccount(rpc, primaryNameReversePda, {
    commitment: 'confirmed',
  });
  if (!reverseAccount.exists) {
    ixs.push(
      getMigratePrimaryNameReverseInstruction(
        { reverse: primaryNameReversePda, payer: signer as any },
        coreProgram ? { programAddress: coreProgram } : undefined,
      ),
    );
  }

  ixs.push(
    await getRemovePrimaryNameInstructionAsync(
      {
        primaryName: primaryNamePda,
        primaryNameReverse: primaryNameReversePda,
        owner: signer as any,
        reverseLookupHash: hashName(name),
      },
      coreProgram ? { programAddress: coreProgram } : undefined,
    ),
  );

  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(signer as any, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) =>
      appendTransactionMessageInstructions(
        [
          getSetComputeUnitLimitInstruction({ units: 400_000 }),
          getSetComputeUnitPriceInstruction({ microLamports: 0n }),
          ...ixs,
        ],
        tx,
      ),
  );

  const signedTx = await signTransactionMessageWithSigners(message);
  const sendAndConfirm = sendAndConfirmTransactionFactory({
    rpc: rpc as any,
    rpcSubscriptions: rpcSubscriptions as any,
  });
  await sendAndConfirm(signedTx as any, { commitment: 'confirmed' });
  return getSignatureFromTransaction(signedTx);
};

/**
 * Create a kit-compatible TransactionModifyingSigner from a wallet adapter.
 *
 * Uses signTransaction (sign without sending) rather than sendTransaction,
 * because wallets like Phantom may rewrite transactions (adding priority fees,
 * tightening CU limits). A modifying signer returns the wallet's rewritten
 * message + signature so the bytes signed == the bytes sent.
 *
 * Adapted from ar-io-network-portal's walletAdapterBridge.ts
 */
export const createWalletAdapterTransactionSendingSigner = (
  walletAddress: string,
  _connection: unknown, // kept for API compat, no longer used
  _sendTransaction: unknown, // kept for API compat, no longer used
  signTransaction?: (transaction: VersionedTransaction) => Promise<VersionedTransaction>,
): SolanaSigner => {
  if (!signTransaction) {
    throw new Error('Wallet does not support transaction signing');
  }

  const signerAddress = address(walletAddress) as Address;

  return {
    address: signerAddress,
    modifyAndSignTransactions: async (
      transactions: readonly KitTransaction[],
    ): Promise<readonly (KitTransaction & TransactionWithinSizeLimit & TransactionWithLifetime)[]> => {
      return Promise.all(
        transactions.map(async (tx) => {
          // Convert kit transaction to web3.js VersionedTransaction for the wallet
          const messageBytes = new Uint8Array(tx.messageBytes as unknown as Uint8Array);
          const message = VersionedMessage.deserialize(messageBytes);
          const v3tx = new VersionedTransaction(message);

          // Preserve any signatures kit may have already attached (e.g. a paired keypair signer)
          const staticAccountKeys = message.staticAccountKeys;
          const numRequired = message.header.numRequiredSignatures;
          for (let i = 0; i < numRequired; i++) {
            const accountAddress = staticAccountKeys[i].toBase58();
            const existingSig = (tx.signatures as Record<string, Uint8Array | null>)[accountAddress];
            if (existingSig) {
              v3tx.signatures[i] = existingSig;
            }
          }

          // Let the wallet sign (and possibly rewrite) the transaction
          const signed = await signTransaction(v3tx);

          // Extract signatures from the signed transaction
          const signedKeys = signed.message.staticAccountKeys;
          const numSigners = signed.message.header.numRequiredSignatures;
          const signatures: Record<string, SignatureBytes> = {};
          for (let i = 0; i < numSigners; i++) {
            const s = signed.signatures[i];
            if (s && !s.every((b) => b === 0)) {
              signatures[signedKeys[i].toBase58()] = s as SignatureBytes;
            }
          }

          // Carry the original lifetime constraint for kit's confirmation step
          const lifetimeConstraint = (
            tx as KitTransaction & Partial<TransactionWithLifetime>
          ).lifetimeConstraint;

          return {
            messageBytes: signed.message.serialize() as unknown as KitTransaction['messageBytes'],
            signatures: signatures as unknown as KitTransaction['signatures'],
            ...(lifetimeConstraint ? { lifetimeConstraint } : {}),
          } as unknown as KitTransaction & TransactionWithinSizeLimit & TransactionWithLifetime;
        }),
      );
    },
  } as unknown as SolanaSigner;
};

// Write options for ANT interactions
export const WRITE_OPTIONS = {
  tags: [
    {
      name: 'App-Name',
      value: APP_NAME,
    },
    {
      name: 'App-Version',
      value: APP_VERSION,
    },
  ],
};
