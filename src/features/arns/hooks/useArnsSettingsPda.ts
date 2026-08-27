import { useQuery } from '@tanstack/react-query';
import { getArnsSettingsPDA } from '@ar.io/sdk/solana';
import type { Address } from '@solana/kit';

import { useStore } from '../../../store/useStore';
import { useArNSConfigKey } from './useArNSConfigKey';

/**
 * The ArNS settings (config) PDA address for the active program. Used to tell a
 * returned name's origin apart: the protocol auto-returns an **expired lease**
 * with this config PDA as the `initiator`, whereas an owner who **permanently
 * releases** a name is the initiator. Computed once (deterministic PDA
 * derivation, no per-name RPC) and cached per network config.
 */
export function useArnsSettingsPda(): string | undefined {
  const configKey = useArNSConfigKey();
  const arnsProgramId = useStore((s) => s.getCurrentConfig().arnsProgramId);

  const { data } = useQuery<string>({
    queryKey: ['arns-settings-pda', configKey],
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const [pda] = await getArnsSettingsPDA(
        arnsProgramId as Address | undefined,
      );
      return pda.toString();
    },
  });
  return data;
}

/** Human label for a returned name's origin, given the settings PDA. */
export function returnedNameOrigin(
  initiator: string,
  settingsPda: string | undefined,
): 'Lease expiry' | 'Permanently released' | undefined {
  if (!settingsPda) return undefined;
  return initiator === settingsPda ? 'Lease expiry' : 'Permanently released';
}
