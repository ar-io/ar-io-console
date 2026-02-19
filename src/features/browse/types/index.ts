export type RoutingStrategy = 'random' | 'fastest' | 'roundRobin' | 'preferred';

export type VerificationMethod = 'hash' | 'signature';

export type InputType = 'txId' | 'arnsName';

/** Gateway info with stake for display purposes */
export interface GatewayWithStake {
  url: string;
  totalStake: number;
}

// Re-export verification types from service worker
export type { VerificationEvent, SwWayfinderConfig } from '../service-worker/types';
