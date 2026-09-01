/**
 * Which of an ArNS price response's two totals to show, and why it is still a
 * choice.
 *
 * turbo-sdk now adds `wincTotal` (`wincTotalWithAntSpawn ?? winc`) precisely so
 * a caller cannot under-quote by reading the wrong field, and any code charging
 * a sponsored purchase should use it. This module remains for the two things
 * that convenience does not settle:
 *
 *  1. **The base price is still a real price.** A buyer spawning their own ANT
 *     pays `winc` and their own SOL; a buyer holding no SOL pays `wincTotal`.
 *     Both are correct, for different settlement paths, so console has to pick
 *     rather than always take the larger.
 *  2. **The surcharge needs its own line.** It is operator-configured, differs
 *     by environment (production 900000000000, testnet 2000000000000) and is
 *     currently LARGER than the name itself on testnet. A total that jumps
 *     without explanation reads as a pricing bug. Never hardcode it.
 *
 * ## Fiat is still hand-rolled, and still inverted
 *
 * The SDK's `buildArNSPurchaseQuery` whitelists type/years/increaseQty/
 * processId/paidBy and drops `currency`, so `getArNSPriceForName` cannot return
 * a `fiatEstimate` — `TurboArNSClient.getArNSPrice` fetches that leg by hand.
 * On THAT route `paymentAmount` is the base and `paymentAmountWithAntSpawn` the
 * total. On the card quote route (`/v1/arns/quote/...`) `paymentAmount` ALREADY
 * includes the surcharge. Adding it there charges it twice.
 */

/** The price fields this module reads. Extras pass through untouched. */
export interface ArNSPriceFields {
  /** Price of the NAME ONLY. Excludes the ANT-spawn surcharge. */
  winc: string;
  /** SDK-added: `wincTotalWithAntSpawn ?? winc`. The figure to charge. */
  wincTotal?: string;
  /** Flat rent-recovery surcharge. Present only for Buy-Name. */
  antSpawnSurchargeWinc?: string;
  /** Server-computed `winc + antSpawnSurchargeWinc`. */
  wincTotalWithAntSpawn?: string;
  /**
   * @deprecated Priced the retired custodial spawn-then-transfer model, which
   * no longer exists. Production still returns it; the new bundler code drops
   * it. Typed so a legacy response type-checks, and deliberately never read —
   * adding it to a total charges for a mechanism we removed.
   */
  sponsoredTransferSurchargeWinc?: string;
  /** @deprecated See `sponsoredTransferSurchargeWinc`. */
  wincTotalWithSponsoredSpawn?: string;
  fiatEstimate?: {
    /** Base price in the currency's smallest unit, infra fee included. */
    paymentAmount?: number;
    /** `paymentAmount` + the surcharge. Present only for Buy-Name. */
    paymentAmountWithAntSpawn?: number;
  };
}

export interface ArNSWincTotals {
  /** Price when the buyer spawns their own ANT and pays their own rent. */
  baseWinc: string;
  /** Rent-recovery surcharge alone, `'0'` when the intent mints no ANT. */
  surchargeWinc: string;
  /** Price when Turbo spawns the ANT — what a sponsored action debits. */
  totalWinc: string;
  /** True when there is a surcharge worth disclosing as its own line. */
  hasSurcharge: boolean;
}

/** Parse a winc string to BigInt, or `undefined` if it isn't a whole number. */
function toWinc(value: string | undefined): bigint | undefined {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return undefined;
  try {
    return BigInt(value.trim());
  } catch {
    return undefined;
  }
}

/**
 * Split a price response into the two prices the UI must choose between.
 *
 * Throws on an unusable `winc`. Deliberate: every fallback would be inventing a
 * number someone is then charged, and a thrown error surfaces as "price
 * unavailable" rather than as a wrong quote.
 */
export function readWincTotals(price: ArNSPriceFields): ArNSWincTotals {
  const base = toWinc(price.winc);
  if (base === undefined) {
    throw new Error('ArNS price response did not include a usable winc amount.');
  }

  const surcharge = toWinc(price.antSpawnSurchargeWinc) ?? 0n;

  /*
    Prefer the SDK's `wincTotal`, then the server's own total, then arithmetic.

    The SDK and the server are the parties that actually debit, so where any of
    the three disagree theirs is the number the purchase settles at — showing
    our own sum instead would put the difference in front of the user as a
    failed payment.
  */
  const total =
    toWinc(price.wincTotal) ??
    toWinc(price.wincTotalWithAntSpawn) ??
    base + surcharge;

  return {
    baseWinc: base.toString(),
    surchargeWinc: surcharge.toString(),
    totalWinc: total.toString(),
    hasSurcharge: surcharge > 0n,
  };
}

/**
 * The winc that will be debited, given who spawns the ANT.
 *
 * `turboSpawnsAnt` is the whole question — pass the settlement path's answer,
 * never a guess from the intent. Extend/Upgrade/Increase carry no surcharge and
 * return the same number either way, so callers need no special case for them.
 */
export function wincForPurchase(
  price: ArNSPriceFields,
  turboSpawnsAnt: boolean,
): string {
  const totals = readWincTotals(price);
  return turboSpawnsAnt ? totals.totalWinc : totals.baseWinc;
}

/**
 * The fiat estimate matching `wincForPurchase`, in the currency's smallest unit.
 *
 * Only `/v1/arns/price` splits base from total this way. Do not route a card
 * QUOTE response through here — its `paymentAmount` already includes the
 * surcharge.
 */
export function fiatCentsForPurchase(
  price: ArNSPriceFields,
  turboSpawnsAnt: boolean,
): number | undefined {
  const estimate = price.fiatEstimate;
  if (!estimate) return undefined;

  const base = estimate.paymentAmount;
  if (!turboSpawnsAnt) return positiveOrUndefined(base);

  /*
    Fall back to the base rather than to nothing. A sponsored extend or upgrade
    legitimately has no `paymentAmountWithAntSpawn`, and for those the base IS
    the total; the under-quoting risk is confined to Buy-Name, where the field
    is always present.
  */
  return (
    positiveOrUndefined(estimate.paymentAmountWithAntSpawn) ??
    positiveOrUndefined(base)
  );
}

function positiveOrUndefined(value: number | undefined): number | undefined {
  return typeof value === 'number' && value > 0 ? value : undefined;
}
