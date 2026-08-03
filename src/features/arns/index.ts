// ArNS feature — buy an ArNS name with Turbo Credits (Solana Model B).
// Public surface; internal components/hooks are imported via relative paths.

// Page / panel
export { ArNSBuyPanel, default as ArNSBuyPanelDefault } from './ArNSBuyPanel';
export { default as BrowseDomainsPanel } from './components/BrowseDomainsPanel';
export { default as ManageDomainModal } from './components/ManageDomainModal';
export { default as TransferDomainModal } from './components/TransferDomainModal';
export { default as ReassignDomainModal } from './components/ReassignDomainModal';
export { default as EditDetailsModal } from './components/EditDetailsModal';

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
export type { ArNSAvailability } from './hooks/useArNSAvailability';
export { useManageArNSName } from './hooks/useManageArNSName';
export type { ManageIntent, ManageArNSInput } from './hooks/useManageArNSName';
export { useANTDetails } from './hooks/useANTDetails';
export type { ANTDetails } from './hooks/useANTDetails';
export { useSetArNSMetadata, buildMetadataOps } from './hooks/useSetArNSMetadata';
export type { ArNSMetadataChanges } from './hooks/useSetArNSMetadata';
export { useAllArNSNames, loadArNSRegistry } from './hooks/useAllArNSNames';
export type { AllArNSRecord, AllArNSSortKey } from './hooks/useAllArNSNames';
export { useArNSPrice } from './hooks/useArNSPrice';
export { useBuyArNSName } from './hooks/useBuyArNSName';
export type { ArNSRegistrationType } from './hooks/useArNSPrice';
export type { BuyArNSNameInput, BuyPhase } from './hooks/useBuyArNSName';
