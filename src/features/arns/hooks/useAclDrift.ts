import { useQuery } from '@tanstack/react-query';

import { computeAclDrift, type AclDriftRecord } from '../services/aclDrift';
import { useArNSConfigKey } from './useArNSConfigKey';

/**
 * Detect ArNS names the connected wallet owns on-chain (via a Metaplex Core
 * owner-scan) but which are missing from its ACL — the result of an out-of-band
 * ANT transfer. These names don't appear in `getArNSRecordsForAddress` and need
 * `syncAcl` to be reconciled. See {@link computeAclDrift}.
 *
 * Config-keyed (network-aware) and cached for a few minutes; the owner-scan is a
 * single targeted `getProgramAccounts`, so it's cheap but not free — enabled
 * only when an address is present.
 */
export function useAclDrift(address: string | null | undefined) {
  const configKey = useArNSConfigKey();
  return useQuery<AclDriftRecord[]>({
    queryKey: ['arns-acl-drift', configKey, address],
    enabled: !!address,
    staleTime: 5 * 60_000,
    // Drift rarely changes and the scan is a getProgramAccounts owner-scan —
    // don't re-run it on every tab refocus.
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: () => computeAclDrift(address as string),
  });
}
