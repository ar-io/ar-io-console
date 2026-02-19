import { ARIO } from '@ar.io/sdk';
import type { GatewayWithStake } from '../types';

const CACHE_KEY = 'ar-io-console-trusted-gateways-v2';
const ALL_GATEWAYS_CACHE_KEY = 'ar-io-console-all-gateways-v1';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const TOP_POOL_SIZE = 20; // Always fetch top 20 by stake, then pick from this pool

interface TrustedGatewayCache {
  gateways: GatewayWithStake[];
  fetchedAt: number;
}

/**
 * Get trusted gateways for verification, sorted by total stake.
 * Returns gateways with stake info for display purposes.
 *
 * @param count Number of gateways to return (1-10, default 3)
 * @returns Array of gateways with URL and stake info
 */
export async function getTrustedGateways(count: number = 3): Promise<GatewayWithStake[]> {
  const validCount = Math.max(1, Math.min(20, count));

  // Check cache for the top 20 pool
  const cached = getCachedGateways();
  if (cached) {
    // Shuffle and pick requested count from cached pool
    const shuffled = shuffleArray([...cached]);
    return shuffled.slice(0, validCount);
  }

  // Fetch from AR.IO network
  try {
    const ario = ARIO.mainnet();

    // Fetch ALL gateways since the SDK can't sort by total stake (operator + delegated)
    const result = await ario.getGateways({
      limit: 1000,
    });

    if (!result.items || result.items.length === 0) {
      throw new Error('No gateways returned from AR.IO network');
    }

    // Filter active gateways and calculate total stake (operator + delegated)
    const gatewaysWithTotalStake = result.items
      .filter(gateway => gateway.status === 'joined' && gateway.settings?.fqdn)
      .map(gateway => ({
        url: `https://${gateway.settings.fqdn}`,
        totalStake: (gateway.operatorStake || 0) + (gateway.totalDelegatedStake || 0),
      }));

    // Sort by TOTAL stake descending
    gatewaysWithTotalStake.sort((a, b) => b.totalStake - a.totalStake);

    // Take top N by total stake for the pool
    const topPool = gatewaysWithTotalStake.slice(0, TOP_POOL_SIZE);

    if (topPool.length === 0) {
      throw new Error('No active staked gateways found');
    }

    // Cache the full pool (with stake info)
    cacheGateways(topPool);

    // Shuffle and return requested count
    const shuffled = shuffleArray([...topPool]);
    return shuffled.slice(0, validCount);
  } catch (error) {
    console.error('[Gateways] Failed to fetch staked gateways:', error);
    return [{ url: 'https://turbo-gateway.com', totalStake: 0 }];
  }
}

/**
 * Get the full pool of top-staked gateways (for display in settings).
 * Returns all top 20 gateways sorted by stake (not shuffled).
 */
export async function getTopStakedGateways(): Promise<GatewayWithStake[]> {
  // Check cache
  const cached = getCachedGateways();
  if (cached) {
    // Return sorted by stake (cache is already sorted)
    return cached;
  }

  // Fetch fresh - this will also populate the cache
  // Call with max count to ensure we get full pool
  await getTrustedGateways(TOP_POOL_SIZE);

  // Now return from cache (sorted)
  const freshCached = getCachedGateways();
  return freshCached || [{ url: 'https://turbo-gateway.com', totalStake: 0 }];
}

/**
 * Get ALL joined gateways from the AR.IO network.
 * Returns all gateways sorted by total stake (operator + delegated).
 * Used for the gateway selector combobox.
 */
export async function getAllJoinedGateways(): Promise<GatewayWithStake[]> {
  // Check cache first
  const cached = getCachedAllGateways();
  if (cached) {
    return cached;
  }

  // Fetch from AR.IO network
  try {
    const ario = ARIO.mainnet();

    const result = await ario.getGateways({
      limit: 1000,
    });

    if (!result.items || result.items.length === 0) {
      throw new Error('No gateways returned from AR.IO network');
    }

    // Filter active gateways and calculate total stake (operator + delegated)
    const gatewaysWithTotalStake = result.items
      .filter(gateway => gateway.status === 'joined' && gateway.settings?.fqdn)
      .map(gateway => ({
        url: `https://${gateway.settings.fqdn}`,
        totalStake: (gateway.operatorStake || 0) + (gateway.totalDelegatedStake || 0),
      }));

    // Sort by TOTAL stake descending
    gatewaysWithTotalStake.sort((a, b) => b.totalStake - a.totalStake);

    if (gatewaysWithTotalStake.length === 0) {
      throw new Error('No active staked gateways found');
    }

    // Cache all gateways
    cacheAllGateways(gatewaysWithTotalStake);

    return gatewaysWithTotalStake;
  } catch (error) {
    console.error('[Gateways] Failed to fetch all joined gateways:', error);
    return [{ url: 'https://turbo-gateway.com', totalStake: 0 }];
  }
}

function getCachedAllGateways(): GatewayWithStake[] | null {
  try {
    const cached = localStorage.getItem(ALL_GATEWAYS_CACHE_KEY);
    if (!cached) return null;

    const parsed: TrustedGatewayCache = JSON.parse(cached);
    const age = Date.now() - parsed.fetchedAt;

    if (age > CACHE_TTL) {
      localStorage.removeItem(ALL_GATEWAYS_CACHE_KEY);
      return null;
    }

    return parsed.gateways;
  } catch {
    return null;
  }
}

function cacheAllGateways(gateways: GatewayWithStake[]): void {
  try {
    const cache: TrustedGatewayCache = {
      gateways,
      fetchedAt: Date.now(),
    };
    localStorage.setItem(ALL_GATEWAYS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Silent fail - caching is optional
  }
}

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getCachedGateways(): GatewayWithStake[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed: TrustedGatewayCache = JSON.parse(cached);
    const age = Date.now() - parsed.fetchedAt;

    if (age > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed.gateways;
  } catch {
    return null;
  }
}

function cacheGateways(gateways: GatewayWithStake[]): void {
  try {
    const cache: TrustedGatewayCache = {
      gateways,
      fetchedAt: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Silent fail - caching is optional
  }
}

export function clearTrustedGatewayCache(): void {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(ALL_GATEWAYS_CACHE_KEY);
}

/**
 * Get a broader pool of gateways for content routing/fetching.
 * This fetches from turbo-gateway.com/ar-io/peers which returns active gateways.
 */
export async function getRoutingGateways(): Promise<URL[]> {
  try {
    const response = await fetch('https://turbo-gateway.com/ar-io/peers');
    if (!response.ok) {
      throw new Error(`Failed to fetch peers: ${response.status}`);
    }

    const data = await response.json();

    // Extract gateway URLs from response
    // Format: { gateways: { "domain:port": { url: "https://...", dataWeight: 50 }, ... } }
    const gateways: URL[] = [];

    if (data.gateways && typeof data.gateways === 'object') {
      // Extract URLs from gateway objects
      for (const gatewayInfo of Object.values(data.gateways)) {
        const info = gatewayInfo as { url?: string };
        if (info.url && typeof info.url === 'string') {
          try {
            gateways.push(new URL(info.url));
          } catch {
            // Skip invalid URLs
          }
        }
      }
    } else if (Array.isArray(data)) {
      // Fallback: handle array format if endpoint changes
      for (const peer of data) {
        if (!peer || typeof peer !== 'string') continue;
        try {
          if (peer.startsWith('http://') || peer.startsWith('https://')) {
            gateways.push(new URL(peer));
          } else {
            gateways.push(new URL(`https://${peer}`));
          }
        } catch {
          // Skip invalid URLs
        }
      }
    } else {
      throw new Error('Unexpected response format from peers endpoint');
    }

    if (gateways.length === 0) {
      throw new Error('No valid gateways found in peers response');
    }

    // Shuffle for load distribution
    for (let i = gateways.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [gateways[i], gateways[j]] = [gateways[j], gateways[i]];
    }

    // Return a reasonable subset (e.g., 20 gateways)
    return gateways.slice(0, Math.min(20, gateways.length));
  } catch (error) {
    console.error('[Gateways] Failed to fetch routing gateways:', error);
    // Return empty array - service worker will fall back to verification gateways
    return [];
  }
}
