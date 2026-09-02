import { describe, expect, it } from 'vitest';

import {
  fiatCentsForPurchase,
  readWincTotals,
  wincForPurchase,
  splitNameAndSetup,
  type ArNSPriceFields,
} from './priceTotals';

/** Live testnet response for a 1-year lease, captured 2026-08-30. */
const TESTNET_BUY: ArNSPriceFields = {
  mARIO: '2593963800',
  winc: '1828543006083',
  antSpawnSurchargeWinc: '2000000000000',
  wincTotalWithAntSpawn: '3828543006083',
  // Added by turbo-sdk on top of the service response.
  wincTotal: '3828543006083',
  fiatEstimate: {
    paymentAmount: 580,
    paymentAmountWithAntSpawn: 992,
  },
} as ArNSPriceFields & { mARIO: string };

/** Live production response — the legacy 6-field shape, same day. */
const LEGACY_BUY: ArNSPriceFields = {
  winc: '1903270808682',
  antSpawnSurchargeWinc: '900000000000',
  sponsoredTransferSurchargeWinc: '500000000',
  wincTotalWithAntSpawn: '2803270808682',
  wincTotalWithSponsoredSpawn: '2803770808682',
};

describe('readWincTotals', () => {
  it('splits the live testnet buy price into base, surcharge and total', () => {
    expect(readWincTotals(TESTNET_BUY)).toEqual({
      baseWinc: '1828543006083',
      surchargeWinc: '2000000000000',
      totalWinc: '3828543006083',
      hasSurcharge: true,
    });
  });

  it('never folds the retired sponsoredTransfer surcharge into the total', () => {
    const totals = readWincTotals(LEGACY_BUY);
    expect(totals.totalWinc).toBe('2803270808682');
    // The legacy total is 500000000 higher; picking it would charge for a
    // spawn-then-transfer mechanism that no longer exists.
    expect(totals.totalWinc).not.toBe(LEGACY_BUY.wincTotalWithSponsoredSpawn);
  });

  it('treats a missing surcharge as zero, so non-Buy intents price identically', () => {
    expect(readWincTotals({ winc: '4200000000000' })).toEqual({
      baseWinc: '4200000000000',
      surchargeWinc: '0',
      totalWinc: '4200000000000',
      hasSurcharge: false,
    });
  });

  it('computes the total itself when the server omits it', () => {
    const totals = readWincTotals({
      winc: '1000000000000',
      antSpawnSurchargeWinc: '2000000000000',
    });
    expect(totals.totalWinc).toBe('3000000000000');
  });

  it('prefers the server total over its own arithmetic when they disagree', () => {
    // The server is the party that debits, so its number is the one that settles.
    const totals = readWincTotals({
      winc: '1000000000000',
      antSpawnSurchargeWinc: '2000000000000',
      wincTotalWithAntSpawn: '2500000000000',
    });
    expect(totals.totalWinc).toBe('2500000000000');
  });

  it("prefers the SDK's wincTotal above every other source", () => {
    const totals = readWincTotals({
      winc: '1000000000000',
      antSpawnSurchargeWinc: '2000000000000',
      wincTotalWithAntSpawn: '3000000000000',
      wincTotal: '3100000000000',
    });
    expect(totals.totalWinc).toBe('3100000000000');
  });

  it('falls back to the service total when the response never met the SDK', () => {
    // TurboArNSClient fetches the fiat leg by hand, because the SDK's query
    // builder drops `currency` — that response carries no `wincTotal`.
    const totals = readWincTotals(LEGACY_BUY);
    expect(totals.totalWinc).toBe('2803270808682');
  });

  it('stays exact past 2^53 rather than losing lamports to float', () => {
    const totals = readWincTotals({
      winc: '9007199254740993',
      antSpawnSurchargeWinc: '1',
    });
    expect(totals.totalWinc).toBe('9007199254740994');
  });

  it('ignores a malformed surcharge instead of charging NaN', () => {
    const totals = readWincTotals({
      winc: '1828543006083',
      antSpawnSurchargeWinc: 'not-a-number',
    });
    expect(totals.surchargeWinc).toBe('0');
    expect(totals.totalWinc).toBe('1828543006083');
  });

  it('throws rather than quoting a price it cannot read', () => {
    expect(() => readWincTotals({ winc: '' })).toThrow(/usable winc/);
    expect(() =>
      readWincTotals({ winc: undefined as unknown as string }),
    ).toThrow(/usable winc/);
  });
});

describe('wincForPurchase', () => {
  it('charges the base when the user spawns their own ANT', () => {
    expect(wincForPurchase(TESTNET_BUY, false)).toBe('1828543006083');
  });

  it('charges the total when Turbo spawns it', () => {
    expect(wincForPurchase(TESTNET_BUY, true)).toBe('3828543006083');
  });

  it('is the same number both ways for an intent with no surcharge', () => {
    const extend: ArNSPriceFields = { winc: '620000000000' };
    expect(wincForPurchase(extend, true)).toBe(wincForPurchase(extend, false));
  });
});

describe('fiatCentsForPurchase', () => {
  it('reads base vs total from the price route, which reports them separately', () => {
    expect(fiatCentsForPurchase(TESTNET_BUY, false)).toBe(580);
    expect(fiatCentsForPurchase(TESTNET_BUY, true)).toBe(992);
  });

  it('falls back to the base when no surcharge is quoted', () => {
    const extend: ArNSPriceFields = {
      winc: '620000000000',
      fiatEstimate: { paymentAmount: 210 },
    };
    expect(fiatCentsForPurchase(extend, true)).toBe(210);
  });

  it('returns undefined when no fiat estimate was requested', () => {
    expect(fiatCentsForPurchase({ winc: '1' }, true)).toBeUndefined();
  });

  it('treats a zero amount as absent rather than as free', () => {
    expect(
      fiatCentsForPurchase({ winc: '1', fiatEstimate: { paymentAmount: 0 } }, false),
    ).toBeUndefined();
  });
});

describe('splitNameAndSetup', () => {
  it('makes the three displayed lines add up', () => {
    // The panel showed the TOTAL on the name row as well, so setup appeared to
    // be excluded from both figures and the total read as wrong.
    const { nameCredits } = splitNameAndSetup(3.0198, 2);
    expect(nameCredits).toBeCloseTo(1.0198, 6);
    expect((nameCredits ?? 0) + 2).toBeCloseTo(3.0198, 6);
  });

  it('scales a token sub-figure by the same ratio', () => {
    // 0.1058 SOL is the TOTAL in SOL; the name's share is proportional because
    // both derive linearly from winc.
    const { ratio } = splitNameAndSetup(3.5666, 2);
    expect(0.1058 * ratio).toBeCloseTo(0.0465, 4);
  });

  it('leaves the price alone when nothing was charged for setup', () => {
    // Extend, upgrade and undernames mint nothing, so they carry no setup.
    expect(splitNameAndSetup(1.5, 0)).toEqual({ nameCredits: 1.5, ratio: 1 });
    expect(splitNameAndSetup(1.5, undefined)).toEqual({
      nameCredits: 1.5,
      ratio: 1,
    });
  });

  it('reports nothing when the total is unknown', () => {
    expect(splitNameAndSetup(undefined, 2).nameCredits).toBeUndefined();
  });

  it('never produces a negative name price', () => {
    // A setup larger than the total means a malformed response; an implausible
    // zero beats a negative figure rendered as fact.
    expect(splitNameAndSetup(1, 2).nameCredits).toBe(0);
  });
})
