import { AlertTriangle, Check, ExternalLink, Info, Loader2 } from 'lucide-react';

import type { ArNSPaymentMethod } from './ArNSPaymentSelector';
import PriceAmount from './PriceAmount';
import PriceDisplayToggle from './PriceDisplayToggle';

/** Where to send users who need SOL for the network deposit. Configurable. */
const GET_SOL_URL = 'https://www.coinbase.com/how-to-buy/solana';

const fmtSol = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 4 });
const fmtNum = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 4 });

interface Props {
  method: ArNSPaymentMethod;
  /** Name price in Turbo Credits (credits method). */
  creditsPrice?: number;
  /** Name price in ARIO (ario method). */
  arioPrice?: number;
  priceLoading: boolean;
  priceError?: boolean;
  /** SOL gas breakdown (same regardless of funding source). */
  gasTotalSol: number;
  gasRentSol: number;
  gasFeeSol: number;
  gasLoading: boolean;
  /** The gas estimate couldn't be fetched — show an unavailable state, not ~0 SOL. */
  gasError?: boolean;
  /** Balances for the affordability lines. */
  solBalance: number;
  /** Name price can't be covered by the chosen source (ARIO shortfall or credits < price). */
  insufficientFunds: boolean;
  insufficientSol: boolean;
}

function Row({
  label,
  children,
  strong,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span
        className={`text-sm ${strong ? 'font-medium text-foreground' : 'text-foreground/70'}`}
      >
        {label}
      </span>
      <span className="text-right">{children}</span>
    </div>
  );
}

/**
 * Itemized cost for an ArNS action: the name price (Credits or ARIO) plus the
 * Solana network cost the wallet pays in SOL — the account-rent deposit (which
 * dominates) and the transaction fee. The SOL line is shown for BOTH payment
 * methods because every on-chain purchase creates accounts the wallet must fund
 * rent for, even when the name itself is paid with credits.
 */
export function ArNSCostBreakdown({
  method,
  creditsPrice,
  arioPrice,
  priceLoading,
  priceError,
  gasTotalSol,
  gasRentSol,
  gasFeeSol,
  gasLoading,
  gasError,
  solBalance,
  insufficientFunds,
  insufficientSol,
}: Props) {
  const priceNode = priceLoading ? (
    <span className="flex items-center gap-2 text-sm text-foreground/70">
      <Loader2 className="h-4 w-4 animate-spin" /> Fetching…
    </span>
  ) : priceError ? (
    <span className="text-sm text-error">Unavailable</span>
  ) : method === 'credits' ? (
    creditsPrice != null ? (
      // Casing convention across ArNS priced surfaces: "Turbo Credits" is the
      // product proper noun (payment-selector title, "Buy Turbo Credits" CTAs);
      // lowercase "credits" is the unit that follows an amount. Keep it lowercase
      // here — it's a unit, not the product name.
      <span className="text-lg font-bold text-foreground">
        {fmtNum(creditsPrice)} credits
      </span>
    ) : (
      <span className="text-sm text-foreground/50">—</span>
    )
  ) : arioPrice != null ? (
    <PriceAmount ario={arioPrice} />
  ) : (
    <span className="text-sm text-foreground/50">—</span>
  );

  return (
    <div className="rounded-2xl border border-border/20 bg-card p-4">
      {/* Name price */}
      <Row
        label={
          <span className="flex items-center gap-2">
            Name price
            {method === 'ario' && <PriceDisplayToggle />}
          </span>
        }
        strong
      >
        {priceNode}
      </Row>
      {insufficientFunds && !priceLoading && (
        <p className="flex items-center justify-end gap-1 text-xs text-error">
          <AlertTriangle className="h-3 w-3" />
          {method === 'credits'
            ? 'Not enough Turbo Credits'
            : 'Not enough ARIO in this source'}
        </p>
      )}

      <div className="my-2 border-t border-border/10" />

      {/* Solana network cost — always required */}
      {gasLoading ? (
        <div className="flex items-center gap-2 py-1 text-sm text-foreground/70">
          <Loader2 className="h-4 w-4 animate-spin" /> Estimating network cost…
        </div>
      ) : gasError ? (
        <div className="flex items-center gap-2 py-1 text-sm text-error">
          <AlertTriangle className="h-4 w-4" /> Network cost unavailable — try
          again
        </div>
      ) : (
        <>
          <Row label="Network deposit">
            <span className="text-sm text-foreground/80">
              ~{fmtSol(gasRentSol)} SOL
            </span>
          </Row>
          <p className="flex items-center justify-end gap-1 pb-1 text-[11px] text-foreground/50">
            <Info className="h-3 w-3" /> Solana account rent, held on-chain while
            the name is registered
          </p>
          <Row label="Network fee">
            <span className="text-sm text-foreground/80">
              ~{fmtSol(gasFeeSol)} SOL
            </span>
          </Row>
          <div className="my-2 border-t border-border/10" />
          <Row label="SOL needed" strong>
            <span
              className={`text-sm font-semibold ${insufficientSol ? 'text-error' : 'text-foreground'}`}
            >
              ~{fmtSol(gasTotalSol)} SOL
            </span>
          </Row>
          <p
            className={`flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-xs ${insufficientSol ? 'text-error' : 'text-foreground/50'}`}
          >
            {insufficientSol ? (
              <>
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> You have{' '}
                  {fmtSol(solBalance)} SOL — add more to cover the deposit
                </span>
                <a
                  href={GET_SOL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-semibold text-primary hover:underline"
                >
                  Get SOL
                  <ExternalLink className="h-3 w-3" />
                </a>
              </>
            ) : (
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-primary" /> You have{' '}
                {fmtSol(solBalance)} SOL
              </span>
            )}
          </p>
        </>
      )}
      <div className="mt-3 border-t border-border/10 pt-2 text-right">
        <a
          href="https://docs.ar.io/build/upload/turbo-credits#pricing--fees"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
        >
          How pricing works
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
