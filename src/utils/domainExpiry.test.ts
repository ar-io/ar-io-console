import { describe, it, expect } from 'vitest';
import {
  daysUntil,
  isExpiringSoon,
  getExpiringDomains,
  expiryLabel,
  EXPIRY_WARNING_DAYS,
} from './domainExpiry';

const NOW = 1_700_000_000_000; // fixed reference (ms epoch)
const DAY = 86_400_000;
const nameAt = (name: string, opts: { type?: string; days?: number } = {}) => ({
  name,
  displayName: name,
  type: opts.type,
  endTimestamp: opts.days === undefined ? undefined : NOW + opts.days * DAY,
});

describe('daysUntil', () => {
  it('rounds up to whole days and goes negative once past', () => {
    expect(daysUntil(NOW + 5 * DAY, NOW)).toBe(5);
    expect(daysUntil(NOW + 0.2 * DAY, NOW)).toBe(1);
    expect(daysUntil(NOW - 3 * DAY, NOW)).toBe(-3);
    // Even a fraction past is "expired" (-1), never rounded up to 0 / "today".
    expect(daysUntil(NOW - 0.2 * DAY, NOW)).toBe(-1);
    expect(daysUntil(NOW - 1, NOW)).toBe(-1);
  });
});

describe('isExpiringSoon', () => {
  it('flags leases within the threshold and in grace, not those beyond it', () => {
    expect(isExpiringSoon(nameAt('a', { type: 'lease', days: 10 }), NOW)).toBe(true);
    expect(isExpiringSoon(nameAt('b', { type: 'lease', days: EXPIRY_WARNING_DAYS }), NOW)).toBe(true);
    expect(isExpiringSoon(nameAt('c', { type: 'lease', days: -2 }), NOW)).toBe(true); // grace
    expect(isExpiringSoon(nameAt('d', { type: 'lease', days: 45 }), NOW)).toBe(false);
  });

  it('never flags permabuy or names without an endTimestamp', () => {
    expect(isExpiringSoon(nameAt('perma', { type: 'permabuy' }), NOW)).toBe(false);
    expect(isExpiringSoon(nameAt('unknown', { type: 'lease' }), NOW)).toBe(false);
    expect(isExpiringSoon({ name: 'x', displayName: 'x' }, NOW)).toBe(false);
  });
});

describe('getExpiringDomains', () => {
  it('returns only soon-expiring leases, soonest-first', () => {
    const names = [
      nameAt('far', { type: 'lease', days: 200 }),
      nameAt('soon', { type: 'lease', days: 3 }),
      nameAt('perma', { type: 'permabuy' }),
      nameAt('grace', { type: 'lease', days: -1 }),
      nameAt('mid', { type: 'lease', days: 20 }),
    ];
    const result = getExpiringDomains(names, NOW);
    expect(result.map((d) => d.name)).toEqual(['grace', 'soon', 'mid']);
    expect(result[0].daysRemaining).toBe(-1);
  });

  it('respects a custom threshold', () => {
    const names = [nameAt('a', { type: 'lease', days: 10 })];
    expect(getExpiringDomains(names, NOW, 7)).toHaveLength(0);
    expect(getExpiringDomains(names, NOW, 14)).toHaveLength(1);
  });
});

describe('expiryLabel', () => {
  it('renders compact human labels', () => {
    expect(expiryLabel(-2)).toBe('expired');
    expect(expiryLabel(0)).toBe('today');
    expect(expiryLabel(1)).toBe('in 1 day');
    expect(expiryLabel(9)).toBe('in 9 days');
  });
});
