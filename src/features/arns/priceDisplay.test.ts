import { describe, expect, it } from 'vitest';

import {
  arioToUsd,
  formatArioAmount,
  formatPriceDisplay,
  formatUsdAmount,
} from './priceDisplay';

describe('arioToUsd', () => {
  it('multiplies ario by the usd-per-ario rate', () => {
    expect(arioToUsd(1000, 0.05)).toBeCloseTo(50, 6);
    expect(arioToUsd(1, 0.05)).toBeCloseTo(0.05, 6);
  });

  it('returns undefined for a missing/non-finite/zero rate', () => {
    expect(arioToUsd(1000, undefined)).toBeUndefined();
    expect(arioToUsd(1000, NaN)).toBeUndefined();
    expect(arioToUsd(1000, 0)).toBeUndefined();
    expect(arioToUsd(1000, -1)).toBeUndefined();
    expect(arioToUsd(1000, Infinity)).toBeUndefined();
  });

  it('returns undefined for a missing/non-finite ario amount', () => {
    expect(arioToUsd(undefined, 0.05)).toBeUndefined();
    expect(arioToUsd(NaN, 0.05)).toBeUndefined();
    expect(arioToUsd(Infinity, 0.05)).toBeUndefined();
  });
});

describe('formatArioAmount', () => {
  it('keeps up to 2 decimals below 100', () => {
    expect(formatArioAmount(12.345)).toBe('12.35');
    expect(formatArioAmount(5)).toBe('5');
  });

  it('drops decimals at or above 100', () => {
    expect(formatArioAmount(100.9)).toBe('101');
    expect(formatArioAmount(1772.4)).toBe('1,772');
  });

  it('includes a thousands separator', () => {
    expect(formatArioAmount(1772)).toBe('1,772');
  });
});

describe('formatUsdAmount', () => {
  it('uses 2 decimals at or above $1', () => {
    expect(formatUsdAmount(50)).toBe('$50.00');
    expect(formatUsdAmount(1.5)).toBe('$1.50');
  });

  it('keeps sub-cent precision for small amounts', () => {
    expect(formatUsdAmount(0.0042)).toBe('$0.0042');
  });

  it('always has a leading $ and at least 2 decimals', () => {
    const s = formatUsdAmount(0.005);
    expect(s.startsWith('$')).toBe(true);
    expect(formatUsdAmount(0.5)).toBe('$0.50');
  });
});

describe('formatPriceDisplay', () => {
  it("without a rate → ARIO primary, no secondary", () => {
    const out = formatPriceDisplay({ ario: 1772, usdPerArio: undefined });
    expect(out.primary).toBe('1,772 ARIO');
    expect(out.secondary).toBeUndefined();
  });

  it("with a rate → $ primary + ARIO secondary", () => {
    const out = formatPriceDisplay({ ario: 1000, usdPerArio: 0.05 });
    expect(out.primary).toBe('$50.00');
    expect(out.secondary).toBe('≈ 1,000 ARIO');
  });

  it("without a rate → graceful ARIO fallback, no secondary", () => {
    const out = formatPriceDisplay({ ario: 1000, usdPerArio: undefined });
    expect(out.primary).toBe('1,000 ARIO');
    expect(out.secondary).toBeUndefined();
  });

  it('undefined/non-finite ario → em dash primary, no secondary', () => {
    expect(formatPriceDisplay({ ario: undefined, usdPerArio: 0.05 })).toEqual({
      primary: '—',
    });
    expect(formatPriceDisplay({ ario: NaN, usdPerArio: 0.05 })).toEqual({
      primary: '—',
    });
  });

  it('keeps the $ on the USD primary regardless of withUnit', () => {
    const out = formatPriceDisplay({
      ario: 1000,
      usdPerArio: 0.05,
      withUnit: false,
    });
    expect(out.primary).toBe('$50.00');
    // USD secondary still shows the ARIO unit for disambiguation.
    expect(out.secondary).toBe('≈ 1,000 ARIO');
  });

  it('keeps the ARIO unit on the USD-mode fallback even when withUnit is false', () => {
    // No rate + USD mode + dense-table (withUnit:false): must NOT render a bare
    // ARIO number under a "USD" heading — keep the unit so it reads as ARIO.
    const out = formatPriceDisplay({
      ario: 1000,
      usdPerArio: undefined,
      withUnit: false,
    });
    expect(out.primary).toBe('1,000 ARIO');
  });
});
