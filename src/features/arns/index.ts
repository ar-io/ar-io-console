// ArNS feature — buy an ArNS name with Turbo Credits (Solana Model B).
// Public surface; internal components/hooks are imported via relative paths.

// Page / panel
export { ArNSBuyPanel, default as ArNSBuyPanelDefault } from './ArNSBuyPanel';
export { default as BrowseDomainsPanel } from './components/BrowseDomainsPanel';
export { default as ReturnedNamesPanel } from './components/ReturnedNamesPanel';
export { default as ReturnedNameBuyModal } from './components/ReturnedNameBuyModal';
export { default as ManageDomainModal } from './components/ManageDomainModal';
export { default as TransferDomainModal } from './components/TransferDomainModal';
export { default as ReassignDomainModal } from './components/ReassignDomainModal';
export { default as ReleaseDomainModal } from './components/ReleaseDomainModal';
export { default as EditDetailsModal } from './components/EditDetailsModal';
export { default as ControllersModal } from './components/ControllersModal';
export { default as PrimaryNameModal } from './components/PrimaryNameModal';
export type { PrimaryNameModalMode } from './components/PrimaryNameModal';

// Service layer (framework-agnostic). Scoped to what is actually consumed:
// pricing (`getArNSPrice`) and the purchase status read used by polling. The
// credit-settlement layer that used to live here was removed — it had zero
// callers, because buying goes through `@ar.io/sdk` (see useBuyArNSName) and
// fiat will go through turbo-sdk's quote endpoint. Its one salvageable part,
// the terminal-state poller, now lives in `purchase/pollPurchase.ts`.
export { TurboArNSClient } from './services/TurboArNSClient';
export type {
  TurboArNSIntent,
  TurboArNSClientConfig,
  ArNSSettlementResult,
} from './services/TurboArNSClient';
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
export type {
  ArNSMetadataChanges,
  BaseRecordChange,
} from './hooks/useSetArNSMetadata';
export { useUndernameRecords, useUndernameWrites } from './hooks/useUndernames';
export type {
  UndernameRecord,
  UndernameRecordChange,
} from './hooks/useUndernames';
export { useControllersState, useControllerWrites } from './hooks/useControllers';
export type { ControllersState } from './hooks/useControllers';
export { useAllArNSNames, loadArNSRegistry } from './hooks/useAllArNSNames';
export type { AllArNSRecord, AllArNSSortKey } from './hooks/useAllArNSNames';
export { useArNSPrice } from './hooks/useArNSPrice';
export { useBuyArNSName } from './hooks/useBuyArNSName';
export type { ArNSRegistrationType } from './hooks/useArNSPrice';
export type { BuyArNSNameInput, BuyPhase } from './hooks/useBuyArNSName';
export { usePrimaryName } from './hooks/usePrimaryName';
export type {
  PrimaryName,
  PrimaryNameRequest,
  PrimaryNameState,
} from './hooks/usePrimaryName';
export { usePrimaryNameActions } from './hooks/usePrimaryNameActions';
export type { PrimaryNamePhase } from './hooks/usePrimaryNameActions';
export {
  useReturnedNames,
  useReturnedName,
  useReturnedNamePriceInputs,
} from './hooks/useReturnedNames';
export type {
  ReturnedNameRecord,
  ReturnedNameSortKey,
  ReturnedNameSortOrder,
} from './hooks/useReturnedNames';
export { useBuyReturnedName } from './hooks/useBuyReturnedName';
export type {
  BuyReturnedNameInput,
  BuyReturnedNamePhase,
  BuyReturnedNameResult,
} from './hooks/useBuyReturnedName';
export {
  auctionMultiplier,
  estimateReturnedNameArio,
  auctionTimeRemainingMs,
  formatCountdown,
  isAuctionActive,
  baseAnnualMARIOForName,
  START_RNP_PREMIUM,
} from './returnedNamePricing';
export type { ReturnedNameFees } from './returnedNamePricing';

// Price-display toggle (ARIO ⇄ USD)
export {
  arioToUsd,
  formatArioAmount,
  formatUsdAmount,
  formatPriceDisplay,
} from './priceDisplay';
export { default as PriceAmount } from './components/PriceAmount';

// ArNS fee-schedule table (name price by character length)
export { default as ArNSPriceTable } from './components/ArNSPriceTable';
export {
  MAX_TIER_CHAR_LENGTH,
  bucketCharacterLength,
  findTierIndexForLength,
  formatTierCharacterLabel,
} from './arnsPriceTable';


// Gas-sponsored ArNS actions. turbo-sdk owns the protocol — the two response
// shapes, the nonce discipline and the owner proof — via `buyArNSName`,
// `setArNSRecord` and friends. What lives here is the half the SDK cannot own:
// the browser wallet that signs, and honest copy about what is sponsored.
export {
  assertOwnerSlotOnly,
  browserArNSOwnerSigner,
} from './actions/browserOwnerSigner';
export { antRecordWriter } from './records/antWriter';
export type { ANTRecordWriteable } from './records/antWriter';
export { writerForRole, writerCostNote } from './records/writerChoice';
export { useArNSActionPrice } from './hooks/useArNSActionPrice';
export type { WriterKind } from './records/writerChoice';
export type { BrowserOwnerSignerAdapter } from './actions/browserOwnerSigner';
export {
  SPONSORED_ACTIONS,
  SPONSORED_ACTION_FACTS,
  UNSPONSORED_OPERATIONS,
  actionCostsCredits,
  isSponsoredAction,
} from './actions/sponsorship';
export type {
  SponsoredActionFacts,
  UnsponsoredOperation,
} from './actions/sponsorship';

// Sponsored vs self-spawn pricing. `wincTotal` is the figure to charge; the
// base and the surcharge are still needed separately — see `priceTotals.ts`.
export {
  fiatCentsForPurchase,
  readWincTotals,
  wincForPurchase,
} from './purchase/priceTotals';
export type { ArNSPriceFields, ArNSWincTotals } from './purchase/priceTotals';
