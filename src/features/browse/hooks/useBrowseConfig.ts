import { useStore } from '@/store/useStore';
import type { BrowseConfig } from '@/store/useStore';

/**
 * Convenience hook for accessing and updating browse configuration.
 * Wraps the Zustand store for a cleaner API.
 */
export function useBrowseConfig() {
  const config = useStore((state) => state.browseConfig);
  const updateConfig = useStore((state) => state.setBrowseConfig);
  const resetConfig = useStore((state) => state.resetBrowseConfig);

  return {
    config,
    updateConfig,
    resetConfig,
  };
}

export type { BrowseConfig };
