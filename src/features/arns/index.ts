// ArNS feature — buy an ArNS name with Turbo Credits (Solana Model B).
// Public surface; internal components/hooks are imported via relative paths.

// Page / panel
export { ArNSBuyPanel, default as ArNSBuyPanelDefault } from './ArNSBuyPanel';

// Service layer (reusable, framework-agnostic) — the extension point for later
// phases (extend / increase-undername / upgrade / custodial manage + transfer).
export {
  TurboArNSClient,
  InsufficientCreditsError,
  ArNSPurchaseFailedError,
} from './services/TurboArNSClient';
export type {
  TurboArNSIntent,
  TurboArNSClientConfig,
  ArNSSettlementResult,
  ArNSSettlementStatus,
  AuthenticatedArNSPurchaseClient,
} from './services/TurboArNSClient';
export { resolveCustodyStrategy } from './services/custodyStrategy';
export type { CustodyModel, CustodyStrategy } from './services/custodyStrategy';
export { spawnArNSAnt } from './services/antSpawn';

// Hooks
export { useTurboArNSClient } from './hooks/useTurboArNSClient';
export { useArNSTurboSigner } from './hooks/useArNSTurboSigner';
export { useArNSAvailability } from './hooks/useArNSAvailability';
export { useArNSPrice } from './hooks/useArNSPrice';
export { useBuyArNSName } from './hooks/useBuyArNSName';
export type { ArNSRegistrationType } from './hooks/useArNSPrice';
export type { BuyArNSNameInput, BuyPhase } from './hooks/useBuyArNSName';
