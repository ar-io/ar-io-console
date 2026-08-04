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
 * Build the RPC + WS-subscription client pair from the active Solana config.
 * Shared by the write-enabled clients so URL derivation lives in one place.
 */
const getSolanaRpcClients = () => {
  const rpcUrl = getSolanaRpcUrl();
  return {
    rpc: createSolanaRpc(rpcUrl),
    rpcSubscriptions: createSolanaRpcSubscriptions(getSolanaWsUrl(rpcUrl)),
  };
};

/**
 * A raw Solana read RPC bound to the active config's endpoint. For low-level
 * reads (e.g. the MPL Core owner-scan in ACL-drift detection) that the SDK
 * clients don't expose.
 */
export const getSolanaReadRpc = () => createSolanaRpc(getSolanaRpcUrl());

/**
 * ANT Registry read client bound to the active config's ANT program. Exposes
 * `accessControlList({ address })` → `{ Owned, Controlled }`, the wallet's
 * on-chain ACL used for ownership-drift detection.
 */
export const getANTRegistry = () => {
  const config = getCurrentConfig();
  return new SolanaANTRegistryReadable({
    rpc: createSolanaRpc(getSolanaRpcUrl()) as any,
    antProgramId: config.antProgramId as Address | undefined,
  });
};

/**
 * Get ARIO read-only client with dynamic Solana configuration.
 */
export const getARIO = () => {
  const config = getCurrentConfig();
  const rpc = createSolanaRpc(getSolanaRpcUrl());

  return ARIO.init({
    rpc,
    coreProgramId: config.coreProgramId as Address | undefined,
    garProgramId: config.garProgramId as Address | undefined,
    arnsProgramId: config.arnsProgramId as Address | undefined,
    antProgramId: config.antProgramId as Address | undefined,
  });
};

/**
 * Get ANT read-only client for a specific processId (ANT asset address on Solana).
 * @param processId - The ANT process ID
 */
export const getANT = async (processId: string) => {
  const config = getCurrentConfig();
  const rpc = createSolanaRpc(getSolanaRpcUrl());

  return ANT.init({
    processId,
    rpc,
    antProgramId: config.antProgramId as Address | undefined,
  });
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
