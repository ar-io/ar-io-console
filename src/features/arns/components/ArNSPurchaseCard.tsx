import { useMemo, useState } from 'react';
import {
  Calendar,
  CreditCard,
  Infinity as InfinityIcon,
  Loader2,
  Wallet,
} from 'lucide-react';

import type { ArNSRegistrationType } from '../hooks/useArNSPrice';
import { useArNSPrice } from '../hooks/useArNSPrice';
import { useArNSCostDetails, type ArNSFundFrom } from '../hooks/useArNSCostDetails';
import { useArNSPaymentBalances } from '../hooks/useArNSPaymentBalances';
import { useArNSTurboSigner } from '../hooks/useArNSTurboSigner';
import { useCreditsForFiat } from '../../../hooks/useCreditsForFiat';
import { useArNSPricing } from '@/hooks/useArNSPricing';
import type { BuyArNSNameInput } from '../hooks/useBuyArNSName';
import {
  ArNSFundingSource,
  ArNSPaymentMethod,
  ArNSPaymentSelector,
} from './ArNSPaymentSelector';
import { ArNSCostBreakdown } from './ArNSCostBreakdown';
import BuyCreditsModal from './BuyCreditsModal';
import SolanaGateButton from '../../../components/SolanaGateButton';
import { toUnicodeName } from '../../../utils/punycode';

interface ArNSPurchaseCardProps {
  name: string;
  isBusy: boolean;
  onBuy: (input: BuyArNSNameInput) => void;
}

const LEASE_YEAR_OPTIONS = [1, 2, 3, 4, 5];

/**
 * Renders nothing — just mounts the two price queries for one lease term so its
 * cost is already in the react-query cache before the user selects it. Keyed
 * identically to the visible card's queries (same fundFrom/fromAddress), so a
 * term switch reads from cache instead of firing a fresh Solana RPC.
 */
function PrefetchLeaseTerm({
  name,
  years,
  fundFrom,
  fromAddress,
}: {
  name: string;
  years: number;
  fundFrom: ArNSFundFrom;
  fromAddress?: string;
}) {
  useArNSPrice({ name, type: 'lease', years });
  useArNSCostDetails({
    intent: 'Buy-Name',
    name,
    type: 'lease',
    years,
    fundFrom,
    fromAddress,
  });
  return null;
}

/**
 * Prefetch every lease term up front so switching 1↔5 years is instant. Fixed
 * child count keeps hooks stable; the current term dedupes against the card's
 * own query, so this adds the OTHER terms, not duplicate fetches.
 */
function LeaseTermPrefetcher(props: {
  name: string;
  fundFrom: ArNSFundFrom;
  fromAddress?: string;
}) {
  return (
    <>
      {LEASE_YEAR_OPTIONS.map((y) => (
        <PrefetchLeaseTerm key={y} years={y} {...props} />
      ))}
    </>
  );
}

/**
 * Registration configurator: lease vs permabuy + term, payment method (Turbo
 * Credits or the wallet's ARIO — liquid / staked / any), an itemized cost
 * breakdown (name price + the SOL rent/fee every buy pays), affordability
 * gating, and the buy action.
 */
export function ArNSPurchaseCard({
  name,
  isBusy,
  onBuy,
}: ArNSPurchaseCardProps) {
  const [type, setType] = useState<ArNSRegistrationType>('lease');
  const [years, setYears] = useState(1);
  const [method, setMethod] = useState<ArNSPaymentMethod>('credits');
  const [fundingSource, setFundingSource] =
    useState<ArNSFundingSource>('balance');
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [creditsForOneUSD] = useCreditsForFiat(1, () => {});

  const signer = useArNSTurboSigner();
  const address = signer.address ?? undefined;
  const balances = useArNSPaymentBalances(address);

  const fundFrom = method === 'credits' ? 'turbo' : fundingSource;

  // Credits price (winc → credits) for the credits method display.
  const {
    data: creditsPrice,
    isFetching: creditsLoading,
    error: creditsError,
  } = useArNSPrice({ name, type, years, enabled: method === 'credits' });

  // Cost details (ARIO price + SOL gas + affordability) for the selected source.
  const {
    data: cost,
    isFetching: costLoading,
    error: costError,
  } = useArNSCostDetails({
    intent: 'Buy-Name',
    name,
    type,
    years,
    fundFrom,
    fromAddress: address,
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
  // Every buy needs the SOL rent/gas estimate from useArNSCostDetails, even the
  // credits path. If that query errored or resolved empty we have no estimate —
  // don't let the user confirm against a missing (and cosmetically ~0) SOL cost.
  const gasUnavailable = !!costError || (!cost && !costLoading);
  const canPay =
    priceReady &&
    !gasUnavailable &&
    !insufficientSol &&
    !insufficientFunds &&
    !isBusy;

  // Credit shortfall → on-demand top-up (only offered for the credits method).
  const creditShortfall =
    method === 'credits' && creditsPrice
      ? Math.max(0, creditsPrice.credits - balances.credits)
      : 0;
  const topUpUsd =
    creditShortfall > 0 && creditsForOneUSD
      ? Math.ceil(creditShortfall / creditsForOneUSD)
      : undefined;
  // Only offer a credits top-up when SOL gas is sufficient — buying credits
  // can't make the purchase succeed if SOL for rent is also short. Gate on being
  // signed in: a signed-out user has a 0 balance (so credits always read as
  // short), and we want them to hit the connect/sign-in gate first — not a
  // "Buy Turbo Credits" prompt for an account they haven't connected yet.
  const offerTopUp =
    !!address && method === 'credits' && insufficientFunds && !insufficientSol;

  // Lease-vs-permabuy decision aid: how many years of leasing equal a permabuy.
  // years = 1 + (permabuy − year1) / annualRenewal, where annualRenewal is the
  // marginal (year2 − year1). Ratios cancel the length, so it's stable per name.
  const { pricingTiers } = useArNSPricing();
  const permabuyBreakEvenYears = useMemo(() => {
    if (!name || pricingTiers.length === 0) return undefined;
    const bucket = name.length > 12 ? 13 : name.length;
    const tier = pricingTiers.find((t) => t.characterLength === bucket);
    const y1 = tier?.pricesInARIO?.year1;
    const y2 = tier?.pricesInARIO?.year2;
    const perm = tier?.pricesInARIO?.permabuy;
    if (
      typeof y1 !== 'number' ||
      typeof y2 !== 'number' ||
      typeof perm !== 'number' ||
      y1 <= 0 ||
      y2 <= y1 ||
      perm <= 0
    )
      return undefined;
    return Math.round(1 + (perm - y1) / (y2 - y1));
  }, [name, pricingTiers]);

  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-4 sm:p-6">
      {/* Warm every lease term's price so switching the term is instant (no
          per-term RPC). Only while leasing; renders nothing. */}
      {type === 'lease' && name && (
        <LeaseTermPrefetcher name={name} fundFrom={fundFrom} fromAddress={address} />
      )}
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-heading text-lg font-bold text-foreground">
          Register <span className="break-all font-mono text-primary">{toUnicodeName(name)}.ar.io</span>
        </h3>
      </div>

      {/* Lease vs permabuy */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => setType('lease')}
          className={`flex items-center gap-2 rounded-2xl border p-3 transition-colors ${
            type === 'lease'
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border/20 bg-card text-foreground/70 hover:border-primary/40'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span className="font-medium">Lease</span>
        </button>
        <button
          onClick={() => setType('permabuy')}
          className={`flex items-center gap-2 rounded-2xl border p-3 transition-colors ${
            type === 'permabuy'
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border/20 bg-card text-foreground/70 hover:border-primary/40'
          }`}
        >
          <InfinityIcon className="h-4 w-4" />
          <span className="font-medium">Permabuy</span>
        </button>
      </div>

      {/* Lease-vs-permabuy decision aid */}
      {permabuyBreakEvenYears !== undefined && (
        <p className="-mt-2 mb-4 text-xs text-foreground/60">
          {type === 'permabuy'
            ? `Own it forever — no renewals, ever. Roughly the cost of ${permabuyBreakEvenYears} years of leasing.`
            : `Permabuy ≈ ${permabuyBreakEvenYears} years of leasing — own it forever, never renew.`}
        </p>
      )}

      {/* Lease term */}
      {type === 'lease' && (
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium">Lease term</label>
          <div className="flex flex-wrap gap-2">
            {LEASE_YEAR_OPTIONS.map((y) => (
              <button
                key={y}
                onClick={() => setYears(y)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
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

      {offerTopUp ? (
        <button
          onClick={() => setShowBuyCredits(true)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <CreditCard className="h-4 w-4" /> Buy Turbo Credits to continue
        </button>
      ) : (
        <SolanaGateButton
          onAction={() =>
            onBuy({
              name,
              type,
              years: type === 'lease' ? years : undefined,
              fundFrom,
            })
          }
          disabled={!canPay}
          busy={isBusy}
          actionVerb="buy this name"
          busyLabel={
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Processing…
            </>
          }
        >
          <Wallet className="h-4 w-4" />{' '}
          {method === 'credits' ? 'Buy with Turbo Credits' : 'Buy with ARIO'}
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
    </div>
  );
}
