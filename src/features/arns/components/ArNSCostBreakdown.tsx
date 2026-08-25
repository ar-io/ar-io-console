import { MAINNET_ARIO_MINT } from '@ar.io/sdk/web';
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Info,
  Loader2,
} from 'lucide-react';

import type { ArNSPriceUnit } from './ArNSPaymentSelector';
import PriceAmount from './PriceAmount';
import PriceDisplayToggle from './PriceDisplayToggle';
import { useStore } from '../../../store/useStore';
import { useCreditsForFiat } from '../../../hooks/useCreditsForFiat';

/** Where to send users who need SOL for the network deposit. Configurable. */
const GET_SOL_URL = 'https://www.coinbase.com/how-to-buy/solana';

/**
 * Swap SOL for ARIO on Raydium, prefilled — the venue ar.io's own token page
 * points at, and confirmed working on device.
 *
 * The input side MUST be the `sol` shorthand. An earlier attempt passed the
 * wrapped-SOL mint address instead and the page failed to load the pair; this
 * is the form Raydium documents and the one that actually works.
 *
 * The output mint comes from `@ar.io/sdk` rather than being pasted in. A wrong
 * mint would send someone to swap real SOL for the wrong token, and a constant
 * copied by hand cannot follow the SDK if the token ever moves.
 *
 * Deliberately mainnet-only: devnet ARIO has no Raydium market, so deriving
 * this from config would land the user in an empty pool.
 */
const GET_ARIO_URL =
  `https://raydium.io/swap/?inputMint=sol` +
  `&outputMint=${MAINNET_ARIO_MINT.toString()}`;

const fmtSol = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 4 });
const fmtNum = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 4 });

interface Props {
  /** Which unit the name's price is quoted in — not how it's being paid. */
  priceUnit: ArNSPriceUnit;
  /** Name price in Turbo Credits (credits method). */
  creditsPrice?: number;
  /**
   * What a CARD is actually charged, in dollars — the bundler's `fiatEstimate`.
   *
   * Not interchangeable with `creditsPrice`. `/v1/arns/price` computes `winc`
   * with `feeMode: "none"`, so converting credits to USD gives the fee-free
   * price — the same number as paying ARIO directly. The fiat estimate uses
   * `feeMode: "invert"`, which adds the infra fee the card pays. Showing the
   * former on the card route quotes a price we will not charge.
   */
  cardUsdPrice?: number;
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
  /** `undefined` when the balance is unknown — render that, never 0. */
  solBalance: number | undefined;
  /** Name price can't be covered by the chosen source (ARIO shortfall or credits < price). */
  insufficientFunds: boolean;
  insufficientSol: boolean;
  /**
   * The payment service performs the on-chain write itself and covers the
   * Solana rent + fee from its own keypair — true on the card path.
   *
   * Card is the option that works for someone holding no crypto at all, so
   * showing them a SOL requirement (let alone blocking on it) contradicts the
   * only reason to offer it.
   */
  networkCostCovered?: boolean;
  /**
   * Turbo will hold this name's ANT (a custodial card purchase).
   *
   * Stated, never asked. The console picks the best custody the wallet can
   * support, but "who owns this" must not be something the buyer discovers
   * later — so the one case where they don't own it says so, next to the price
   * that includes spawning it.
   */
  custodialAnt?: boolean;
}

/**
 * An explainer that lives on its label rather than under the value.
 *
 * A footnote row costs a full line of vertical space to say something most
 * people already know, and in a short cost summary those lines add up to real
 * scrolling. Attaching it to the term keeps the summary scannable while leaving
 * the detail one hover (or Tab) away.
 *
 * `focus-within` as well as `hover` so it is reachable from the keyboard, and
 * `title` as the touch fallback — there is no hover on a phone.
 */
function InfoTip({ text }: { text: string }) {
  return (
    <span className="group/tip relative inline-flex align-middle">
      <button
        type="button"
        aria-label={text}
        title={text}
        className="inline-flex cursor-help items-center text-foreground/40 transition-colors hover:text-foreground/70"
      >
        <Info className="h-3 w-3" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-56 -translate-x-1/2 rounded-xl bg-foreground px-2.5 py-1.5 text-[11px] leading-snug text-white opacity-0 shadow-sm transition-opacity group-hover/tip:opacity-100 group-focus-within/tip:opacity-100"
      >
        {text}
      </span>
    </span>
  );
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
  priceUnit,
  creditsPrice,
  cardUsdPrice,
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
  networkCostCovered = false,
  custodialAnt = false,
}: Props) {
  const currency = useStore((s) => s.priceDisplayCurrency);
  // Credits per $1, inverted. Shown with "~" because this is an indicative
  // rate, not the amount that will be charged — minimums and rounding apply.
  const [creditsForOneUSD] = useCreditsForFiat(1, () => {});
  const usdPerCredit =
    creditsForOneUSD && creditsForOneUSD > 0 ? 1 / creditsForOneUSD : undefined;

  const priceNode = priceLoading ? (
    <span className="flex items-center gap-2 text-sm text-foreground/70">
      <Loader2 className="h-4 w-4 animate-spin" /> Fetching…
    </span>
  ) : priceError ? (
    <span className="text-sm text-error">Unavailable</span>
  ) : /*
        Paying by card, the price IS a dollar amount — quote the charge, not our
        internal unit. It is also the only figure carrying the infra fee, so the
        credits view would understate what we are about to charge.
     */
  cardUsdPrice != null ? (
    <span className="text-lg font-bold text-foreground">
      {`$${cardUsdPrice.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`}
    </span>
  ) : priceUnit === 'credits' ? (
    creditsPrice != null ? (
      // Casing convention across ArNS priced surfaces: "Turbo Credits" is the
      // product proper noun (payment-selector title, "Buy Turbo Credits" CTAs);
      // lowercase "credits" is the unit that follows an amount. Keep it lowercase
      // here — it's a unit, not the product name.
      <span className="text-lg font-bold text-foreground">
        {currency === 'usd' && usdPerCredit != null
          ? `~$${(creditsPrice * usdPerCredit).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : `${fmtNum(creditsPrice)} credits`}
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
    <>
      <div className="rounded-2xl border border-border/20 bg-card p-4">
        {/* Name price */}
        <Row
          label={
            <span className="flex items-center gap-2">
              Name price
              {/* Both payment methods get the toggle. "0.89 credits" means
                nothing to someone paying by card — arguably the USD view
                matters MORE here than on the token path, where the holder
                already knows what ARIO is worth. */}
              <PriceDisplayToggle
                nativeLabel={priceUnit === 'credits' ? 'Credits' : 'ARIO'}
              />
            </span>
          }
          strong
        >
          {priceNode}
        </Row>
        {insufficientFunds && !priceLoading && (
          <p className="flex items-center justify-end gap-1 text-xs text-error">
            <AlertTriangle className="h-3 w-3" />
            {priceUnit === 'credits'
              ? 'Not enough Turbo Credits'
              : 'Not enough ARIO in this source'}
            {priceUnit !== 'credits' && (
              <a
                href={GET_ARIO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 font-semibold text-primary hover:underline"
              >
                Swap for ARIO
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </p>
        )}

        <div className="my-2 border-t border-border/10" />

        {/* Solana network cost — always required */}
        {gasLoading ? (
          <div className="flex items-center gap-2 py-1 text-sm text-foreground/70">
            <Loader2 className="h-4 w-4 animate-spin" /> Estimating network
            cost…
          </div>
        ) : networkCostCovered ? (
          <>
            {/* Paying by card custodially: the service does the on-chain write
                from its own keypair, so there is no SOL for the buyer to hold
                or be short of. */}
            <Row label="Network costs">
              <span className="text-sm text-foreground/80">Included</span>
            </Row>
            {custodialAnt && (
              <p className="pt-1 text-[11px] leading-snug text-foreground/60">
                Turbo holds this name&apos;s ANT so you don&apos;t need SOL. You
                can transfer it to your own wallet any time.
              </p>
            )}
          </>
        ) : gasError ? (
          <div className="flex items-center gap-2 py-1 text-sm text-error">
            <AlertTriangle className="h-4 w-4" /> Network cost unavailable — try
            again
          </div>
        ) : (
          <>
            <Row
              label={
                <span className="inline-flex items-center gap-1.5">
                  Network deposit
                  <InfoTip text="Solana account rent, held on-chain while the name is registered." />
                </span>
              }
            >
              <span className="text-sm text-foreground/80">
                ~{fmtSol(gasRentSol)} SOL
              </span>
            </Row>
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
                    {solBalance === undefined ? '—' : fmtSol(solBalance)} SOL —
                    add more to cover the deposit
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
              ) : solBalance === undefined ? (
                /*
                Unknown is not "enough". The tick previously rendered against a
                literal "Balance unavailable", so a lookup failure read as
                "You have ✓ Balance unavailable" — a confirmation of nothing.
                Say we can't see it, with no reassuring mark.
              */
                <span className="text-foreground/50">
                  Your SOL balance is unavailable right now.
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Check className="h-3 w-3 text-primary" /> You have{' '}
                  {fmtSol(solBalance)} SOL
                </span>
              )}
            </p>
          </>
        )}
      </div>
      {/*
      Outside the card, not inside it.

      Sitting under a divider at the foot of the list, it read as one more line
      item — the last row of a bill, which is exactly where the eye expects a
      total. It is help text about the card, so it belongs beside it, quiet and
      left-aligned.
    */}
      <a
        href="https://docs.ar.io/build/upload/turbo-credits#pricing--fees"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-0.5 text-xs text-foreground/60 transition-colors hover:text-primary"
      >
        How pricing works
        <ExternalLink className="h-3 w-3" />
      </a>
    </>
  );
}
