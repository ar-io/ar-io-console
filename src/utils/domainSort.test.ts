import { describe, it, expect } from 'vitest';
import { sortDomains } from './domainSort';

const NOW = Date.UTC(2026, 0, 1);
const day = 86_400_000;

const rows = [
  { name: 'zeta', displayName: 'zeta', type: 'lease', endTimestamp: NOW + 400 * day },
  { name: 'alpha', displayName: 'alpha', type: 'permabuy' as const },
  { name: 'mid', displayName: 'mid', type: 'lease', endTimestamp: NOW + 10 * day },
  { name: 'gone', displayName: 'gone', type: 'lease', endTimestamp: NOW - day },
];

const names = (r: { name: string }[]) => r.map((x) => x.name);

describe('sortDomains', () => {
  it('sorts by domain name, case-insensitively', () => {
    expect(names(sortDomains(rows, 'domain', 'asc', NOW))).toEqual([
      'alpha', 'gone', 'mid', 'zeta',
    ]);
    expect(names(sortDomains(rows, 'domain', 'desc', NOW))).toEqual([
      'zeta', 'mid', 'gone', 'alpha',
    ]);
  });

  it('sorts expiry soonest-first, with never-expiring names last', () => {
    // A permabuy has no endTimestamp; treating that as 0 would sort it as the
    // most urgent row on the page, which is the exact opposite of the truth.
    expect(names(sortDomains(rows, 'expires', 'asc', NOW))).toEqual([
      'gone', 'mid', 'zeta', 'alpha',
    ]);
  });

  it('sorts status by urgency rather than alphabetically', () => {
    // Alphabetical would be active, expired, expiring, permanent — burying the
    // row you need to act on between two you do not.
    expect(names(sortDomains(rows, 'status', 'asc', NOW))).toEqual([
      'gone', 'mid', 'zeta', 'alpha',
    ]);
  });

  it('breaks ties by name, ascending, in both directions', () => {
    const tied = [
      { name: 'b', displayName: 'b', type: 'permabuy' as const },
      { name: 'a', displayName: 'a', type: 'permabuy' as const },
    ];
    // A reversed tiebreak reads as randomness rather than as a sort.
    expect(names(sortDomains(tied, 'expires', 'asc', NOW))).toEqual(['a', 'b']);
    expect(names(sortDomains(tied, 'expires', 'desc', NOW))).toEqual(['a', 'b']);
  });

  it('does not mutate the array it is given', () => {
    const original = [...rows];
    sortDomains(rows, 'domain', 'desc', NOW);
    expect(rows).toEqual(original);
  });
});
