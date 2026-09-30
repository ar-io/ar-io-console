import type { SettlementMechanism } from './settlementMechanism';

/**
 * The ArNS gateway-operator discount: 20% off buying, extending, adding
 * undernames and upgrading a name (never primary names), paid in ARIO.
 *
 * The program grants it when the purchase carries the gateway's account and
 * the SIGNER is that gateway's operator or, on a gateway migrated to schema
 * 1.2.0, its operations address, and the gateway is joined, has run for 180
 * days, and passes 90% of its epochs (ario-arns `try_apply_gateway_discount`).
 *
 * Only the ARIO route can carry it. Credits, card and token routes are Turbo
 * actions: Turbo pays the registry, so there is no operator signer to check.
 *
 * `@ar.io/sdk` >= 4.4.0 attaches the SIGNER'S OWN gateway by default and
 * skips it quietly when it does not qualify. An operations wallet has no
 * gateway of its own, so it gets nothing unless the purchase names its gateway
 * (`discountGatewayAddress`, the operator's address). A named gateway that
 * does not qualify is an error in both the quote and the write, so this
 * module decides, from the public gateway fields, when naming one is safe.
 */

/** 180 days: `GATEWAY_DISCOUNT_MIN_TENURE`. */
export const OPERATOR_DISCOUNT_MIN_TENURE_MS = 15_552_000_000;
/** 90%, scaled by 1e6: `(1 + passed) * 1e6 / (1 + total)` must reach this. */
export const OPERATOR_DISCOUNT_MIN_PASS_RATE = 900_000;
/** The discount itself, for copy. The price is always the SDK's quote. */
export const OPERATOR_DISCOUNT_PERCENT = 20;
/**
 * How far past 180 days the tenure must be before an operations wallet names
 * its gateway. The program reads the cluster clock and this reads the
 * browser's; a gateway within this margin of its 180th day would be quoted
 * here and refused there, and a refused explicit gateway fails the purchase.
 */
export const EXPLICIT_TENURE_MARGIN_MS = 60 * 60 * 1000;

export type OperatorDiscountIneligibility =
  | 'not-authorised'
  | 'not-joined'
  | 'tenure'
  | 'performance'
  /** A field needed to decide is missing or malformed: never assume it qualifies. */
  | 'unknown';

/** The public `Gateway` fields the rule reads (`@ar.io/sdk` getGateway/getGateways). */
export interface GatewayForDiscount {
  status?: string;
  /** Milliseconds (the SDK's friendly view); seconds are accepted too. */
  startTimestamp?: number;
  stats?: { passedEpochCount?: number; totalEpochCount?: number };
  /**
   * Present only when the program honours it: schema >= 1.2.0 and non-zero.
   * The SDK omits it otherwise, so an absent value means "operator only".
   */
  operationsAddress?: string;
}

/** Seconds below 1e12 (until the year 33658), milliseconds above. */
function toMs(ts: number): number {
  return ts < 1e12 ? ts * 1000 : ts;
}

function isCount(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0;
}

/**
 * Why `signer` cannot claim the discount through the gateway run by
 * `operator`, or `undefined` when it can. Same checks, same order, as the
 * program; anything it cannot read is `'unknown'`, which never qualifies.
 */
export function operatorDiscountIneligibility(
  gateway: GatewayForDiscount,
  {
    operator,
    signer,
    nowMs,
    tenureMarginMs = 0,
  }: {
    operator: string;
    signer: string;
    nowMs: number;
    /** Extra tenure to require, for a clock the program does not share. */
    tenureMarginMs?: number;
  },
): OperatorDiscountIneligibility | undefined {
  const viaOperations =
    !!gateway.operationsAddress && gateway.operationsAddress === signer;
  if (signer !== operator && !viaOperations) return 'not-authorised';

  if (typeof gateway.status !== 'string') return 'unknown';
  if (gateway.status !== 'joined') return 'not-joined';

  const start = gateway.startTimestamp;
  if (typeof start !== 'number' || !Number.isFinite(start) || start <= 0) return 'unknown';
  // A start in the future is negative tenure, which fails here as on chain.
  if (nowMs - toMs(start) < OPERATOR_DISCOUNT_MIN_TENURE_MS + tenureMarginMs) {
    return 'tenure';
  }

  const passed = gateway.stats?.passedEpochCount;
  const total = gateway.stats?.totalEpochCount;
  if (!isCount(passed) || !isCount(total) || passed > total) return 'unknown';
  // Integer division, as the program does it: floor((1 + p) * 1e6 / (1 + t)).
  const rate = ((1n + BigInt(passed)) * 1_000_000n) / (1n + BigInt(total));
  if (rate < BigInt(OPERATOR_DISCOUNT_MIN_PASS_RATE)) return 'performance';

  return undefined;
}

export interface OperatorDiscount {
  /** The signer can claim the discount on an ARIO purchase. */
  eligible: boolean;
  /** Which role the signer holds on the qualifying gateway. */
  via?: 'operator' | 'operations';
  /**
   * The gateway to NAME on the purchase, as its operator's address. Set only
   * for an operations wallet: the SDK already tries an operator's own gateway
   * and skips it quietly when it does not qualify, whereas a named gateway
   * that does not qualify throws. So naming is reserved for the case the
   * default cannot reach.
   */
  discountGatewayAddress?: string;
  /** Why not, when not. */
  reason?: OperatorDiscountIneligibility | 'no-gateway';
}

/**
 * Which gateway, if any, gives `signer` the discount.
 *
 * Precedence: the signer's own gateway (it is the operator), then a gateway
 * whose operations address is the signer. An operator whose own gateway fails
 * a check is still looked up as an operations wallet elsewhere, since the two
 * roles are independent.
 */
export function resolveOperatorDiscount({
  signer,
  ownGateway,
  operationsGateway,
  nowMs,
}: {
  signer: string;
  /** `getGateway({ address: signer })`, or null when the signer runs none. */
  ownGateway: GatewayForDiscount | null | undefined;
  /** A gateway whose `operationsAddress` is the signer, with its operator. */
  operationsGateway: (GatewayForDiscount & { gatewayAddress: string }) | null | undefined;
  nowMs: number;
}): OperatorDiscount {
  let reason: OperatorDiscount['reason'] = 'no-gateway';

  if (ownGateway) {
    const why = operatorDiscountIneligibility(ownGateway, {
      operator: signer,
      signer,
      nowMs,
    });
    if (!why) return { eligible: true, via: 'operator' };
    reason = why;
  }

  if (operationsGateway && operationsGateway.gatewayAddress !== signer) {
    const why = operatorDiscountIneligibility(operationsGateway, {
      operator: operationsGateway.gatewayAddress,
      signer,
      nowMs,
      tenureMarginMs: EXPLICIT_TENURE_MARGIN_MS,
    });
    if (!why) {
      return {
        eligible: true,
        via: 'operations',
        discountGatewayAddress: operationsGateway.gatewayAddress,
      };
    }
    reason = why;
  }

  return { eligible: false, reason };
}

/**
 * The same mechanism, carrying the gateway to name when the purchase is an
 * ARIO write and there is one. Every other mechanism is returned untouched:
 * a Turbo action has no operator signer and ignores it.
 */
export function withDiscountGateway(
  mechanism: SettlementMechanism,
  discountGatewayAddress: string | undefined,
): SettlementMechanism {
  if (mechanism.kind !== 'ario-direct' || !discountGatewayAddress) return mechanism;
  return { ...mechanism, discountGatewayAddress };
}
