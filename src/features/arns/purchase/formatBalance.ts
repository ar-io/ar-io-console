/**
 * A holding, short enough to sit in a payment card.
 *
 * `toLocaleString` with four decimals renders an ARIO balance as
 * "1,505,829.1436" — twelve digits and a separator in a card roughly a hundred
 * pixels wide. It was then CSS-truncated to "1,505,829.1436 …", which is the
 * worst outcome available: a number cut mid-digits reads as a broken value
 * rather than a shortened one, and the ellipsis hides which end was lost.
 *
 * Precision is not the job here. This line answers "do I have enough of this
 * to be worth choosing?" — the exact figure belongs on the account page, and
 * the amount actually charged is quoted in the cost breakdown below. So large
 * holdings get an abbreviation and small ones keep the detail that makes them
 * meaningful.
 */
export function formatHeldBalance(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return '0';

  // A million-plus token balance is a "plenty" signal, not a figure anyone
  // reads digit by digit.
  if (amount >= 1_000_000) {
    return `${trim(amount / 1_000_000)}M`;
  }
  /*
    Promote after rounding, not before. 999,999.999 is under a million until
    the two-decimal display rounds it, and the naive branch then renders
    "1,000K" — an abbreviation longer than the number it abbreviates, in the
    wrong unit.
  */
  if (amount >= 10_000) {
    const thousands = amount / 1_000;
    return round2(thousands) >= 1_000
      ? `${trim(amount / 1_000_000)}M`
      : `${trim(thousands)}K`;
  }
  /*
    Below ten thousand the whole number fits, and the decimals start to matter:
    "0.3961 SOL" is a different decision from "0.4 SOL" when the price is
    0.39. Four places for small amounts, fewer as the integer part grows.
  */
  if (amount >= 1) {
    // Same boundary one unit down: 9,999.999 displays as 10,000, which is the
    // abbreviation threshold it just failed to meet as a raw value.
    const rounded = round2(amount);
    if (rounded >= 10_000) return `${trim(rounded / 1_000)}K`;
    return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return amount.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/** One or two decimals, without a trailing ".0". */
function trim(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** The value as the display will round it, for choosing the unit. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
