import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';

export interface FreeTier {
  /** Max bytes per individual data item for free uploads */
  maxItemBytes: number;
  /** Lifetime free bytes per authenticated user (0 = no lifetime cap) */
  lifetimeBytes: number;
  /** Free bytes per IP for unauthenticated users (0 = no IP cap) */
  ipBytes: number;
}

const DEFAULT_FREE_TIER: FreeTier = {
  maxItemBytes: 0,
  lifetimeBytes: 0,
  ipBytes: 0,
};

/**
 * Hook to fetch and sync the bundler's free upload limit from the upload service.
 * Automatically fetches on mount and when the upload service URL changes.
 * Defaults to 0 bytes (no free tier) if the limit cannot be fetched.
 *
 * Returns the per-item free limit (maxItemBytes) for backwards compatibility,
 * plus the full freeTier object for components that need lifetime/IP quota info.
 */
export function useFreeUploadLimit() {
  const uploadServiceUrl = useStore(s => s.getCurrentConfig().uploadServiceUrl);
  const [freeUploadLimitBytes, setFreeUploadLimitBytes] = useState<number>(0);
  const [freeTier, setFreeTier] = useState<FreeTier>(DEFAULT_FREE_TIER);

  useEffect(() => {
    const fetchFreeUploadLimit = async () => {
      // Guard against undefined uploadServiceUrl
      if (!uploadServiceUrl) {
        console.warn('Upload service URL not configured, defaulting to 0 free bytes');
        setFreeUploadLimitBytes(0);
        setFreeTier(DEFAULT_FREE_TIER);
        return;
      }

      try {
        const response = await fetch(uploadServiceUrl);

        if (!response.ok) {
          console.warn('Failed to fetch bundler info, defaulting to 0 free bytes');
          setFreeUploadLimitBytes(0);
          setFreeTier(DEFAULT_FREE_TIER);
          return;
        }

        const data = await response.json();

        // Extract freeUploadLimitBytes (per-item cap), default to 0 if not present
        const limitBytes = data.freeUploadLimitBytes ?? 0;

        // Extract freeTier object if present (new API shape)
        const tier: FreeTier = data.freeTier
          ? {
              maxItemBytes: data.freeTier.maxItemBytes ?? limitBytes,
              lifetimeBytes: data.freeTier.lifetimeBytes ?? 0,
              ipBytes: data.freeTier.ipBytes ?? 0,
            }
          : { maxItemBytes: limitBytes, lifetimeBytes: 0, ipBytes: 0 };

        console.log(
          `Bundler free upload limit: ${limitBytes} bytes (${(limitBytes / 1024).toFixed(2)} KiB)` +
          (tier.lifetimeBytes > 0 ? `, lifetime cap: ${formatFreeLimit(tier.lifetimeBytes)}` : '')
        );
        setFreeUploadLimitBytes(limitBytes);
        setFreeTier(tier);
      } catch (error) {
        console.warn('Error fetching bundler free upload limit, defaulting to 0:', error);
        setFreeUploadLimitBytes(0);
        setFreeTier(DEFAULT_FREE_TIER);
      }
    };

    fetchFreeUploadLimit();
  }, [uploadServiceUrl, setFreeUploadLimitBytes]);

  return { freeUploadLimitBytes, freeTier };
}

/**
 * Utility function to check if a file size is within the free upload limit
 * @param fileSize - File size in bytes
 * @param freeLimit - Free upload limit in bytes (per-item cap) from the bundler
 * @returns true if the file is within the per-item free size limit
 */
export function isFileFree(fileSize: number, freeLimit: number): boolean {
  return fileSize < freeLimit && freeLimit > 0;
}

/**
 * Format a byte limit for display
 * @param limitBytes - Byte count to format
 * @returns Formatted string (e.g., "105 KiB", "10 MiB", "No free tier")
 */
export function formatFreeLimit(limitBytes: number): string {
  if (limitBytes === 0) {
    return 'No free tier';
  }

  const kib = limitBytes / 1024;

  if (kib < 1) {
    return `${limitBytes} bytes`;
  } else if (kib < 1024) {
    return `${kib.toFixed(0)} KiB`;
  } else {
    const mib = kib / 1024;
    return `${mib.toFixed(mib % 1 === 0 ? 0 : 2)} MiB`;
  }
}
