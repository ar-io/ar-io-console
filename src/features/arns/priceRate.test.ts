import { describe, expect, it } from 'vitest';

import { inclusiveFeeMultiplier, usdPerArioFromLegs } from './priceRate';

// Measured against payment.ardrive.io.
const WINC_PER_ARIO = 341052173;
const WINC_PER_USD = 282608695652;
const USD_FEES = [
  { name: 'Turbo Infrastructure Fee', operator: 'multiply', operatorMagnitude: 0.65 },
];

describe('inclusiveFeeMultiplier', () => {
  it('returns the multiplicative fee magnitude', () => {
    expect(inclusiveFeeMultiplier(USD_FEES)).toBe(0.65);
  });

  it('is a no-op for a fee-free response', () => {
    // Token legs come back with `fees: []`; nothing to undo.
    expect(inclusiveFeeMultiplier([])).toBe(1);
    expect(inclusiveFeeMultiplier(undefined)).toBe(1);
  });

  it('compounds multiple multiplicative fees', () => {
    expect(
      inclusiveFeeMultiplier([
        { operator: 'multiply', operatorMagnitude: 0.5 },
        { operator: 'multiply', operatorMagnitude: 0.8 },
      ]),
    ).toBeCloseTo(0.4, 10);
  });

  it('ignores non-multiplicative and nonsensical fees', () => {
    // An additive fee is not a rate adjustment; folding it in would be wrong.
    expect(inclusiveFeeMultiplier([{ operator: 'add', operatorMagnitude: 30 }])).toBe(1);
    expect(inclusiveFeeMultiplier([{ operator: 'multiply', operatorMagnitude: 0 }])).toBe(1);
    expect(inclusiveFeeMultiplier([{ operator: 'multiply' }])).toBe(1);
  });
});

describe('usdPerArioFromLegs', () => {
  it('puts both legs on the same fee footing', () => {
    const rate = usdPerArioFromLegs({
      wincPerArio: WINC_PER_ARIO,
      wincPerUsd: WINC_PER_USD,
      usdFees: USD_FEES,
    })!;
    // 1,734.32 ARIO is worth ~$1.36, NOT the ~$2.09 a card is charged.
    expect(1734.32208 * rate).toBeCloseTo(1.36, 2);
  });

  it('is 1/0.65 lower than the naive ratio', () => {
    const naive = WINC_PER_ARIO / WINC_PER_USD;
    const fixed = usdPerArioFromLegs({
      wincPerArio: WINC_PER_ARIO,
      wincPerUsd: WINC_PER_USD,
      usdFees: USD_FEES,
    })!;
    expect(naive / fixed).toBeCloseTo(1 / 0.65, 6);
  });

  it('matches the naive ratio when the service reports no fee', () => {
    // Guards against silently double-correcting if fees ever move off this leg.
    const naive = WINC_PER_ARIO / WINC_PER_USD;
    expect(
      usdPerArioFromLegs({ wincPerArio: WINC_PER_ARIO, wincPerUsd: WINC_PER_USD }),
    ).toBeCloseTo(naive, 12);
  });

  it('returns undefined rather than a bogus rate on bad input', () => {
    for (const legs of [
      { wincPerArio: 0, wincPerUsd: WINC_PER_USD },
      { wincPerArio: WINC_PER_ARIO, wincPerUsd: 0 },
      { wincPerArio: NaN, wincPerUsd: WINC_PER_USD },
    ]) {
      expect(usdPerArioFromLegs(legs)).toBeUndefined();
    }
  });
});
