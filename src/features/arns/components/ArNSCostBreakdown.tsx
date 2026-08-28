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

/**
 * How much more SOL is needed, formatted — or undefined when it rounds to
 * nothing. A real shortfall under 0.00005 SOL renders as "0" at 4dp, and
 * "need 0 more" reads as a bug rather than a rounding artefact.
 */
function solShortfall(
  required: number,
  balance: number | undefined,
): string | undefined {
  if (balance === undefined) return undefined;
  const need = Math.max(0, required - balance);
  const text = need.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return need > 0 && Number(text) > 0 ? text : undefined;
}

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
  /**
   * This is a card route, whether or not the dollar figure has arrived.
   *
   * `cardUsdPrice` alone cannot say so: while the fiat estimate loads it is
   * undefined, and the price fell through to the credits view — quoting
   * "0.62 credits" to someone paying by card, the exact unit leak this panel
   * exists to avoid.
   */
  isCardRoute?: boolean;
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
  /**
   * Token spent on the NAME itself, when paying with a token that must become
   * credits first.
   *
   * Without it "SOL needed" showed only the rent and fee — so a user paying
   * ~0.02 SOL for the name on top of ~0.015 SOL of gas saw 0.015 and was asked
   * to sign 0.02. The figure was never wrong, it was simply never shown.
   */
  tokenForName?: { amount: number; label: string };
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
  isCardRoute = false,
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
  tokenForName,
}: Props) {
  // Credits per $1, inverted. Shown with "~" because this is an indicative
  // rate, not the amount that will be charged — minimums and rounding apply.
  const [creditsForOneUSD] = useCreditsForFiat(1, () => {});
  const usdPerCredit =
    creditsForOneUSD && creditsForOneUSD > 0 ? 1 / creditsForOneUSD : undefined;

  /**
   * The name's cost repeated in the total, when it is a DIFFERENT asset from
   * the network fees.
   *
   * Undefined when there is nothing to add: a SOL purchase is already counted
   * in the SOL figure, and a custodial card has its network costs included, so
   * repeating either would double-count in the reader's head.
   */
  const nameCostSummary: string | undefined = (() => {
    if (networkCostCovered || tokenForName) return undefined;
    // A card pays dollars — quoting the credits it buys would name our unit
    // rather than the one being charged.
    if (isCardRoute) {
      return cardUsdPrice == null
        ? undefined
        : `$${cardUsdPrice.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;
    }
    if (priceUnit === 'ario' && arioPrice != null) {
      return `${fmtNum(arioPrice)} ARIO`;
    }
    if (priceUnit === 'credits' && creditsPrice != null) {
      return `${fmtNum(creditsPrice)} credits`;
    }
    return undefined;
  })();

  // Same total the panel renders below: the name's SOL leg plus network costs.
  const solShortfallText = solShortfall(
    gasTotalSol + (tokenForName?.amount ?? 0),
    solBalance,
  );

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
  isCardRoute && cardUsdPrice == null ? (
    // Card price not resolved yet — wait rather than quoting another unit.
    <span className="text-sm text-foreground/50">…</span>
  ) : tokenForName ? (
    /*
      Dollars lead, the token amount beneath — the two answer different
      questions ("what does this cost" vs "what leaves my wallet") and both are
      wanted, which is why the toggle that hid one behind the other went.
    */
    <span className="flex flex-col items-end">
      {usdPerCredit != null && creditsPrice != null && (
        <span className="text-sm font-medium text-foreground">
          {`~$${(creditsPrice * usdPerCredit).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
        </span>
      )}
      <span
        className={
          usdPerCredit != null && creditsPrice != null
            ? 'text-xs text-foreground/50'
            : 'text-sm font-medium text-foreground'
        }
      >
        {`${fmtSol(tokenForName.amount)} ${tokenForName.label}`}
      </span>
    </span>
  ) : cardUsdPrice != null ? (
    <span className="text-sm font-medium text-foreground">
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
      <span className="flex flex-col items-end">
        {usdPerCredit != null && (
          <span className="text-sm font-medium text-foreground">
            {`~$${(creditsPrice * usdPerCredit).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
          </span>
        )}
        <span
          className={
            usdPerCredit != null
              ? 'text-xs text-foreground/50'
              : 'text-sm font-medium text-foreground'
          }
        >
          {`${fmtNum(creditsPrice)} credits`}
        </span>
      </span>
    ) : (
      <span className="text-sm text-foreground/50">—</span>
    )
  ) : arioPrice != null ? (
    <PriceAmount
      ario={arioPrice}
      // Matches the other line items. Its default is the headline style this
      // panel now reserves for the total.
      primaryClassName="text-sm font-medium text-foreground"
    />
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
              {/*
                A card charge is dollars and has no second unit, so the switch
                has nothing to switch to. Otherwise name the unit being SPENT:
                offering "Credits" to someone paying SOL surfaces our billing
                plumbing at the one moment they are thinking in SOL.
              */}
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
            {/*
              This branch skips the SOL rows, so it would otherwise have no
              prominent figure at all once the name price was demoted. Here the
              name price IS the total — network costs are covered — so it gets
              the same weight every other route's total gets.
            */}
            {cardUsdPrice != null && (
              <>
                <div className="my-2 border-t border-border/10" />
                <Row label="Total" strong>
                  <span className="text-lg font-bold text-foreground">
                    {`$${cardUsdPrice.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`}
                  </span>
                </Row>
              </>
            )}
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
                  <InfoTip text="Solana account rent, held on-chain while the name is registered. The figure is an upper bound — the network usually charges less, so your wallet may quote a smaller amount." />
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
            {/*
              The total carries the weight the name price used to.

              It was the SMALLEST figure in the panel while a single line item
              was the largest, so the eye landed on a component cost and had to
              infer the sum — the opposite of what a checkout should do.

              Two assets stay two figures rather than being blended: paying in
              ARIO or credits still costs SOL in network fees, and a single
              combined number would be fiction.
            */}
            <Row label="Total" strong>
              <span className="flex flex-col items-end">
                {nameCostSummary && (
                  <span className="text-lg font-bold text-foreground">
                    {nameCostSummary}
                  </span>
                )}
                <span
                  className={`text-lg font-bold ${insufficientSol ? 'text-error' : 'text-foreground'}`}
                >
                  up to ~{fmtSol(gasTotalSol + (tokenForName?.amount ?? 0))} SOL
                </span>
                {nameCostSummary && (
                  <span className="text-[11px] font-normal text-foreground/60">
                    name + network costs
                  </span>
                )}
              </span>
            </Row>
            {/*
              Why a card purchase still asks for SOL.

              This is the one genuinely surprising thing in the flow: "pay by
              card" implies no crypto, and then a Solana wallet prompt appears.
              The custodial branch above explains its side ("Turbo holds the
              ANT so you don't need SOL"); without the matching sentence here,
              the self-custody side just looks broken.

              Framed as the trade it is, rather than as an apology — the fee
              buys self-ownership, and that is the reason the ladder works this
              hard to reach this branch at all. Card-only: a SOL or ARIO payer
              is not surprised to need SOL.
            */}
            {isCardRoute && (
              <p className="pb-1 text-[11px] leading-snug text-foreground/60">
                Your card pays for the name. Creating it is a Solana
                transaction, so your wallet covers the network cost — that
                is what puts the name in your wallet rather than ours.
              </p>
            )}
            <p
              className={`flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-xs ${insufficientSol ? 'text-error' : 'text-foreground/50'}`}
            >
              {insufficientSol ? (
                <>
                  {/*
                    Holdings and shortfall in ONE line. "You have 0.1044 SOL —
                    add more" sat directly above "You need about 0.0218 more
                    SOL", which is the same sentence twice with the useful
                    number split across them. What you hold and what you're
                    short belong together; the button's reason no longer
                    repeats it.
                  */}
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> You have{' '}
                    {solBalance === undefined ? '—' : fmtSol(solBalance)} SOL —
                    {solShortfallText
                      ? ` need ${solShortfallText} more`
                      : ' add more to cover the deposit'}
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
