import { ARIO, ANT, type SolanaSigner } from '@ar.io/sdk/solana';
import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
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
 * Create ANT write-enabled client for a specific processId using a Solana signer.
 */
export const getWritableANT = async (processId: string, signer: SolanaSigner) => {
  const config = getCurrentConfig();
  const rpcUrl = getSolanaRpcUrl();
  const rpc = createSolanaRpc(rpcUrl);
  const rpcSubscriptions = createSolanaRpcSubscriptions(getSolanaWsUrl(rpcUrl));

  return ANT.init({
    processId,
    rpc,
    rpcSubscriptions,
    signer,
    antProgramId: config.antProgramId as Address | undefined,
  });
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
