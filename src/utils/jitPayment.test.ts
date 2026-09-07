import { describe, it, expect } from 'vitest';
import { tokenPricePerCredit, WINC_PER_CREDIT } from './jitPayment';

/*
  Regression cover for the base-usdc under-funding bug.

  A crypto upload is a two-step transaction: buy credits, then spend them. If
  step one buys less than step two costs, the payment settles and the upload it
  paid for is rejected — the user is charged and gets nothing. Nothing tested
  this, which is how it shipped.

  Figures are real production values (payment.ardrive.io, /v1/rates and
  /v1/price/...), so the arithmetic is exercised at the ratios that actually
  occur rather than round numbers.
*/
const GiB = 1024 ** 3;
const WINC_PER_GIB_STORAGE = 12_229_892_714_075; // getFiatRates().winc — storage only
const PER_ITEM_FEE_WINC = 9_615_385;             // getFiatRates().perDataItemFeeWinc
const WINC_PER_GIB_BILLED = 12_229_902_329_460;  // /price/bytes/2^30 — storage + one item fee
const TOKENS_PER_GIB = 39.138545;                // getTokenPriceForBytes(2^30), USDC
const WINC_PER_USDC = 312_477_187_499;           // /price/base-usdc/1000000, net of the 65% infra fee
const BUFFER = 1.05;                             // BUFFER_MULTIPLIER

/** What the bundler bills for `bytes` across `files` data items. */
const wincBilled = (bytes: number, files: number) =>
  (bytes / GiB) * WINC_PER_GIB_STORAGE + PER_ITEM_FEE_WINC * files;

/** Winc actually credited by paying `usdc`, at the smallest-unit granularity the transfer uses. */
const wincCredited = (usdc: number) =>
  Math.floor(usdc * 1e6) * (WINC_PER_USDC / 1e6);

/** The amount the app now pays: credits needed -> tokens, with the safety buffer. */
const usdcCharged = (bytes: number, files: number) => {
  const credits = wincBilled(bytes, files) / WINC_PER_CREDIT;
  const rate = tokenPricePerCredit({ wincPerGiB: WINC_PER_GIB_BILLED, tokensPerGiB: TOKENS_PER_GIB });
  return credits * rate * BUFFER;
};

describe('tokenPricePerCredit', () => {
  it('converts a GiB priced in both units into a per-credit token rate', () => {
    const rate = tokenPricePerCredit({ wincPerGiB: WINC_PER_GIB_BILLED, tokensPerGiB: TOKENS_PER_GIB });
    // credits in a GiB = winc/GiB / 1e12, so rate = tokens / that.
    expect(rate).toBeCloseTo(TOKENS_PER_GIB / (WINC_PER_GIB_BILLED / WINC_PER_CREDIT), 10);
  });

  it('scales linearly, so a batch cannot be quoted cheaper per credit', () => {
    const rate = tokenPricePerCredit({ wincPerGiB: WINC_PER_GIB_BILLED, tokensPerGiB: TOKENS_PER_GIB });
    expect(10 * rate).toBeCloseTo(tokenPricePerCredit({
      wincPerGiB: WINC_PER_GIB_BILLED, tokensPerGiB: TOKENS_PER_GIB * 10,
    }), 10);
  });
});

describe('a crypto payment covers the upload it pays for', () => {
  // Small files are where the flat per-item fee dominates; that is where the
  // old raw-byte quote bought as little as 54% of the cost.
  const cases: Array<[string, number, number]> = [
    ['1 KB, one file', 1024, 1],
    ['100 KB, one file', 102_400, 1],
    ['1 MB, one file', 1_048_576, 1],
    ['10 MB, one file', 10_485_760, 1],
    ['10 MB across 25 files', 10_485_760, 25],
    ['250 MB across 400 files', 262_144_000, 400],
  ];

  it.each(cases)('%s', (_label, bytes, files) => {
    const needed = wincBilled(bytes, files);
    const credited = wincCredited(usdcCharged(bytes, files));
    expect(credited).toBeGreaterThanOrEqual(needed);
  });

  it('keeps the buffer proportionate rather than overcharging', () => {
    for (const [, bytes, files] of cases) {
      const ratio = wincCredited(usdcCharged(bytes, files)) / wincBilled(bytes, files);
      expect(ratio).toBeLessThan(1.2);
    }
  });

  it('the retired raw-byte quote under-funds — the bug this replaced', () => {
    // getTokenPriceForBytes prorates the GiB price by byte count, so the flat
    // per-item fee is scaled away to nothing.
    const rawByteQuote = (bytes: number) =>
      Number(((TOKENS_PER_GIB / GiB) * bytes).toFixed(6));

    for (const [, bytes, files] of cases) {
      expect(wincCredited(rawByteQuote(bytes))).toBeLessThan(wincBilled(bytes, files));
    }
    // Worst case: a 1 KB file bought barely half of what it cost.
    expect(wincCredited(rawByteQuote(1024)) / wincBilled(1024, 1)).toBeLessThan(0.6);
  });
});
