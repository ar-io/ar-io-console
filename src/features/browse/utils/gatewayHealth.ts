/**
 * Gateway Health Cache
 *
 * Tracks gateway health status to avoid routing users to down gateways.
 * Gateways are blacklisted for a configurable duration after failures.
 */

import { GATEWAY_BLACKLIST_DURATION_MS } from './constants';

interface GatewayHealthEntry {
  failedAt: number;
  expiresAt: number;
  error?: string;
}

/**
 * Extract hostname from a gateway URL for consistent tracking.
 * e.g., "https://arweave.net/abc123" → "arweave.net"
 */
function extractHostname(gateway: string): string {
  try {
    const url = new URL(gateway);
    return url.hostname;
  } catch {
    // If not a valid URL, return as-is (might already be a hostname)
    return gateway;
  }
}

class GatewayHealthCache {
  private unhealthyGateways: Map<string, GatewayHealthEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Run cleanup every minute to remove expired entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Mark a gateway as unhealthy for the specified duration.
   */
  markUnhealthy(gateway: string, durationMs: number = GATEWAY_BLACKLIST_DURATION_MS, error?: string): void {
    const hostname = extractHostname(gateway);
    const now = Date.now();

    this.unhealthyGateways.set(hostname, {
      failedAt: now,
      expiresAt: now + durationMs,
      error,
    });

    console.log(`[GatewayHealth] Marked ${hostname} as unhealthy for ${durationMs / 1000}s${error ? `: ${error}` : ''}`);
  }

  /**
   * Check if a gateway is currently healthy (not in blacklist or expired).
   */
  isHealthy(gateway: string): boolean {
    const hostname = extractHostname(gateway);
    const entry = this.unhealthyGateways.get(hostname);

    if (!entry) {
      return true;
    }

    // Check if blacklist has expired
    if (Date.now() > entry.expiresAt) {
      this.unhealthyGateways.delete(hostname);
      return true;
    }

    return false;
  }

  /**
   * Filter a list of gateways to only include healthy ones.
   */
  filterHealthy(gateways: string[]): string[] {
    return gateways.filter(gateway => this.isHealthy(gateway));
  }

  /**
   * Get the number of currently unhealthy gateways.
   */
  getUnhealthyCount(): number {
    this.cleanup(); // Clean up expired entries first
    return this.unhealthyGateways.size;
  }

  /**
   * Get all unhealthy gateway hostnames (for debugging).
   */
  getUnhealthyGateways(): string[] {
    this.cleanup();
    return Array.from(this.unhealthyGateways.keys());
  }

  /**
   * Clear all health data (useful when all gateways appear unhealthy).
   */
  clear(): void {
    const count = this.unhealthyGateways.size;
    this.unhealthyGateways.clear();
    if (count > 0) {
      console.log(`[GatewayHealth] Cleared ${count} unhealthy gateway entries`);
    }
  }

  /**
   * Remove expired entries from the cache.
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [hostname, entry] of this.unhealthyGateways) {
      if (now > entry.expiresAt) {
        this.unhealthyGateways.delete(hostname);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[GatewayHealth] Cleaned up ${cleaned} expired entries`);
    }
  }

  /**
   * Stop the cleanup interval (for testing or shutdown).
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Export singleton instance for main thread usage
export const gatewayHealth = new GatewayHealthCache();

// Also export the class for service worker to create its own instance
export { GatewayHealthCache };
