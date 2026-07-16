import { useQuery } from '@tanstack/react-query';

import { getARIO } from '../../../utils/arIOConfig';
import { isValidArNSName, lowerCaseDomain } from '../utils';

export type ArNSAvailability = {
  available: boolean;
  name: string;
};

/**
 * Check whether an ArNS name is registrable by reading the on-chain registry
 * (`ARIO.getArNSRecord`). A returned record ⇒ taken; a null/throw ⇒ available.
 * Mirrors the existing `OwnedName`/`ArNSPanel` read pattern, but as a debounced,
 * cached React Query so the buy form can gate on it.
 */
export function useArNSAvailability(name: string) {
  const normalized = lowerCaseDomain(name);
  const enabled = normalized.length > 0 && isValidArNSName(normalized);

  return useQuery<ArNSAvailability>({
    queryKey: ['arns-availability', normalized],
    enabled,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      const ario = getARIO();
      try {
        const record = await ario.getArNSRecord({ name: normalized });
        return { name: normalized, available: !record };
      } catch {
        // No record / lookup miss ⇒ treat as available (same as ArNSPanel).
        return { name: normalized, available: true };
      }
    },
  });
}
