/**
 * Service Worker Gateway Health Cache
 *
 * Separate instance of gateway health tracking for the service worker context.
 * Service workers have their own memory space and cannot share state with the main thread.
 */

import { nativeFetch } from "./polyfills/fetch-polyfill";

// Default blacklist duration: 5 minutes
const DEFAULT_BLACKLIST_DURATION_MS = 5 * 60 * 1000;

// Extended blacklist for security-blocked gateways: 1 hour
// (Safe Browsing blocks, SSL errors, etc.)
const SECURITY_BLOCK_DURATION_MS = 60 * 60 * 1000;

// Health check timeout: 5 seconds
const HEALTH_CHECK_TIMEOUT_MS = 5000;

// If a request fails this fast, it's likely a security block (not a timeout)
const INSTANT_FAILURE_THRESHOLD_MS = 100;

type FailureReason =
  | "timeout"
  | "server_error"
  | "network_error"
  | "security_block"
  | "ssl_error"
  | "unknown";

interface GatewayHealthEntry {
  failedAt: number;
  expiresAt: number;
  error?: string;
  reason?: FailureReason;
}

/**
 * Analyze an error to determine the failure type.
 *
 * CONSERVATIVE APPROACH: We only extend blacklist duration for CLEAR security
 * indicators (explicit error messages). For ambiguous cases like "instant failures",
 * we log them but use normal blacklist duration to avoid false positives.
 *
 * The gateway rotation already handles blocked gateways - this just helps
 * with logging and prevents repeatedly hitting obviously broken gateways.
 */
function analyzeFailure(
  error: unknown,
  latencyMs: number,
): { reason: FailureReason; duration: number } {
  const errorStr =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();
  const errorName = error instanceof Error ? error.name : "";

  // SSL/Certificate errors - CLEAR indicator, extend blacklist
  // These won't resolve on their own and indicate a fundamental issue
  if (
    errorStr.includes("ssl") ||
    errorStr.includes("certificate") ||
    errorStr.includes("cert_") ||
    errorStr.includes("insecure") ||
    errorStr.includes("err_cert_")
  ) {
    return { reason: "ssl_error", duration: SECURITY_BLOCK_DURATION_MS };
  }

  // Explicit block messages - CLEAR indicator, extend blacklist
  if (
    errorStr.includes("blocked by") ||
    errorStr.includes("access denied") ||
    errorStr.includes("forbidden") ||
    errorStr.includes("not allowed by")
  ) {
    return { reason: "security_block", duration: SECURITY_BLOCK_DURATION_MS };
  }

  // Timeout - normal blacklist (gateway might recover)
  if (
    errorName === "AbortError" ||
    errorName === "TimeoutError" ||
    errorStr.includes("timeout")
  ) {
    return { reason: "timeout", duration: DEFAULT_BLACKLIST_DURATION_MS };
  }

  // Instant failure - LOG as potential security block but use NORMAL blacklist
  // We can't be sure it's a security block vs quick DNS/network failure
  if (
    latencyMs < INSTANT_FAILURE_THRESHOLD_MS &&
    errorStr.includes("failed to fetch")
  ) {
    // Log it as potential security block for visibility, but don't extend blacklist
    // This avoids false positives while still providing useful diagnostics
    return {
      reason: "security_block",
      duration: DEFAULT_BLACKLIST_DURATION_MS,
    };
  }

  // Generic network error - normal blacklist
  if (errorStr.includes("network") || errorStr.includes("failed to fetch")) {
    return { reason: "network_error", duration: DEFAULT_BLACKLIST_DURATION_MS };
  }

  return { reason: "unknown", duration: DEFAULT_BLACKLIST_DURATION_MS };
}

/**
 * Extract hostname from a gateway URL for consistent tracking.
 */
function extractHostname(gateway: string): string {
  try {
    const url = new URL(gateway);
    return url.hostname;
  } catch {
    return gateway;
  }
}

class SwGatewayHealthCache {
  private unhealthyGateways: Map<string, GatewayHealthEntry> = new Map();

  /**
   * Mark a gateway as unhealthy for the specified duration.
   */
  markUnhealthy(
    gateway: string,
    durationMs: number = DEFAULT_BLACKLIST_DURATION_MS,
    error?: string,
    reason?: FailureReason,
  ): void {
    const hostname = extractHostname(gateway);
    const now = Date.now();

    this.unhealthyGateways.set(hostname, {
      failedAt: now,
      expiresAt: now + durationMs,
      error,
      reason,
    });

    const reasonStr = reason ? ` (${reason})` : "";
    console.log(
      `[SW-GatewayHealth] Marked ${hostname} as unhealthy for ${durationMs / 1000}s${reasonStr}${error ? `: ${error}` : ""}`,
    );
  }

  /**
   * Mark a gateway as unhealthy with automatic failure analysis.
   * Determines blacklist duration based on error type and latency.
   */
  markUnhealthyWithAnalysis(
    gateway: string,
    error: unknown,
    latencyMs: number,
  ): void {
    const { reason, duration } = analyzeFailure(error, latencyMs);
    const errorStr = error instanceof Error ? error.message : String(error);
    this.markUnhealthy(gateway, duration, errorStr, reason);
  }

  /**
   * Check if a gateway is currently healthy.
   */
  isHealthy(gateway: string): boolean {
    const hostname = extractHostname(gateway);
    const entry = this.unhealthyGateways.get(hostname);

    if (!entry) {
      return true;
    }

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
    return gateways.filter((gateway) => this.isHealthy(gateway));
  }

  /**
   * Clear all health data.
   */
  clear(): void {
    const count = this.unhealthyGateways.size;
    this.unhealthyGateways.clear();
    if (count > 0) {
      console.log(
        `[SW-GatewayHealth] Cleared ${count} unhealthy gateway entries`,
      );
    }
  }

  /**
   * Get count of unhealthy gateways.
   */
  getUnhealthyCount(): number {
    // Clean up expired entries first
    const now = Date.now();
    for (const [hostname, entry] of this.unhealthyGateways) {
      if (now > entry.expiresAt) {
        this.unhealthyGateways.delete(hostname);
      }
    }
    return this.unhealthyGateways.size;
  }
}

// Export singleton instance for service worker
export const swGatewayHealth = new SwGatewayHealthCache();

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs?: number;
  error?: string;
  isSecurityBlock?: boolean;
}

/**
 * Check if a gateway is responsive by making a HEAD request.
 */
export async function checkSwGatewayHealth(
  url: string,
  timeoutMs: number = HEALTH_CHECK_TIMEOUT_MS,
  markUnhealthyOnFail: boolean = true,
): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await nativeFetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "manual",
    });

    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;

    // 5xx indicates gateway issues
    if (response.status >= 500) {
      const error = `Server error: ${response.status}`;
      if (markUnhealthyOnFail) {
        swGatewayHealth.markUnhealthy(url, undefined, error);
      }
      return { healthy: false, error, latencyMs };
    }

    return { healthy: true, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    let error: string;
    let isSecurityBlock = false;

    if (err instanceof Error) {
      if (err.name === "AbortError") {
        error = `Timeout after ${timeoutMs}ms`;
      } else if (err.message.includes("Failed to fetch")) {
        // Instant failure likely indicates security block
        if (latencyMs < INSTANT_FAILURE_THRESHOLD_MS) {
          error = "Gateway blocked (possible security restriction)";
          isSecurityBlock = true;
        } else {
          error = "Gateway unreachable";
        }
      } else {
        error = err.message;
      }
    } else {
      error = "Unknown error";
    }

    if (markUnhealthyOnFail) {
      // Use analysis-based marking for smart blacklist duration
      swGatewayHealth.markUnhealthyWithAnalysis(url, err, latencyMs);
    }

    return { healthy: false, error, latencyMs, isSecurityBlock };
  }
}

/**
 * Select a healthy gateway from a list, with health check validation.
 * Returns the first gateway that passes the health check.
 */
export async function selectHealthyGateway(
  gateways: string[],
): Promise<string | null> {
  // First filter out known unhealthy gateways
  let candidates = swGatewayHealth.filterHealthy(gateways);

  // If all are marked unhealthy, clear cache and use all
  if (candidates.length === 0) {
    console.log(
      "[SW-GatewayHealth] All gateways marked unhealthy, clearing cache",
    );
    swGatewayHealth.clear();
    candidates = gateways;
  }

  // Try each candidate until one passes health check
  for (const gateway of candidates) {
    const result = await checkSwGatewayHealth(gateway);
    if (result.healthy) {
      console.log(
        `[SW-GatewayHealth] Selected healthy gateway: ${gateway} (${result.latencyMs}ms)`,
      );
      return gateway;
    }
  }

  // All failed - return first gateway as last resort
  console.log(
    "[SW-GatewayHealth] All health checks failed, using first gateway as fallback",
  );
  return gateways[0] || null;
}
