import { ARIO, ANT, type SolanaSigner } from "@ar.io/sdk/solana";
import {
    createSolanaRpc,
    createSolanaRpcSubscriptions,
    getBase58Encoder,
    getBase64EncodedWireTransaction,
} from "@solana/kit";
import type { Address } from "@solana/kit";
import { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";

/**
 * Get current developer configuration from store
 */
const getCurrentConfig = () => {
    if (typeof window !== "undefined" && (window as any).__TURBO_STORE__) {
        return (window as any).__TURBO_STORE__.getState().getCurrentConfig();
    }

    // Fallback to production defaults
    return {
        tokenMap: { solana: "https://api.mainnet-beta.solana.com" },
        coreProgramId: undefined,
        garProgramId: undefined,
        arnsProgramId: undefined,
        antProgramId: undefined,
    };
};

const getSolanaRpcUrl = () => {
    const config = getCurrentConfig();
    return config.tokenMap?.solana || "https://api.mainnet-beta.solana.com";
};

const getSolanaWsUrl = (rpcUrl: string) => {
    if (rpcUrl.startsWith("https://"))
        return rpcUrl.replace("https://", "wss://");
    if (rpcUrl.startsWith("http://")) return rpcUrl.replace("http://", "ws://");
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
export const getWritableANT = async (
    processId: string,
    signer: SolanaSigner,
) => {
    const config = getCurrentConfig();
    const rpcUrl = getSolanaRpcUrl();
    const rpc = createSolanaRpc(rpcUrl);
    const rpcSubscriptions = createSolanaRpcSubscriptions(
        getSolanaWsUrl(rpcUrl),
    );

    return ANT.init({
        processId,
        rpc,
        rpcSubscriptions,
        signer,
        antProgramId: config.antProgramId as Address | undefined,
    });
};

export const createWalletAdapterTransactionSendingSigner = (
    walletAddress: string,
    connection: Connection,
    sendTransaction: (
        transaction: Transaction | VersionedTransaction,
        connection: Connection,
        options?: any,
    ) => Promise<string>,
): SolanaSigner => {
    const base58Encoder = getBase58Encoder();

    return {
        address: walletAddress as Address,
        signAndSendTransactions: async (transactions: readonly any[]) => {
            const signatures: Uint8Array[] = [];

            for (const transaction of transactions) {
                const base64WireTransaction = getBase64EncodedWireTransaction(
                    transaction as any,
                );
                const wireBytes = Uint8Array.from(
                    atob(base64WireTransaction),
                    (c) => c.charCodeAt(0),
                );

                let walletTransaction: Transaction | VersionedTransaction;
                try {
                    walletTransaction =
                        VersionedTransaction.deserialize(wireBytes);
                } catch {
                    walletTransaction = Transaction.from(wireBytes);
                }

                const signature = await sendTransaction(
                    walletTransaction,
                    connection,
                    {
                        preflightCommitment: "processed",
                    },
                );
                signatures.push(
                    Uint8Array.from(base58Encoder.encode(signature)) as any,
                );
            }

            return signatures;
        },
    } as unknown as SolanaSigner;
};

// Write options for ANT interactions
export const WRITE_OPTIONS = {
    tags: [
        {
            name: "App-Name",
            value: "ar.io Console",
        },
        {
            name: "App-Version",
            value: "0.4.1",
        },
    ],
};
