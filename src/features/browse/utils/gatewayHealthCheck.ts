/**
 * Gateway Health Check
 *
 * Performs a quick HEAD request to verify a gateway is responsive.
 * Used for pre-flight checks before loading content.
 */

import { GATEWAY_HEALTH_CHECK_TIMEOUT_MS } from './constants';
import { gatewayHealth } from './gatewayHealth';

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * Check if a gateway is responsive by making a HEAD request.
 *
 * @param url - The full URL to check (e.g., https://arweave.net/txid)
 * @param timeoutMs - Timeout in milliseconds (default 5s)
 * @param markUnhealthyOnFail - Whether to mark the gateway as unhealthy on failure (default true)
 * @returns Health check result with latency if healthy
 */
export async function checkGatewayHealth(
  url: string,
  timeoutMs: number = GATEWAY_HEALTH_CHECK_TIMEOUT_MS,
  markUnhealthyOnFail: boolean = true
): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      // Don't follow redirects - we just want to check if the gateway responds
      redirect: 'manual',
    });

    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;

    // Consider 2xx and 3xx as healthy (gateway is responding)
    // 4xx could be content not found but gateway is up
    // 5xx indicates gateway issues
    if (response.status >= 500) {
      const error = `Server error: ${response.status}`;
      if (markUnhealthyOnFail) {
        gatewayHealth.markUnhealthy(url, undefined, error);
      }
      return { healthy: false, error, latencyMs };
    }

    return { healthy: true, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    let error: string;

    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        error = `Timeout after ${timeoutMs}ms`;
      } else if (err.message.includes('Failed to fetch')) {
        error = 'Gateway unreachable';
      } else {
        error = err.message;
      }
    } else {
      error = 'Unknown error';
    }

    if (markUnhealthyOnFail) {
      gatewayHealth.markUnhealthy(url, undefined, error);
    }

    return { healthy: false, error, latencyMs };
  }
}

/**
 * Extract the gateway base URL from a full content URL.
 * e.g., "https://arweave.net/abc123/path/to/file" → "https://arweave.net"
 */
export function extractGatewayFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}
