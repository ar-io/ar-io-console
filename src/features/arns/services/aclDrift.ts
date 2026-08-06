import { MPL_CORE_PROGRAM_ID } from '@ar.io/sdk/solana';
import { getBase58Decoder } from '@solana/kit';

import { getARIO, getANTRegistry, getSolanaReadRpc } from '../../../utils';

/**
 * ArNS ACL ownership-drift detection (Solana).
 *
 * The on-chain ANT ACL (paginated AclConfig/AclPage PDAs) is an
 * eventually-consistent index of the ANTs a wallet owns/controls, and it powers
 * `getArNSRecordsForAddress` ("your names"). A **raw Metaplex Core transfer**
 * (a direct send or an NFT-marketplace sale) moves the asset immediately but
 * does NOT update the ACL — so a name the wallet now owns can be missing from
 * "your names" until someone calls `syncAcl` on it.
 *
 * This finds those drifted-in names by establishing ground truth from the MPL
 * Core side (an owner-scan for the wallet's asset accounts) and diffing against
 * the wallet's ACL owner set. We deliberately DON'T parse each asset's Metaplex
 * attributes to pre-filter ANTs: `getArNSRecordsByAntMints` already returns only
 * the mints that are real ArNS-name ANTs, so passing every owned asset mint
 * filters to ANTs without the fragile binary-layout parsing.
 */

/** A name the wallet owns on-chain but whose ACL owner entry is missing. */
export interface AclDriftRecord {
  name: string;
  processId: string;
  type?: 'lease' | 'permabuy';
}

// MPL Core `AssetV1` accounts begin with a 1-byte Key discriminant (`AssetV1`
// === 1); the owner Pubkey follows at offset 1. A memcmp on both restricts the
// getProgramAccounts scan to just this wallet's asset accounts.
const KEY_ASSET_V1_BASE58 = getBase58Decoder().decode(new Uint8Array([1]));
const OWNER_OFFSET = 1n;

type ProgramAccount = { pubkey: { toString(): string } | string };

function pubkeyStr(pk: ProgramAccount['pubkey']): string {
  return typeof pk === 'string' ? pk : pk.toString();
}

/**
 * Every MPL Core asset mint owned by `owner`, via a single targeted
 * `getProgramAccounts` owner-scan (Key + owner memcmp). Includes non-ANT NFTs;
 * the caller filters to ANTs via the ArNS registry.
 */
export async function scanOwnedAssetMints(owner: string): Promise<string[]> {
  const rpc = getSolanaReadRpc();
  const result = (await (rpc as any)
    .getProgramAccounts(MPL_CORE_PROGRAM_ID, {
      commitment: 'confirmed',
      encoding: 'base64',
      // dataSlice: 0 bytes — we only need the pubkeys, not the account data.
      dataSlice: { offset: 0, length: 0 },
      filters: [
        { memcmp: { offset: 0n, bytes: KEY_ASSET_V1_BASE58, encoding: 'base58' } },
        { memcmp: { offset: OWNER_OFFSET, bytes: owner, encoding: 'base58' } },
      ],
    })
    .send()) as ReadonlyArray<ProgramAccount>;
  return result.map((e) => pubkeyStr(e.pubkey));
}

/**
 * Names the wallet owns on-chain (MPL Core) but that are absent from its ACL
 * owner set — i.e. drifted in via an out-of-band transfer and in need of
 * `syncAcl`. Empty when there's no drift (or the wallet owns no ANT assets).
 */
export async function computeAclDrift(
  owner: string,
): Promise<AclDriftRecord[]> {
  const mints = await scanOwnedAssetMints(owner);
  if (mints.length === 0) return [];

  const ario = getARIO() as unknown as {
    getArNSRecordsByAntMints: (a: {
      mints: ReadonlyArray<string>;
    }) => Promise<Array<{ name: string; processId?: string; type?: 'lease' | 'permabuy' }>>;
  };
  const registry = getANTRegistry() as unknown as {
    accessControlList: (a: { address: string }) => Promise<{
      Owned?: string[];
      Controlled?: string[];
    }>;
  };

  const [records, acl] = await Promise.all([
    ario.getArNSRecordsByAntMints({ mints }),
    registry.accessControlList({ address: owner }),
  ]);

  // Drift = the wallet owns the asset but its ACL OWNER entry is missing. Check
  // the Owned set specifically: a prior controller keeps the asset in Controlled
  // but still needs syncAcl to record the owner entry after taking ownership.
  const ownedAcl = new Set(acl.Owned ?? []);
  return records
    .filter((r): r is AclDriftRecord & { processId: string } =>
      Boolean(r.processId) && !ownedAcl.has(r.processId as string),
    )
    .map((r) => ({ name: r.name, processId: r.processId, type: r.type }));
}
