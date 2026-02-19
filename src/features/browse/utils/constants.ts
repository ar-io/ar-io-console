import type { BrowseConfig } from '@/store/useStore';

export const STORAGE_KEY = 'ar-io-console-browse-config';

// Gateway health check settings
export const GATEWAY_HEALTH_CHECK_TIMEOUT_MS = 5000; // 5 seconds
export const GATEWAY_BLACKLIST_DURATION_MS = 5 * 60 * 1000; // 5 minutes
export const MAX_GATEWAY_AUTO_RETRIES = 3;

// Loading screen thresholds
export const SLOW_THRESHOLD_MS = 10000; // 10s - show warning
export const TIMEOUT_THRESHOLD_MS = 15000; // 15s - auto-retry/show button

export const DEFAULT_BROWSE_CONFIG: BrowseConfig = {
  routingStrategy: 'random',
  verificationEnabled: false,
  strictVerification: false, // When true, blocks content if verification fails
  verificationConcurrency: 10, // Parallel resource verifications (1-20)
  verificationMethod: 'hash', // 'hash' (fast) or 'signature' (cryptographic)
  trustedGatewayCount: 3, // Number of trusted gateways for verification (1-10)
};

export const ROUTING_STRATEGY_OPTIONS = [
  {
    value: 'random' as const,
    label: 'Random',
    description: 'Randomly select a gateway for load balancing',
  },
  {
    value: 'fastest' as const,
    label: 'Fastest Ping',
    description: 'Test latency and use the fastest gateway (cached 5 min)',
  },
  {
    value: 'roundRobin' as const,
    label: 'Round Robin',
    description: 'Cycle through gateways sequentially',
  },
  {
    value: 'preferred' as const,
    label: 'Preferred Gateway',
    description: 'Always use a specific gateway',
  },
] as const;
