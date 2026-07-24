import { useEffect, useRef, useState } from 'react';
import { TurboFactory } from '@ardrive/turbo-sdk/web';
import { useStore } from '../store/useStore';

/** The bundler's free-tier configuration (per-item size cap + lifetime/IP quotas). */
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

// Pure free-tier logic lives in utils/freeTier (dependency-free + node-testable);
// re-exported here so existing `../hooks/useFreeUploadLimit` import sites keep working.
export { isFileFree, computeFreeFlags } from '../utils/freeTier';

/** The connected wallet's remaining free-tier allowance. */
export interface FreeStatus {
  /**
   * The connected wallet's remaining free-tier bytes:
   * a number = bytes left (0 = none), `null` = unlimited (exempt/partner wallet),
   * `undefined` = unknown (no wallet or the query failed).
   */
  bytesRemaining: number | null | undefined;
}

/**
 * Fetch the connected wallet's remaining free-tier allowance.
 *
 * Uses the payment service's `getFreeStatus` (open-by-address, no signing needed),
 * so we can tell whether a wallet still has free uploads left before showing a
 * "FREE" label. Refreshes on wallet change and after payments/uploads (the
 * `refresh-balance` event). Returns `undefined` when there is no wallet or the
 * query fails, so callers fall back to the advisory size-only check.
 */
export function useFreeStatus(): FreeStatus {
  const address = useStore((s) => s.address);
  const paymentServiceUrl = useStore((s) => s.getCurrentConfig().paymentServiceUrl);
  const [bytesRemaining, setBytesRemaining] = useState<number | null | undefined>(undefined);
  // Monotonic request counter so a slower earlier fetch can't overwrite a newer one.
  const seqRef = useRef(0);

  useEffect(() => {
    if (!address) {
      setBytesRemaining(undefined);
      return;
    }
    // Clear the previous wallet's allowance immediately so a wallet switch never
    // prices against the old quota during the fetch (falls back to size-only until
    // the new value lands).
    setBytesRemaining(undefined);
    let cancelled = false;
    const fetchStatus = async () => {
      const seq = ++seqRef.current;
      const apply = (v: number | null | undefined) => {
        // Only apply if still mounted AND this is the latest in-flight request
        // (e.g. a post-payment `refresh-balance` fetch must win over the mount one).
        if (!cancelled && seq === seqRef.current) setBytesRemaining(v);
      };
      try {
        const turbo = TurboFactory.unauthenticated({
          paymentServiceConfig: { url: paymentServiceUrl },
        });
        const { bytesRemaining: remaining } = await turbo.getFreeStatus(address);
        apply(remaining);
      } catch (err) {
        console.warn('Failed to fetch free-tier status:', err);
        apply(undefined);
      }
    };
    fetchStatus();
    const onRefresh = () => fetchStatus();
    window.addEventListener('refresh-balance', onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener('refresh-balance', onRefresh);
    };
  }, [address, paymentServiceUrl]);

  return { bytesRemaining };
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
