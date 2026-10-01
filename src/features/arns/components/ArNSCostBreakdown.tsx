import { MAINNET_ARIO_MINT } from '@ar.io/sdk/web';
import { AlertTriangle, ExternalLink, Info, Loader2 } from 'lucide-react';

import type { ArNSPriceUnit } from './ArNSPaymentSelector';
import { splitNameAndSetup } from '../purchase/priceTotals';
import { OPERATOR_DISCOUNT_PERCENT } from '../purchase/operatorDiscount';
import { useCreditsForFiat } from '../../../hooks/useCreditsForFiat';
import {
  formatNetworkSol,
  formatSourceAmount,
  type UsdRates,
} from '../../payments/paymentSources';

/** Where to send users who need SOL for account rent and fees. Configurable. */
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

/*
  One precision per unit, matching the payment picker's rows so a figure reads
  the same in both places: a token amount through `formatSourceAmount` (two
  decimals, four significant figures under one), an estimated network cost
  through `formatNetworkSol` (two significant figures), dollars in cents.
*/
const fmtSol = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 4 });
const fmtNum = formatSourceAmount;
const fmtUsd = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Rounded to the cent-equivalent the rows show, so displayed rows add up. */
const round2 = (n: number) => Math.round(n * 100) / 100;

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
   * Turbo pays the Solana fees and rent for this purchase.
   *
   * True for registration, renewal, upgrade and undername actions, where the
   * buyer's wallet needs no SOL at all. False for a returned-name auction,
   * which still runs through the buyer's own wallet — the one purchase in the
   * app that costs real SOL, so it keeps the rent and fee rows below.
   */
  sponsored?: boolean;
  /**
   * The one-time setup charge, in credits, shown as its own line.
   *
   * Worth a line rather than folding into the name price: it is operator-
   * configured, varies by environment, and is currently larger than the name
   * itself on testnet. A total that jumps with no explanation reads as a bug.
   */
  setupCredits?: number;
  /**
   * Token spent on the NAME itself, when paying with a token that must become
   * credits first.
   *
   * Without it "SOL needed" showed only the rent and fee — so a user paying
   * ~0.02 SOL for the name on top of ~0.015 SOL of gas saw 0.015 and was asked
   * to sign 0.02. The figure was never wrong, it was simply never shown.
   */
  tokenForName?: { amount: number; label: string };
  /**
   * ARIO taken off the name by the gateway-operator discount, on the ARIO
   * route. `arioPrice` is already net of it (the SDK quotes the discounted
   * cost), so the name row adds it back: the list price, then the discount
   * under it, then a total that is the difference. Showing the net price above
   * a discount row read as the discount taken twice.
   */
  operatorDiscountArio?: number;
  /**
   * Dollars per whole token, for the ARIO route's dollar total (its ARIO and
   * its SOL, priced separately). Without both rates the total is stated in
   * the two tokens alone.
   */
  usdRates?: UsdRates;
  /**
   * What the paying source holds, already worded ("119.43K ARIO · 0.25 SOL",
   * "3.11 credits"). One row beside the figures it has to cover, rather than
   * on the picker's status line and again under the select.
   */
  heldLabel?: string;
  /**
   * Which wallet holds the name (and pays, on the ARIO route), when that is
   * not the signed-in wallet. One sentence under the summary.
   */
  walletLine?: string;
  /**
   * The signer qualifies for the operator discount, but the chosen route is
   * not ARIO. Credits, card and token routes are Turbo actions that cannot
   * carry it, so one quiet line says where it applies.
   */
  operatorDiscountHint?: boolean;
  /**
   * The operator-discount lookup is still running. On the ARIO route this
   * says so in one muted line; it never holds up Buy, since almost nobody is
   * an operator and nobody else should wait for the answer.
   */
  operatorDiscountChecking?: boolean;
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
    <span className="group/tip relative ml-1 inline-flex align-middle">
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
      {/*
        The label wraps and the figure never does: on a phone a figure split
        across two lines ("-293.51 / ARIO") reads as two numbers, while a
        two-line label still reads as one. The tip icon flows inline after the
        label's last word rather than floating at the edge of its box.
      */}
      <span
        className={`min-w-0 text-sm ${strong ? 'font-medium text-foreground' : 'text-foreground/70'}`}
      >
        {label}
      </span>
      <span className="shrink-0 whitespace-nowrap text-right">{children}</span>
    </div>
  );
}

/**
 * Itemized cost for an ArNS action: the name price (Credits or ARIO) plus the
 * Solana network cost the wallet pays in SOL: rent for the accounts that hold
 * the name (which dominates) and the transaction fee. The rent is not a
 * deposit: when a lease ends it goes to whoever prunes the record, and on
 * release to the releasing owner, who pays rent for the returned-name account
 * in the same transaction (ar-io-solana-contracts, prune.rs / manage.rs). The SOL line is shown for BOTH payment
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
  sponsored = false,
  setupCredits,
  tokenForName,
  operatorDiscountArio,
  operatorDiscountHint = false,
  operatorDiscountChecking = false,
  usdRates,
  heldLabel,
  walletLine,
}: Props) {
  // Credits per $1, inverted. Shown with "≈" because this is an indicative
  // rate, not the amount that will be charged: minimums and rounding apply.
  const [creditsForOneUSD] = useCreditsForFiat(1, () => {});
  const usdPerCredit =
    creditsForOneUSD && creditsForOneUSD > 0 ? 1 / creditsForOneUSD : undefined;

  // Same total the panel renders below: the name's SOL leg plus network costs.
  const solShortfallText = solShortfall(
    gasTotalSol + (tokenForName?.amount ?? 0),
    solBalance,
  );

  /*
    The name on its own, with the one-time setup taken back out, so the three
    displayed lines add up. See `splitNameAndSetup`, which carries the reasoning
    and the tests — the arithmetic lives there rather than inline because
    getting it wrong prints a total nobody can reconcile.
  */
  const hasSetup = sponsored && setupCredits != null && setupCredits > 0;
  const { nameCredits: nameOnlyCredits, ratio } = splitNameAndSetup(
    creditsPrice,
    hasSetup ? setupCredits : undefined,
  );
  const nameOnlyToken =
    hasSetup && tokenForName
      ? { ...tokenForName, amount: tokenForName.amount * ratio }
      : tokenForName;
  // The setup's share of the token amount: whatever the name's is not.
  const setupToken =
    hasSetup && tokenForName
      ? { ...tokenForName, amount: tokenForName.amount * (1 - ratio) }
      : undefined;

  /*
    The ARIO route's three figures. The SDK quotes the price net of any
    operator discount, so the list price is that plus the discount. Each is
    rounded as it is displayed and the discount shown is the difference of the
    two, so the rows always add up on screen; the total is the net price, the
    amount actually charged.
  */
  const discountArio =
    priceUnit === 'ario' &&
    operatorDiscountArio != null &&
    operatorDiscountArio > 0
      ? operatorDiscountArio
      : 0;
  const listArio =
    arioPrice != null ? round2(arioPrice + discountArio) : undefined;
  const shownDiscountArio =
    arioPrice != null && discountArio > 0
      ? round2(listArio! - round2(arioPrice))
      : 0;
  /*
    The ARIO route in dollars: the ARIO at its rate plus the SOL at its own.
    Two separately-priced assets, so the dollar figure is the one place they
    can be added; with either rate unknown there is no dollar total rather
    than a partial one.
  */
  const arioTotalUsd =
    arioPrice != null &&
    usdRates?.ario !== undefined &&
    usdRates?.solana !== undefined
      ? arioPrice * usdRates.ario + gasTotalSol * usdRates.solana
      : undefined;
  const shortOfAnything = insufficientFunds || insufficientSol;

  /*
    A figure in two sizes: a line item, and the total, which carries the
    weight the name price used to (it was the smallest figure in the panel
    while a line item was the largest, so the eye landed on a component and
    had to infer the sum).
  */
  const amountNode = (
    credits: number | undefined,
    token: { amount: number; label: string } | undefined,
    total = false,
  ) => {
    const lead = total
      ? `text-lg font-semibold tabular-nums ${insufficientFunds ? 'text-error' : 'text-foreground'}`
      : 'text-sm font-medium text-foreground tabular-nums';
    const sub = 'text-xs text-foreground/60 tabular-nums';
    return priceLoading ? (
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
    ) : token ? (
      /*
      Dollars lead, the token amount beneath — the two answer different
      questions ("what does this cost" vs "what leaves my wallet") and both are
      wanted, which is why the toggle that hid one behind the other went.
    */
      <span className="flex flex-col items-end">
        {usdPerCredit != null && credits != null && (
          <span className={lead}>{`≈ ${fmtUsd(credits * usdPerCredit)}`}</span>
        )}
        <span className={usdPerCredit != null && credits != null ? sub : lead}>
          {`${fmtSol(token.amount)} ${token.label}`}
        </span>
      </span>
    ) : cardUsdPrice != null ? (
      <span className={lead}>{fmtUsd(cardUsdPrice)}</span>
    ) : priceUnit === 'credits' ? (
      credits != null ? (
        // Casing convention across ArNS priced surfaces: "Turbo Credits" is the
        // product proper noun (payment-selector title, "Buy Turbo Credits" CTAs);
        // lowercase "credits" is the unit that follows an amount. Keep it lowercase
        // here — it's a unit, not the product name.
        <span className="flex flex-col items-end">
          {usdPerCredit != null && (
            <span
              className={lead}
            >{`≈ ${fmtUsd(credits * usdPerCredit)}`}</span>
          )}
          <span className={usdPerCredit != null ? sub : lead}>
            {`${fmtNum(credits)} credits`}
          </span>
        </span>
      ) : (
        <span className="text-sm text-foreground/50">—</span>
      )
    ) : listArio != null ? (
      // The list price: see `listArio`. Dollars are stated once, on the total.
      <span className={lead}>{`${fmtNum(listArio)} ARIO`}</span>
    ) : (
      <span className="text-sm text-foreground/50">—</span>
    );
  };

  const priceNode = amountNode(nameOnlyCredits, nameOnlyToken);
  const totalNode = amountNode(creditsPrice, tokenForName, true);

  return (
    <>
      <div className="rounded-2xl border border-border/20 bg-card p-4">
        {/*
          A card has one figure: the charge. Its name price and total were the
          same dollar amount on two rows, so it states the total alone.
        */}
        {!isCardRoute && (
          <Row label="Name price" strong>
            {priceNode}
          </Row>
        )}
        {shownDiscountArio > 0 && (
          <Row
            label={
              <span>
                Operator discount{' '}
                {/* The tip stays with the label's last word, never alone on a line. */}
                <span className="whitespace-nowrap">
                  {`(${OPERATOR_DISCOUNT_PERCENT}%)`}
                  <InfoTip
                    text={`Your gateway earns ${OPERATOR_DISCOUNT_PERCENT}% off ArNS names paid with ARIO.`}
                  />
                </span>
              </span>
            }
          >
            <span className="text-sm font-medium text-primary tabular-nums">
              {`−${fmtNum(shownDiscountArio)} ARIO`}
            </span>
          </Row>
        )}

        {/*
          Turbo pays the Solana costs, so there is no rent to fund and no
          balance to be short of. What remains is the one-time setup charge —
          the rent Turbo fronts to register the name — and the total.
        */}
        {sponsored ? (
          <>
            {/*
              Not on a card: the charge is one dollar figure that already
              covers the setup (rounded up to whole dollars, with a minimum),
              so a "2 credits" row between two dollar amounts named a unit
              the card never pays in and a share it cannot be split into.
            */}
            {!isCardRoute && setupCredits != null && setupCredits > 0 && (
              <Row
                label={
                  <span>
                    One-time{' '}
                    <span className="whitespace-nowrap">
                      setup
                      <InfoTip text="Registers your name on Solana. This charge covers the Solana account rent, so you don't need SOL of your own for it. Charged once, when you buy." />
                    </span>
                  </span>
                }
              >
                {/*
                  Priced in whatever the other two rows use: a middle row in
                  another unit is a sum a reader cannot reconcile. The token
                  share scales by the same ratio as the name's, both being
                  linear in winc.
                */}
                <span className="flex flex-col items-end">
                  {setupToken ? (
                    <>
                      <span className="text-sm text-foreground/80 tabular-nums">
                        {`${fmtSol(setupToken.amount)} ${setupToken.label}`}
                      </span>
                      <span className="text-xs text-foreground/60 tabular-nums">
                        {`${fmtNum(setupCredits)} credits`}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-foreground/80 tabular-nums">
                      {`${fmtNum(setupCredits)} credits`}
                    </span>
                  )}
                </span>
              </Row>
            )}
            {!isCardRoute && <div className="my-2 border-t border-border/10" />}
            {/*
              `totalNode`, not `priceNode`: the latter is the name WITHOUT the
              one-time setup, so reusing it here would under-state the total
              by exactly the charge itemised above it.
            */}
            <Row label="Total" strong>
              {totalNode}
            </Row>
          </>
        ) : gasLoading ? (
          <div className="flex items-center gap-2 py-1 text-sm text-foreground/70">
            <Loader2 className="h-4 w-4 animate-spin" /> Estimating network
            cost…
          </div>
        ) : gasError ? (
          <div className="flex items-center gap-2 py-1 text-sm text-error">
            <AlertTriangle className="h-4 w-4" /> Network cost unavailable. Try
            again.
          </div>
        ) : (
          <>
            {/*
              One line for the SOL, not rent and fee apiece: the fee is a
              rounding error beside the rent, and both leave the same wallet at
              the same moment. The split is in the tooltip for anyone asking.
            */}
            <Row
              label={
                <span>
                  Solana network{' '}
                  <span className="whitespace-nowrap">
                    costs
                    <InfoTip
                      text={`Rent for the Solana accounts that hold your name (${fmtSol(gasRentSol)} SOL) and the transaction fee (${fmtSol(gasFeeSol)} SOL). The rent isn't refunded to you when a lease ends. It is an upper bound: your wallet may quote less.`}
                    />
                  </span>
                </span>
              }
            >
              <span className="text-sm font-medium text-foreground tabular-nums">
                {`up to ${formatNetworkSol(gasTotalSol)} SOL`}
              </span>
            </Row>
            <div className="my-2 border-t border-border/10" />
            {/*
              One dollar figure, with what actually leaves the wallet beneath
              it. The two tokens stay two figures there (paying in ARIO still
              costs SOL), and the dollars are the one place they can be added.
            */}
            <Row label="Total" strong>
              {priceLoading ? (
                totalNode
              ) : priceError ? (
                totalNode
              ) : arioPrice == null ? (
                <span className="text-sm text-foreground/50">—</span>
              ) : (
                <span className="flex flex-col items-end">
                  {arioTotalUsd !== undefined && (
                    <span
                      className={`text-lg font-semibold tabular-nums ${shortOfAnything ? 'text-error' : 'text-foreground'}`}
                    >
                      {`≈ ${fmtUsd(arioTotalUsd)}`}
                    </span>
                  )}
                  <span
                    className={
                      arioTotalUsd !== undefined
                        ? 'text-xs text-foreground/60 tabular-nums'
                        : `text-base font-semibold tabular-nums ${shortOfAnything ? 'text-error' : 'text-foreground'}`
                    }
                  >
                    {`${fmtNum(arioPrice)} ARIO + ${formatNetworkSol(gasTotalSol)} SOL`}
                  </span>
                </span>
              )}
            </Row>
          </>
        )}

        {/*
          What the paying source holds, beside the figures it has to cover:
          the Crypto Top Up review does the same with its "Current balance"
          row. Red when it falls short; the line below says by how much.
        */}
        {heldLabel && (
          <Row label="Your balance">
            <span
              className={`text-sm tabular-nums ${shortOfAnything && !priceLoading ? 'text-error' : 'text-foreground/80'}`}
            >
              {heldLabel}
            </span>
          </Row>
        )}

        {/*
          After the branch, not inside an arm: it landed in the wrong arm twice
          and stripped one route or the other of its warning. Here it renders
          under whichever total was drawn, which is true for every route.
        */}
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
        {!sponsored && !gasLoading && !gasError && insufficientSol && (
          <p className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-xs text-error">
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {solShortfallText
                ? `Need ${solShortfallText} more SOL`
                : 'Not enough SOL for the network costs'}
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
          </p>
        )}
      </div>
      {/*
        Outside the card: help text about the summary, not one more line of the
        bill, which is where the eye expects a total.
      */}
      {walletLine && (
        <p className="mt-2 text-xs text-foreground/60">{walletLine}</p>
      )}
      {/*
        Only off the ARIO route: Turbo pays the registry on every other route,
        so there is no operator signer for the discount to check.
      */}
      {priceUnit === 'ario' &&
        operatorDiscountChecking &&
        shownDiscountArio === 0 && (
          <p className="mt-2 text-xs text-foreground/60">
            Checking operator discount…
          </p>
        )}
      {operatorDiscountHint && priceUnit !== 'ario' && (
        <p className="mt-2 text-xs text-foreground/60">
          Your gateway&apos;s {OPERATOR_DISCOUNT_PERCENT}% operator discount
          applies when you pay with ARIO.
        </p>
      )}
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
