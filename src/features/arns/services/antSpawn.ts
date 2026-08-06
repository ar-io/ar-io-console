import { ANT, type SolanaSigner } from '@ar.io/sdk/solana';
import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  type Address,
} from '@solana/kit';

/**
 * Client-side ANT spawn for the Model B (user-owned) buy path.
 *
 * The buyer's Solana signer mints a fresh Metaplex Core ANT asset (and its
 * `ario-ant` PDAs) in one atomic tx, so the user self-owns the name's ANT from
 * the first block. The returned `processId` (the asset pubkey) is then handed to
 * the bundler's `buyArNSName` so it can write the record into the user's ANT.
 *
 * Spawning costs real SOL (~0.02), so callers MUST persist the returned
 * processId (see `arnsPurchaseResume`) and reuse it on retry — never spawn twice
 * for one purchase. This mirrors arns-react's `ANT.spawn` call in
 * `dispatchArNSPurchaseWithCredits`, but takes the RPC url + program id
 * explicitly (from console's store config) instead of a global solana-config
 * singleton.
 */
export async function spawnArNSAnt({
  signer,
  name,
  rpcUrl,
  antProgramId,
  targetId,
}: {
  /** Buyer's Solana signer (kit `SolanaSigner`) — pays rent + receives the NFT. */
  signer: SolanaSigner;
  /** ArNS name (also the ANT display name). */
  name: string;
  /** Solana RPC url from the active console config (`tokenMap.solana`). */
  rpcUrl: string;
  /** Deployed `ario-ant` program id (devnet vs mainnet, from config). */
  antProgramId: string | undefined;
  /** Optional Arweave TX id for the root `@` record (defaults to AR.IO logo). */
  targetId?: string;
}): Promise<{ processId: string }> {
  const rpc = createSolanaRpc(rpcUrl);
  const rpcSubscriptions = createSolanaRpcSubscriptions(toWsUrl(rpcUrl));

  const result = await ANT.spawn({
    rpc,
    rpcSubscriptions,
    signer,
    ...(antProgramId ? { antProgramId: antProgramId as Address } : {}),
    state: {
      name,
      ...(targetId ? { transactionId: targetId } : {}),
    },
  });

  return { processId: result.processId };
}

function toWsUrl(rpcUrl: string): string {
  if (rpcUrl.startsWith('https://')) return rpcUrl.replace('https://', 'wss://');
  if (rpcUrl.startsWith('http://')) return rpcUrl.replace('http://', 'ws://');
  return rpcUrl;
}
