import { describe, expect, it } from 'vitest';

import {
  auctionMultiplier,
  auctionTimeRemainingMs,
  baseAnnualMARIOForName,
  clampPage,
  compareReturnedNames,
  estimateReturnedNameArio,
  formatCountdown,
  isAuctionActive,
  selectActiveReturnedNames,
  START_RNP_PREMIUM,
  type ReturnedNameFees,
} from './returnedNamePricing';

const START = 1_000_000;
const END = 2_000_000; // span = 1,000,000

describe('auctionMultiplier', () => {
  it('equals START_RNP_PREMIUM at or before the start', () => {
    expect(
      auctionMultiplier({ startTimestamp: START, endTimestamp: END, now: START }),
    ).toBe(START_RNP_PREMIUM);
    expect(
      auctionMultiplier({
        startTimestamp: START,
        endTimestamp: END,
        now: START - 500_000,
      }),
    ).toBe(START_RNP_PREMIUM);
  });

  it('equals 1 at or after the end', () => {
    expect(
      auctionMultiplier({ startTimestamp: START, endTimestamp: END, now: END }),
    ).toBe(1);
    expect(
      auctionMultiplier({
        startTimestamp: START,
        endTimestamp: END,
        now: END + 500_000,
      }),
    ).toBe(1);
  });

  it('is ~25.5 at the midpoint (linear decay 50x → 1x)', () => {
    const mid = (START + END) / 2;
    expect(
      auctionMultiplier({ startTimestamp: START, endTimestamp: END, now: mid }),
    ).toBeCloseTo(25.5, 6);
  });

  it('honors a custom startPremium', () => {
    const mid = (START + END) / 2;
    // 10 + (1-10)*0.5 = 5.5
    expect(
      auctionMultiplier({
        startTimestamp: START,
        endTimestamp: END,
        now: mid,
        startPremium: 10,
      }),
    ).toBeCloseTo(5.5, 6);
  });

  it('collapses a zero-length window to premium before end and 1 after', () => {
    expect(
      auctionMultiplier({ startTimestamp: START, endTimestamp: START, now: START - 1 }),
    ).toBe(START_RNP_PREMIUM);
    expect(
      auctionMultiplier({ startTimestamp: START, endTimestamp: START, now: START }),
    ).toBe(1);
  });
});

describe('estimateReturnedNameArio', () => {
  it('computes (mARIO/1e6) * demandFactor * multiplier', () => {
    // 5,000,000 mARIO = 5 ARIO; *1 *1 = 5
    expect(estimateReturnedNameArio(5_000_000, 1, 1)).toBeCloseTo(5, 6);
  });

  it('applies a demand factor other than 1', () => {
    // 2 ARIO * 1.5 * 10 = 30
    expect(estimateReturnedNameArio(2_000_000, 1.5, 10)).toBeCloseTo(30, 6);
  });
});

describe('auctionTimeRemainingMs', () => {
  it('returns the positive remaining time', () => {
    expect(auctionTimeRemainingMs(END, START)).toBe(END - START);
  });

  it('never returns a negative value', () => {
    expect(auctionTimeRemainingMs(START, END)).toBe(0);
  });
});

describe('clampPage', () => {
  it('leaves an in-range page unchanged', () => {
    expect(clampPage(0, 5)).toBe(0);
    expect(clampPage(3, 5)).toBe(3);
    expect(clampPage(4, 5)).toBe(4); // last page
  });

  it('clamps a page beyond the last down to the last page', () => {
    // The reported bug: on page 3 (0-indexed) of a set that shrinks to 30 rows
    // (pageCount 2 at pageSize 25) → clamp to page 1.
    expect(clampPage(3, 2)).toBe(1);
    expect(clampPage(75, 2)).toBe(1);
  });

  it('floors an empty/degenerate set at page 0', () => {
    expect(clampPage(4, 0)).toBe(0);
    expect(clampPage(4, 1)).toBe(0);
    expect(clampPage(0, 0)).toBe(0);
  });

  it('never returns a negative page', () => {
    expect(clampPage(-1, 5)).toBe(0);
    expect(clampPage(-10, 1)).toBe(0);
  });

  it('floors fractional and rejects non-finite pages', () => {
    expect(clampPage(2.9, 5)).toBe(2);
    expect(clampPage(NaN, 5)).toBe(0);
    // Non-finite pages are rejected to page 0 (never trust an unbounded index).
    expect(clampPage(Infinity, 5)).toBe(0);
  });
});

describe('formatCountdown', () => {
  it("returns 'Ended' at or below zero", () => {
    expect(formatCountdown(0)).toBe('Ended');
    expect(formatCountdown(-1000)).toBe('Ended');
  });

  it('uses the days bucket for >= 1 day', () => {
    const ms = (2 * 86400 + 3 * 3600) * 1000;
    expect(formatCountdown(ms)).toBe('2d 3h');
  });

  it('uses the hours bucket for >= 1 hour and < 1 day', () => {
    const ms = (5 * 3600 + 12 * 60) * 1000;
    expect(formatCountdown(ms)).toBe('5h 12m');
  });

  it('uses the minutes bucket below an hour', () => {
    const ms = (7 * 60 + 9) * 1000;
    expect(formatCountdown(ms)).toBe('7m 9s');
  });
});

describe('isAuctionActive', () => {
  it('is inclusive of the start', () => {
    expect(isAuctionActive(START, END, START)).toBe(true);
  });

  it('is exclusive of the end', () => {
    expect(isAuctionActive(START, END, END)).toBe(false);
  });

  it('is false outside the window', () => {
    expect(isAuctionActive(START, END, START - 1)).toBe(false);
    expect(isAuctionActive(START, END, END + 1)).toBe(false);
    expect(isAuctionActive(START, END, (START + END) / 2)).toBe(true);
  });
});

describe('selectActiveReturnedNames', () => {
  const rows = [
    { name: 'live', startTimestamp: START, endTimestamp: END }, // active mid-window
    { name: 'future', startTimestamp: END, endTimestamp: END + 1000 }, // not started
    { name: 'expired', startTimestamp: 0, endTimestamp: START }, // ended
  ];

  it('keeps only auctions live at now', () => {
    const now = (START + END) / 2;
    expect(selectActiveReturnedNames(rows, now).map((r) => r.name)).toEqual([
      'live',
    ]);
  });

  it('drops a row the instant it crosses its end (exclusive end)', () => {
    expect(
      selectActiveReturnedNames(
        [{ name: 'live', startTimestamp: START, endTimestamp: END }],
        END,
      ),
    ).toEqual([]);
  });
});

describe('compareReturnedNames', () => {
  it('sorts by name honoring direction', () => {
    const a = { name: 'apple', startTimestamp: START, endTimestamp: END };
    const b = { name: 'banana', startTimestamp: START, endTimestamp: END };
    expect(compareReturnedNames(a, b, 'name', 'asc', START)).toBeLessThan(0);
    expect(compareReturnedNames(a, b, 'name', 'desc', START)).toBeGreaterThan(0);
  });

  it('sorts by endTimestamp', () => {
    const a = { name: 'a', startTimestamp: START, endTimestamp: END };
    const b = { name: 'b', startTimestamp: START, endTimestamp: END + 1000 };
    expect(compareReturnedNames(a, b, 'endTimestamp', 'asc', START)).toBeLessThan(
      0,
    );
  });

  it('sorts premium by the LIVE multiplier at now, not a stale snapshot', () => {
    // Two auctions with different windows whose live multipliers CROSS: `slow`
    // decays over a long span, `fast` starts later over a short span. Their live
    // premiums cross (~now=44), so the ordering the user sees flips over time —
    // which a static snapshot key could not reproduce.
    const slow = { name: 'slow', startTimestamp: 0, endTimestamp: 1000 };
    const fast = { name: 'fast', startTimestamp: 40, endTimestamp: 140 };

    const liveM = (r: { startTimestamp: number; endTimestamp: number }, now: number) =>
      auctionMultiplier({
        startTimestamp: r.startTimestamp,
        endTimestamp: r.endTimestamp,
        now,
      });

    // Early: fast just opened near 50x, slow already decayed → fast > slow.
    const early = 42;
    expect(liveM(fast, early)).toBeGreaterThan(liveM(slow, early));
    // Descending premium ⇒ higher multiplier sorts first (fast before slow).
    expect(
      compareReturnedNames(slow, fast, 'premiumMultiplier', 'desc', early),
    ).toBeGreaterThan(0);

    // Later: fast has decayed hard on its short span, slow still high → slow > fast.
    const late = 100;
    expect(liveM(slow, late)).toBeGreaterThan(liveM(fast, late));
    expect(
      compareReturnedNames(slow, fast, 'premiumMultiplier', 'desc', late),
    ).toBeLessThan(0);
  });
});

describe('baseAnnualMARIOForName', () => {
  const fees: ReturnedNameFees = {
    1: { lease: { 1: 1000 }, permabuy: 5000 },
    5: { lease: { 1: 500 }, permabuy: 2500 },
    13: { lease: { 1: 100 }, permabuy: 500 },
  };

  it('picks the exact-length bucket when present', () => {
    expect(baseAnnualMARIOForName(fees, 1)).toBe(1000);
    expect(baseAnnualMARIOForName(fees, 5)).toBe(500);
  });

  it('collapses lengths > 12 to the 13+ bucket', () => {
    expect(baseAnnualMARIOForName(fees, 13)).toBe(100);
    expect(baseAnnualMARIOForName(fees, 20)).toBe(100);
  });

  it('does NOT fall back to the cheap 13+ bucket for a short name whose exact bucket is absent', () => {
    // Bucket 3 is missing; falling back to fees[13] (100) would under-quote a
    // 3-char name, so we return undefined and hide the estimate instead.
    expect(baseAnnualMARIOForName(fees, 3)).toBeUndefined();
  });

  it('returns undefined when the exact bucket is absent', () => {
    const sparse: ReturnedNameFees = { 13: { lease: {}, permabuy: 500 } };
    // length 3 → bucket 3 missing (no fallback to 13 for short names)
    expect(baseAnnualMARIOForName(sparse, 3)).toBeUndefined();
    expect(baseAnnualMARIOForName({}, 3)).toBeUndefined();
    // length > 12 with an empty 13+ lease also yields undefined
    expect(baseAnnualMARIOForName(sparse, 20)).toBeUndefined();
  });
});

describe('compareReturnedNames — estPrice', () => {
  const row = (name: string, start = START, end = END) => ({
    name, startTimestamp: start, endTimestamp: end,
  });

  it('orders by resolved price, not by premium', () => {
    // Premium is identical here; only the base fee differs. Sorting by premium
    // would call these equal, which is the whole reason estPrice exists.
    const a = row('aa');
    const b = row('bbbb');
    const priceOf = (r: { name: string }) => (r.name === 'aa' ? 90 : 10);
    expect(compareReturnedNames(a, b, 'estPrice', 'asc', START, priceOf)).toBeGreaterThan(0);
    expect(compareReturnedNames(a, b, 'estPrice', 'desc', START, priceOf)).toBeLessThan(0);
  });

  it('sorts unresolvable prices LAST in both directions', () => {
    // Fees not loaded, or a name length outside the schedule. Treating those as
    // zero would park them at the top of an ascending sort as if they were free.
    const known = row('known');
    const unknown = row('unknown');
    const priceOf = (r: { name: string }) => (r.name === 'known' ? 5 : undefined);
    expect(compareReturnedNames(known, unknown, 'estPrice', 'asc', START, priceOf)).toBeLessThan(0);
    expect(compareReturnedNames(known, unknown, 'estPrice', 'desc', START, priceOf)).toBeLessThan(0);
  });

  it('treats two unresolvable prices as equal', () => {
    const priceOf = () => undefined;
    expect(compareReturnedNames(row('a'), row('b'), 'estPrice', 'asc', START, priceOf)).toBe(0);
  });

  it('is stable when no resolver is supplied', () => {
    expect(compareReturnedNames(row('a'), row('b'), 'estPrice', 'asc', START)).toBe(0);
  });
});
