import { describe, expect, it } from 'vitest';

import {
  EXPLICIT_TENURE_MARGIN_MS,
  OPERATOR_DISCOUNT_MIN_TENURE_MS,
  operatorDiscountIneligibility,
  resolveOperatorDiscount,
  withDiscountGateway,
  type GatewayForDiscount,
} from './operatorDiscount';

const NOW = Date.UTC(2026, 8, 30);
const OPERATOR = 'Operator1111111111111111111111111111111111111';
const OPS = 'Operations11111111111111111111111111111111111';
const OTHER = 'Somebody1111111111111111111111111111111111111';

/** A gateway that qualifies: joined, a year old, 95% pass rate. */
const good = (over: Partial<GatewayForDiscount> = {}): GatewayForDiscount => ({
  status: 'joined',
  startTimestamp: NOW - 365 * 86_400_000,
  stats: { passedEpochCount: 94, totalEpochCount: 99 },
  ...over,
});

const check = (g: GatewayForDiscount, signer = OPERATOR, tenureMarginMs = 0) =>
  operatorDiscountIneligibility(g, { operator: OPERATOR, signer, nowMs: NOW, tenureMarginMs });

describe('operatorDiscountIneligibility', () => {
  it('qualifies the operator of a joined, tenured, well-performing gateway', () => {
    expect(check(good())).toBeUndefined();
  });

  it('qualifies the operations address when the gateway carries one', () => {
    expect(check(good({ operationsAddress: OPS }), OPS)).toBeUndefined();
  });

  it('refuses an operations wallet when the gateway has none (schema < 1.2.0, or unset)', () => {
    // The SDK omits the field below 1.2.0 and when it is the zero address.
    expect(check(good(), OPS)).toBe('not-authorised');
  });

  it('refuses anyone else', () => {
    expect(check(good({ operationsAddress: OPS }), OTHER)).toBe('not-authorised');
  });

  it('refuses a gateway that is leaving', () => {
    expect(check(good({ status: 'leaving' }))).toBe('not-joined');
  });

  it('draws the tenure line at exactly 180 days', () => {
    expect(check(good({ startTimestamp: NOW - OPERATOR_DISCOUNT_MIN_TENURE_MS }))).toBeUndefined();
    expect(check(good({ startTimestamp: NOW - OPERATOR_DISCOUNT_MIN_TENURE_MS + 1 }))).toBe('tenure');
  });

  it('reads a start timestamp in seconds as well as milliseconds', () => {
    const secs = Math.floor((NOW - OPERATOR_DISCOUNT_MIN_TENURE_MS) / 1000);
    expect(check(good({ startTimestamp: secs }))).toBeUndefined();
    expect(check(good({ startTimestamp: secs + 1 }))).toBe('tenure');
  });

  it('refuses a start in the future', () => {
    expect(check(good({ startTimestamp: NOW + 1000 }))).toBe('tenure');
  });

  it('applies the tenure margin when asked', () => {
    const edge = good({ startTimestamp: NOW - OPERATOR_DISCOUNT_MIN_TENURE_MS - 1000 });
    expect(check(edge)).toBeUndefined();
    expect(check(edge, OPERATOR, EXPLICIT_TENURE_MARGIN_MS)).toBe('tenure');
  });

  it('draws the pass-rate line at 90%, with the program\'s integer rule', () => {
    // (1 + 8) * 1e6 / (1 + 9) = 900_000: exactly the line.
    expect(check(good({ stats: { passedEpochCount: 8, totalEpochCount: 9 } }))).toBeUndefined();
    // (1 + 7) * 1e6 / (1 + 9) = 800_000.
    expect(check(good({ stats: { passedEpochCount: 7, totalEpochCount: 9 } }))).toBe('performance');
    // (1 + 88) * 1e6 / (1 + 99) = 890_000.
    expect(check(good({ stats: { passedEpochCount: 88, totalEpochCount: 99 } }))).toBe('performance');
    // A brand-new gateway: (1 + 0) / (1 + 0) = 100%.
    expect(check(good({ stats: { passedEpochCount: 0, totalEpochCount: 0 } }))).toBeUndefined();
  });

  it('floors the pass rate rather than rounding it up', () => {
    // (1 + 898) * 1e6 / (1 + 999) = 899_000 exactly; (1 + 899) / 1000 = 900_000.
    expect(check(good({ stats: { passedEpochCount: 898, totalEpochCount: 999 } }))).toBe('performance');
    expect(check(good({ stats: { passedEpochCount: 899, totalEpochCount: 999 } }))).toBeUndefined();
  });

  it('treats anything it cannot read as not eligible', () => {
    expect(check(good({ status: undefined }))).toBe('unknown');
    expect(check(good({ startTimestamp: undefined }))).toBe('unknown');
    expect(check(good({ startTimestamp: Number.NaN }))).toBe('unknown');
    expect(check(good({ stats: undefined }))).toBe('unknown');
    expect(check(good({ stats: { passedEpochCount: 5 } }))).toBe('unknown');
    expect(check(good({ stats: { passedEpochCount: 1.5, totalEpochCount: 2 } }))).toBe('unknown');
    expect(check(good({ stats: { passedEpochCount: 10, totalEpochCount: 9 } }))).toBe('unknown');
  });
});

describe('resolveOperatorDiscount', () => {
  const opsGateway = (over: Partial<GatewayForDiscount> = {}) => ({
    ...good({ operationsAddress: OPS }),
    gatewayAddress: OPERATOR,
    ...over,
  });

  it('an eligible operator is eligible and names no gateway (the SDK default applies it)', () => {
    expect(
      resolveOperatorDiscount({ signer: OPERATOR, ownGateway: good(), operationsGateway: null, nowMs: NOW }),
    ).toEqual({ eligible: true, via: 'operator' });
  });

  it('an eligible operations wallet names its gateway by the operator address', () => {
    expect(
      resolveOperatorDiscount({ signer: OPS, ownGateway: null, operationsGateway: opsGateway(), nowMs: NOW }),
    ).toEqual({ eligible: true, via: 'operations', discountGatewayAddress: OPERATOR });
  });

  it('prefers the signer\'s own gateway over one it operates for', () => {
    const r = resolveOperatorDiscount({
      signer: OPS,
      ownGateway: good(),
      operationsGateway: opsGateway(),
      nowMs: NOW,
    });
    expect(r).toEqual({ eligible: true, via: 'operator' });
  });

  it('falls through to the operations gateway when the own one does not qualify', () => {
    const r = resolveOperatorDiscount({
      signer: OPS,
      ownGateway: good({ status: 'leaving' }),
      operationsGateway: opsGateway(),
      nowMs: NOW,
    });
    expect(r.discountGatewayAddress).toBe(OPERATOR);
  });

  it('names no gateway when the operations gateway does not qualify', () => {
    for (const over of [
      { status: 'leaving' },
      { stats: { passedEpochCount: 1, totalEpochCount: 9 } },
      { startTimestamp: NOW - 10 * 86_400_000 },
      { status: undefined },
    ] as Partial<GatewayForDiscount>[]) {
      const r = resolveOperatorDiscount({
        signer: OPS,
        ownGateway: null,
        operationsGateway: opsGateway(over),
        nowMs: NOW,
      });
      expect(r.eligible).toBe(false);
      expect(r.discountGatewayAddress).toBeUndefined();
    }
  });

  it('requires the clock margin before naming a gateway near its 180th day', () => {
    const r = resolveOperatorDiscount({
      signer: OPS,
      ownGateway: null,
      operationsGateway: opsGateway({
        startTimestamp: NOW - OPERATOR_DISCOUNT_MIN_TENURE_MS - 1000,
      }),
      nowMs: NOW,
    });
    expect(r).toEqual({ eligible: false, reason: 'tenure' });
  });

  it('names no gateway when the matched gateway does not list the signer as operations', () => {
    const r = resolveOperatorDiscount({
      signer: OPS,
      ownGateway: null,
      operationsGateway: { ...good(), gatewayAddress: OPERATOR },
      nowMs: NOW,
    });
    expect(r).toEqual({ eligible: false, reason: 'not-authorised' });
  });

  it('says there is no gateway when there is none', () => {
    expect(
      resolveOperatorDiscount({ signer: OTHER, ownGateway: null, operationsGateway: null, nowMs: NOW }),
    ).toEqual({ eligible: false, reason: 'no-gateway' });
  });

  it('reports why an operator\'s own gateway fails', () => {
    expect(
      resolveOperatorDiscount({
        signer: OPERATOR,
        ownGateway: good({ status: 'leaving' }),
        operationsGateway: null,
        nowMs: NOW,
      }),
    ).toEqual({ eligible: false, reason: 'not-joined' });
  });
});

describe('withDiscountGateway', () => {
  it('adds the gateway to an ARIO write', () => {
    expect(withDiscountGateway({ kind: 'ario-direct', fundFrom: 'balance' }, OPERATOR)).toEqual({
      kind: 'ario-direct',
      fundFrom: 'balance',
      discountGatewayAddress: OPERATOR,
    });
  });

  it('omits it when there is none to name, so the SDK default applies', () => {
    const m = { kind: 'ario-direct', fundFrom: 'any' } as const;
    expect(withDiscountGateway(m, undefined)).toEqual(m);
    expect('discountGatewayAddress' in withDiscountGateway(m, undefined)).toBe(false);
  });

  it('never puts it on a Turbo action', () => {
    expect(withDiscountGateway({ kind: 'turbo-credits' }, OPERATOR)).toEqual({
      kind: 'turbo-credits',
    });
  });
});
