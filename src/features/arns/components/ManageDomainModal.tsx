import { useMemo, useState } from 'react';
import {
  CalendarPlus,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Infinity as InfinityIcon,
  Layers,
  Loader2,
  Wallet,
  XCircle,
} from 'lucide-react';

import { ArNSName } from '@/types';
import BaseModal from '../../../components/modals/BaseModal';
import SolanaGateButton from '../../../components/SolanaGateButton';
import { daysUntil } from '../../../utils/domainExpiry';
import { useArNSPrice } from '../hooks/useArNSPrice';
import { useArNSCostDetails } from '../hooks/useArNSCostDetails';
import { useArNSPaymentBalances } from '../hooks/useArNSPaymentBalances';
import { useArNSTurboSigner } from '../hooks/useArNSTurboSigner';
import { useCreditsForFiat } from '../../../hooks/useCreditsForFiat';
import { ManageIntent, useManageArNSName } from '../hooks/useManageArNSName';
import {
  ArNSFundingSource,
  ArNSPaymentMethod,
  ArNSPaymentSelector,
} from './ArNSPaymentSelector';
import { ArNSCostBreakdown } from './ArNSCostBreakdown';
import BuyCreditsModal from './BuyCreditsModal';

const LEASE_YEAR_OPTIONS = [1, 2, 3, 4, 5];
const UNDERNAME_QTY_OPTIONS = [1, 5, 10, 25, 50];

interface ManageDomainModalProps {
  domain: ArNSName;
  onClose: () => void;
  /** Called after a settled change so the caller can refresh its data. */
  onSuccess?: () => void;
}

const ACTION_META: Record<
  ManageIntent,
  { label: string; icon: typeof CalendarPlus; verb: string }
> = {
  'Extend-Lease': { label: 'Renew', icon: CalendarPlus, verb: 'Extend lease' },
  'Upgrade-Name': {
    label: 'Make permanent',
    icon: InfinityIcon,
    verb: 'Upgrade to permabuy',
  },
  'Increase-Undername-Limit': {
    label: 'Add undernames',
    icon: Layers,
    verb: 'Increase undername limit',
  },
};

/**
 * In-console lifecycle management for an owned ArNS name: renew (extend lease),
 * upgrade a lease to permanent, or add undername slots — each paid with Turbo
 * Credits or the wallet's ARIO, on the ARIO contract rail. Replaces the old
 * external arns.ar.io deep-links.
 */
export default function ManageDomainModal({
  domain,
  onClose,
  onSuccess,
}: ManageDomainModalProps) {
  const isLease = domain.type !== 'permabuy';
  const signer = useArNSTurboSigner();
  const address = signer.address ?? undefined;
  const balances = useArNSPaymentBalances(address);

  // Lease names can renew / upgrade / add undernames; permabuy can only add.
  const actions: ManageIntent[] = isLease
    ? ['Extend-Lease', 'Upgrade-Name', 'Increase-Undername-Limit']
    : ['Increase-Undername-Limit'];

  const [action, setAction] = useState<ManageIntent>(actions[0]);
  const [years, setYears] = useState(1);
  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState<ArNSPaymentMethod>('credits');
  const [fundingSource, setFundingSource] =
    useState<ArNSFundingSource>('balance');
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [creditsForOneUSD] = useCreditsForFiat(1, () => {});

  const fundFrom = method === 'credits' ? 'turbo' : fundingSource;

  const { manage, phase, statusMessage, error, insufficientCredits, isBusy } =
    useManageArNSName();

  const active = phase !== 'success';

  // Credits price (winc → credits) for the credits method.
  const {
    data: creditsPrice,
    isFetching: creditsLoading,
    error: creditsError,
  } = useArNSPrice({
    name: domain.name,
    intent: action,
    years: action === 'Extend-Lease' ? years : undefined,
    increaseQty: action === 'Increase-Undername-Limit' ? qty : undefined,
    enabled: active && method === 'credits',
  });

  // Cost details (ARIO price + SOL gas + affordability) for the selected source.
  const {
    data: cost,
    isFetching: costLoading,
    error: costError,
  } = useArNSCostDetails({
    intent: action,
    name: domain.name,
    years: action === 'Extend-Lease' ? years : undefined,
    increaseQty: action === 'Increase-Undername-Limit' ? qty : undefined,
    fundFrom,
    fromAddress: address,
    enabled: active,
  });

  const insufficientSol =
    !!cost && !balances.loading && balances.sol < cost.gasTotalSol;
  const insufficientFunds = useMemo(() => {
    if (method === 'credits') {
      return creditsPrice ? balances.credits < creditsPrice.credits : false;
    }
    return (cost?.shortfallMARIO ?? 0) > 0;
  }, [method, creditsPrice, balances.credits, cost?.shortfallMARIO]);

  const priceReady =
    method === 'credits' ? !!creditsPrice : cost?.arioCost != null;
  // The SOL gas estimate comes from the cost-details query regardless of the
  // payment method. If that query errored (or resolved with no data), we have
  // no estimate — don't render a misleading "~0 SOL" and don't let the user
  // confirm against an absent estimate.
  const gasUnavailable = !!costError || (!cost && !costLoading);
  const canConfirm =
    !isBusy &&
    priceReady &&
    !gasUnavailable &&
    !insufficientSol &&
    !insufficientFunds;

  // Credit shortfall → on-demand top-up (credits method only).
  const creditShortfall =
    method === 'credits' && creditsPrice
      ? Math.max(0, creditsPrice.credits - balances.credits)
      : 0;
  const topUpUsd =
    creditShortfall > 0 && creditsForOneUSD
      ? Math.ceil(creditShortfall / creditsForOneUSD)
      : undefined;
  // Only offer a credits top-up when SOL gas is sufficient — otherwise topping
  // up credits still can't make the transaction succeed.
  const offerTopUp =
    method === 'credits' && insufficientFunds && !insufficientSol && !isBusy;

  const expiryLabel =
    isLease && typeof domain.endTimestamp === 'number'
      ? `Expires in ${daysUntil(domain.endTimestamp, Date.now())} days`
      : 'Permanent';

  const handleConfirm = async () => {
    try {
      const res = await manage({
        name: domain.name,
        intent: action,
        years: action === 'Extend-Lease' ? years : undefined,
        increaseQty: action === 'Increase-Undername-Limit' ? qty : undefined,
        fundFrom,
      });
      if (res) onSuccess?.();
    } catch {
      // Error surfaced via hook state (`error`); nothing else to do here.
    }
  };

  return (
    <BaseModal onClose={onClose} showCloseButton>
      <div className="w-[92vw] max-w-lg p-6">
        {/* Header */}
        <div className="mb-5">
          <h3 className="font-heading text-xl font-extrabold text-foreground">
            Manage{' '}
            <span className="break-all font-mono text-primary">
              {domain.displayName}.ar.io
            </span>
          </h3>
          <p className="mt-1 text-sm text-foreground/70">{expiryLabel}</p>
        </div>

        {phase === 'success' ? (
          <div className="rounded-2xl border border-primary/30 bg-card p-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-primary" />
            <p className="font-semibold text-foreground">
              {statusMessage || 'Done!'}
            </p>
            <button
              onClick={onClose}
              className="mt-4 rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Action selector */}
            {actions.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {actions.map((a) => {
                  const Meta = ACTION_META[a];
                  const Icon = Meta.icon;
                  return (
                    <button
                      key={a}
                      onClick={() => setAction(a)}
                      disabled={isBusy}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                        action === a
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border/20 bg-card text-foreground/70 hover:border-primary/40'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {Meta.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Action-specific controls */}
            {action === 'Extend-Lease' && (
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium">
                  Extend by
                </label>
                <div className="flex flex-wrap gap-2">
                  {LEASE_YEAR_OPTIONS.map((y) => (
                    <button
                      key={y}
                      onClick={() => setYears(y)}
                      disabled={isBusy}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                        years === y
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border/20 bg-card text-foreground/70 hover:border-primary/40'
                      }`}
                    >
                      {y} {y === 1 ? 'year' : 'years'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {action === 'Increase-Undername-Limit' && (
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium">
                  Undername slots to add
                </label>
                <div className="flex flex-wrap gap-2">
                  {UNDERNAME_QTY_OPTIONS.map((n) => (
                    <button
                      key={n}
                      onClick={() => setQty(n)}
                      disabled={isBusy}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                        qty === n
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border/20 bg-card text-foreground/70 hover:border-primary/40'
                      }`}
                    >
                      +{n}
                    </button>
                  ))}
                </div>
                <a
                  href="https://docs.ar.io/learn/arns"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Learn about undernames
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {action === 'Upgrade-Name' && (
              <p className="mb-4 rounded-2xl border border-border/20 bg-card p-4 text-sm text-foreground/80">
                Convert this lease to a permanent registration — it will never
                expire and never need renewal.
              </p>
            )}

            {/* Payment method + source */}
            <div className="mb-4">
              <ArNSPaymentSelector
                method={method}
                fundingSource={fundingSource}
                balances={balances}
                onMethodChange={setMethod}
                onSourceChange={setFundingSource}
                disabled={isBusy}
              />
            </div>

            {/* Cost breakdown */}
            <div className="mb-4">
              <ArNSCostBreakdown
                method={method}
                creditsPrice={creditsPrice?.credits}
                arioPrice={cost?.arioCost}
                priceLoading={method === 'credits' ? creditsLoading : costLoading}
                priceError={!!(method === 'credits' ? creditsError : costError)}
                gasTotalSol={cost?.gasTotalSol ?? 0}
                gasRentSol={cost?.gasRentSol ?? 0}
                gasFeeSol={cost?.gasFeeSol ?? 0}
                gasLoading={costLoading}
                gasError={gasUnavailable}
                solBalance={balances.sol}
                insufficientFunds={insufficientFunds}
                insufficientSol={insufficientSol}
              />
            </div>

            {/* Status / error */}
            {isBusy && (
              <div className="mb-4 flex items-center gap-2 text-sm text-foreground/70">
                <Loader2 className="h-4 w-4 animate-spin" />
                {statusMessage || 'Processing…'}
              </div>
            )}
            {phase === 'error' && insufficientCredits && (
              <div className="mb-4 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm">
                <p className="mb-2 font-medium text-foreground">
                  Not enough {method === 'credits' ? 'Turbo Credits' : 'ARIO'} for
                  this.
                </p>
                {method === 'credits' && (
                  <button
                    onClick={() => setShowBuyCredits(true)}
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    Buy Turbo Credits
                  </button>
                )}
              </div>
            )}
            {phase === 'error' && !insufficientCredits && error && (
              <div className="mb-4 flex items-start gap-2 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error.message}</span>
              </div>
            )}

            {/* Confirm */}
            {offerTopUp ? (
              <button
                onClick={() => setShowBuyCredits(true)}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <CreditCard className="h-4 w-4" /> Buy Turbo Credits to continue
              </button>
            ) : (
              <SolanaGateButton
                onAction={handleConfirm}
                disabled={!canConfirm}
                busy={isBusy}
                actionVerb="manage this name"
                busyLabel={
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                  </>
                }
              >
                <Wallet className="h-4 w-4" /> {ACTION_META[action].verb} with{' '}
                {method === 'credits' ? 'Turbo Credits' : 'ARIO'}
              </SolanaGateButton>
            )}

            {showBuyCredits && (
              <BuyCreditsModal
                initialUsdAmount={topUpUsd}
                shortfallCredits={creditShortfall}
                onClose={() => setShowBuyCredits(false)}
                onComplete={() => setShowBuyCredits(false)}
              />
            )}
          </>
        )}
      </div>
    </BaseModal>
  );
}
