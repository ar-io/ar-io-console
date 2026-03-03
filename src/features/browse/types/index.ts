export type RoutingStrategy = "random" | "fastest" | "roundRobin" | "preferred";

export type VerificationMethod = "hash" | "signature";

export type InputType = "txId" | "arnsName";

/** Gateway info with stake for display purposes */
export interface GatewayWithStake {
  url: string;
  totalStake: number;
}

/**
 * Browse configuration stored in the global store.
 * Defined here to avoid circular imports between useStore.ts and constants.ts.
 */
export interface BrowseConfig {
  routingStrategy: RoutingStrategy;
  preferredGateway?: string;
  verificationEnabled: boolean;
  strictVerification: boolean;
  verificationConcurrency: number;
  verificationMethod: VerificationMethod;
  trustedGatewayCount: number;
}

// Re-export verification types from service worker
export type {
  VerificationEvent,
  SwWayfinderConfig,
} from "../service-worker/types";
