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
import { useArNSCostDetails } from '../hooks/useArNSCostDetails';
import { useArNSPaymentBalances } from '../hooks/useArNSPaymentBalances';
import { useArNSTurboSigner } from '../hooks/useArNSTurboSigner';
import { useCreditsForFiat } from '../../../hooks/useCreditsForFiat';
import type { BuyArNSNameInput } from '../hooks/useBuyArNSName';
import {
  ArNSFundingSource,
  ArNSPaymentMethod,
  ArNSPaymentSelector,
} from './ArNSPaymentSelector';
import { ArNSCostBreakdown } from './ArNSCostBreakdown';
import BuyCreditsModal from './BuyCreditsModal';

interface ArNSPurchaseCardProps {
  name: string;
  canBuy: boolean;
  isBusy: boolean;
  onBuy: (input: BuyArNSNameInput) => void;
}

const LEASE_YEAR_OPTIONS = [1, 2, 3, 4, 5];

/**
 * Registration configurator: lease vs permabuy + term, payment method (Turbo
 * Credits or the wallet's ARIO — liquid / staked / any), an itemized cost
 * breakdown (name price + the SOL rent/fee every buy pays), affordability
 * gating, and the buy action.
 */
export function ArNSPurchaseCard({
  name,
  canBuy,
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
  const canPay =
    canBuy && priceReady && !insufficientSol && !insufficientFunds && !isBusy;

  // Credit shortfall → on-demand top-up (only offered for the credits method).
  const creditShortfall =
    method === 'credits' && creditsPrice
      ? Math.max(0, creditsPrice.credits - balances.credits)
      : 0;
  const topUpUsd =
    creditShortfall > 0 && creditsForOneUSD
      ? Math.ceil(creditShortfall / creditsForOneUSD)
      : undefined;
  const offerTopUp = canBuy && method === 'credits' && insufficientFunds;

  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-4 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-heading text-lg font-bold text-foreground">
          Register <span className="font-mono text-primary">{name}.ar.io</span>
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
          <CreditCard className="h-4 w-4" /> Buy credits to continue
        </button>
      ) : (
        <button
          onClick={() =>
            onBuy({
              name,
              type,
              years: type === 'lease' ? years : undefined,
              fundFrom,
            })
          }
          disabled={!canPay}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBusy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Processing…
            </>
          ) : (
            <>
              <Wallet className="h-4 w-4" />{' '}
              {method === 'credits' ? 'Buy with Turbo Credits' : 'Buy with ARIO'}
            </>
          )}
        </button>
      )}

      {!canBuy && (
        <p className="mt-3 text-center text-xs text-foreground/60">
          Connect a Solana wallet to pay.
        </p>
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
