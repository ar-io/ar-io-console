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
import { useArNSCostDetails, type ArNSFundFrom } from '../hooks/useArNSCostDetails';
import { useArNSPaymentBalances } from '../hooks/useArNSPaymentBalances';
import { useArNSTurboSigner } from '../hooks/useArNSTurboSigner';
import { useCreditsForFiat } from '../../../hooks/useCreditsForFiat';
import { ManageIntent, useManageArNSName } from '../hooks/useManageArNSName';
import {
  ArNSFundingSource,
  ArNSPaymentSelector,
} from './ArNSPaymentSelector';
import { isTokenSelectable, tokenLabels, type SupportedTokenType } from '../../../constants';
import { buildPaymentOptions, defaultPaymentOption } from '../purchase/paymentOptions';
import { resolveSettlementRoute } from '../purchase/settlementRoute';
import { settlementMechanismFor } from '../purchase/settlementMechanism';
import { ArNSCostBreakdown } from './ArNSCostBreakdown';
import { getExplorerTxUrl } from '@/utils/getExplorerTxUrl';
import ArNSPaymentModal from './ArNSPaymentModal';
import ArNSCardPaymentModal from './ArNSCardPaymentModal';
import ModalHeader from '../../../components/modals/ModalHeader';

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
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [fundingSource, setFundingSource] =
    useState<ArNSFundingSource>('balance');
  const [showPayment, setShowPayment] = useState(false);
  /** Fiat can be switched off service-side (503); stop offering it if so. */
  const [cardEnabled, setCardEnabled] = useState(true);
  const [creditsForOneUSD] = useCreditsForFiat(1, () => {});

  // Same flat picker as registration — see ArNSPurchaseCard for why routing and
  // affordability are built from separate lists.
  const routingOptions = useMemo(
    () =>
      buildPaymentOptions({
        walletType: 'solana',
        credits: balances.credits,
        extraTokens: ['ario'],
        isTokenSelectable,
        cardEnabled,
      }),
    [balances.credits, cardEnabled],
  );
  const selectedOption =
    routingOptions.find((o) => o.id === selectedId) ??
    defaultPaymentOption(routingOptions);
  const route = selectedOption
    ? resolveSettlementRoute(selectedOption, fundingSource)
    : ({ kind: 'credits' } as const);
  const priceUnit = route.kind === 'ario' ? 'ario' : 'credits';
  /** ARIO-only: what the cost estimate prices against. */
  const fundFrom: ArNSFundFrom =
    route.kind === 'ario' ? route.fundFrom : 'balance';
  /*
    Which SDK settles this. `fundFrom: 'turbo'` was accepted by @ar.io/sdk and
    ignored — it debited the wallet's ARIO — so renewing or upgrading with
    credits charged the wrong asset. Credits go through turbo-sdk.

    No custody argument: these intents act on a name that already exists, so
    nothing is provisioned, and the card route settles through the fiat quote
    before this hook is ever called.
  */
  const mechanism = settlementMechanismFor(route);

  const { manage, phase, statusMessage, result, error, insufficientCredits, isBusy } =
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
    enabled: active && priceUnit === 'credits',
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
    // Credits pay the name, so the wallet's ARIO shortfall is not a blocker.
    payWithCredits: mechanism.kind !== 'ario-direct',
    fromAddress: address,
    enabled: active,
  });

  /*
    Renewing, upgrading and adding undername slots are registry payments Turbo
    settles from credits — it pays the Solana fee, so the user's SOL balance is
    irrelevant to them.

    Only the ARIO route spends the user's own SOL, because that one is not a
    Turbo action at all. Gating every route on SOL meant a wallet holding
    plenty of credits and no SOL could not renew a name it owned — and a lease
    that cannot be renewed is a name eventually lost, which is the worst
    outcome this modal has.
  */
  const sponsored = priceUnit === 'credits';
  const insufficientSol =
    !sponsored &&
    // Only a KNOWN balance can block the action. `undefined` means the lookup
    // failed or never ran — blocking on that told funded users to go buy SOL.
    !!cost &&
    !balances.loading &&
    balances.sol !== undefined &&
    balances.sol < cost.gasTotalSol;
  // Only the CHOSEN method can be short; a card is sized to the price.
  const insufficientFunds = useMemo(() => {
    if (route.kind === 'credits') {
      return creditsPrice ? balances.credits < creditsPrice.sponsoredCredits : false;
    }
    if (route.kind !== 'ario') return false;
    return (cost?.shortfallMARIO ?? 0) > 0;
  }, [route.kind, creditsPrice, balances.credits, cost?.shortfallMARIO]);

  const paymentOptions = useMemo(
    () =>
      buildPaymentOptions({
        walletType: 'solana',
        credits: balances.credits,
        priceInCredits: creditsPrice?.sponsoredCredits,
        // Signed out, holdings are UNKNOWN, not zero — "0 available" on ARIO
        // next to a silent SOL row states a fact we don't have and reads as
        // "you're broke" to someone who simply hasn't connected yet.
        tokenBalances: address
          ? { solana: balances.sol, ario: balances.totalArio }
          : {},
        extraTokens: ['ario'],
        isTokenSelectable,
        cardEnabled,
      }),
    [cardEnabled, address, balances.credits, balances.sol, balances.totalArio, creditsPrice?.sponsoredCredits],
  );

  const priceReady =
    priceUnit === 'credits' ? !!creditsPrice : cost?.arioCost != null;
  // The SOL gas estimate comes from the cost-details query regardless of the
  // payment method. If that query errored (or resolved with no data), we have
  // no estimate — don't render a misleading "~0 SOL" and don't let the user
  // confirm against an absent estimate.
  // A missing SOL estimate cannot block a sponsored action either — there is
  // no Solana cost for the user to be short of.
  const gasUnavailable =
    !sponsored && (!!costError || (!cost && !costLoading));
  const canConfirm =
    !isBusy &&
    priceReady &&
    !gasUnavailable &&
    !insufficientSol &&
    !insufficientFunds;

  // Credit shortfall → on-demand top-up (credits method only).
  const creditShortfall =
    creditsPrice
      ? Math.max(0, creditsPrice.sponsoredCredits - balances.credits)
      : 0;
  const topUpUsd =
    creditShortfall > 0 && creditsForOneUSD
      ? Math.ceil(creditShortfall / creditsForOneUSD)
      : undefined;
  // Turbo pays the Solana cost on every credits-settled route, so topping up
  // credits is always enough to make the change succeed.
  const needsPaymentStep =
    !!address &&
    (route.kind === 'card' || route.kind === 'topup') &&
    !isBusy;

  const expiryLabel =
    isLease && typeof domain.endTimestamp === 'number'
      ? `Expires in ${daysUntil(domain.endTimestamp, Date.now())} days`
      : 'Permanent';

  /*
    The resulting state, phrased as the answer to why they opened this modal.

    Derived rather than read back: the write has landed, but the indexer that
    serves `domain` has not necessarily caught up, so re-reading it would show
    the OLD value and read as a failure. The inputs are exact and the arithmetic
    is trivial, so computing is both accurate and immediate.
  */
  const outcomeLine = (() => {
    if (action === 'Upgrade-Name') {
      return 'This name is now permanent — it will never expire.';
    }
    if (action === 'Increase-Undername-Limit') {
      return `${qty} more undername ${qty === 1 ? 'slot' : 'slots'} added.`;
    }
    if (action === 'Extend-Lease') {
      const from =
        typeof domain.endTimestamp === 'number'
          ? domain.endTimestamp
          : undefined;
      if (from === undefined) return `Extended by ${years} year${years === 1 ? '' : 's'}.`;
      const extended = new Date(from);
      extended.setFullYear(extended.getFullYear() + years);
      return `Now expires ${extended.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}.`;
    }
    return undefined;
  })();

  // ArNS writes settle on Solana, whatever the buyer paid with.
  const successTxUrl = result?.messageId
    ? getExplorerTxUrl(result.messageId, 'solana')
    : null;

  const handleConfirm = async () => {
    try {
      const res = await manage({
        name: domain.name,
        intent: action,
        years: action === 'Extend-Lease' ? years : undefined,
        increaseQty: action === 'Increase-Undername-Limit' ? qty : undefined,
        mechanism,
      });
      if (res) onSuccess?.();
    } catch {
      // Error surfaced via hook state (`error`); nothing else to do here.
    }
  };

  return (
    <BaseModal onClose={onClose} showCloseButton>
      {/*
        Wider than the default modal: this one carries the full payment row
        (Balance, Card, ARIO, SOL) and at max-w-lg the options were clipped, so
        a buyer could not see — let alone choose — the method they wanted.
        Matches ArNSPaymentModal, which shows the same row.
      */}
      <div className="w-[92vw] max-w-xl p-4 sm:p-5">
        {/* Header */}
        <ModalHeader
          icon={Layers}
          title={
            <>
              Manage{' '}
              <span className="break-all font-mono text-primary">
                {domain.displayName}.ar.io
              </span>
            </>
          }
          description={expiryLabel}
        />

        {phase === 'success' ? (
          <div className="rounded-2xl border border-primary/30 bg-card p-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-primary" />
            <p className="font-semibold text-foreground">
              {statusMessage || 'Done!'}
            </p>

            {/*
              What the name IS now, not just that something happened.

              "Done — 'ipfs' updated!" confirms the click landed and answers
              nothing a user actually wondered: how long have I got, is it
              permanent, how many undernames do I have. The outcome is the
              reason they came.
            */}
            {outcomeLine && (
              <p className="mt-1 text-sm text-foreground/70">{outcomeLine}</p>
            )}

            {/*
              The receipt. An on-chain write with no way to see it asks the user
              to take our word for it; linked, it is verifiable by anyone.
            */}
            {successTxUrl && (
              <a
                href={successTxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
              >
                View transaction
              </a>
            )}

            <button
              onClick={onClose}
              className="mt-4 block w-full rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
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
                options={paymentOptions}
                selectedId={selectedOption?.id ?? ''}
                fundingSource={fundingSource}
                balances={balances}
                onSelect={setSelectedId}
                onSourceChange={setFundingSource}
                disabled={isBusy}
              />
            </div>

            {/* Cost breakdown */}
            <div className="mb-4">
              {/* Registry payments settle from credits with no wallet prompt
                  at all — worth saying, because the hesitation before clicking
                  is usually "what is this going to ask me for". */}
              {priceUnit === 'credits' && (
                <p className="mb-2 text-xs text-foreground/60">
                  Paid from your credits. No wallet approval, and no SOL.
                </p>
              )}
              <ArNSCostBreakdown
                priceUnit={priceUnit}
                creditsPrice={creditsPrice?.sponsoredCredits}
                /* Renew, upgrade and undername slots are registry payments
                   Turbo settles from credits — no Solana cost to the user, and
                   nothing minted, so no setup charge either. */
                sponsored={sponsored}
                cardUsdPrice={
                  route.kind === 'card' ? creditsPrice?.usd : undefined
                }
                arioPrice={cost?.arioCost}
                priceLoading={priceUnit === 'credits' ? creditsLoading : costLoading}
                priceError={!!(priceUnit === 'credits' ? creditsError : costError)}
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
                  Not enough {priceUnit === 'credits' ? 'credits' : 'ARIO'} for
                  this.
                </p>
                <button
                  onClick={() => {
                    setSelectedId('card');
                    setShowPayment(true);
                  }}
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                >
                  Pay with card
                </button>
              </div>
            )}
            {phase === 'error' && !insufficientCredits && error && (
              <div className="mb-4 flex items-start gap-2 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error.message}</span>
              </div>
            )}

            {/* Confirm */}
            {needsPaymentStep ? (
              <button
                onClick={() => setShowPayment(true)}
                disabled={route.kind !== 'card' && !priceReady}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {route.kind === 'card' ? (
                  <CreditCard className="h-4 w-4" />
                ) : (
                  <Wallet className="h-4 w-4" />
                )}{' '}
                Continue
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
                <Wallet className="h-4 w-4" /> {ACTION_META[action].verb}
              </SolanaGateButton>
            )}

            {/* Renew/upgrade by card settles in one step too — `intent` is just
                a path segment on the quote route, so all four are card-payable. */}
            {showPayment && route.kind === 'card' && (
              <ArNSCardPaymentModal
                displayName={domain.name}
                quoteInput={{
                  name: domain.name,
                  address: address ?? '',
                  intent: action,
                  years: action === 'Extend-Lease' ? years : undefined,
                  increaseQty:
                    action === 'Increase-Undername-Limit' ? qty : undefined,
                }}
                onClose={() => setShowPayment(false)}
                onSuccess={() => {
                  setShowPayment(false);
                  onSuccess?.();
                  onClose();
                }}
                onFiatDisabled={() => {
                  setCardEnabled(false);
                  setShowPayment(false);
                  setSelectedId(undefined);
                }}
              />
            )}

            {showPayment && route.kind === 'topup' && (
              <ArNSPaymentModal
                initialUsdAmount={topUpUsd}
                shortfallCredits={creditShortfall}
                paymentMethod="crypto"
                token={route.token as SupportedTokenType}
                tokenLabel={tokenLabels[route.token as SupportedTokenType]}
                onClose={() => setShowPayment(false)}
                onComplete={() => setShowPayment(false)}
              />
            )}
          </>
        )}
      </div>
    </BaseModal>
  );
}
