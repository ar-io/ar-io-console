import { describe, expect, it } from 'vitest';

import { buildDomainsCsv } from './domainCsv';
import type { ArNSName } from '@/types';

const NOW = Date.UTC(2026, 0, 1); // 2026-01-01

const lease: ArNSName = {
  name: 'my-app',
  displayName: 'my-app',
  processId: 'ANT111',
  currentTarget: 'TX222',
  lastUpdated: new Date(Date.UTC(2025, 5, 15)),
  type: 'lease',
  endTimestamp: Date.UTC(2026, 2, 2), // 2026-03-02 → 60 days from NOW
};

const permabuy: ArNSName = {
  name: 'forever',
  displayName: 'forever',
  processId: 'ANT333',
  type: 'permabuy',
};

describe('buildDomainsCsv', () => {
  it('emits a header row', () => {
    const csv = buildDomainsCsv([], NOW);
    expect(csv).toBe(
      '"Name","Type","Registered","Expires","Days remaining","ANT process ID","Target"',
    );
  });

  it('renders a lease row with expiry + days remaining', () => {
    const [, row] = buildDomainsCsv([lease], NOW).split('\n');
    expect(row).toBe(
      '"my-app.ar.io","Lease","2025-06-15","2026-03-02","60","ANT111","TX222"',
    );
  });

  it('renders permabuy as Never with blank days/target', () => {
    const [, row] = buildDomainsCsv([permabuy], NOW).split('\n');
    expect(row).toBe(
      '"forever.ar.io","Permanent","","Never","","ANT333",""',
    );
  });

  it('escapes embedded quotes', () => {
    const weird: ArNSName = { ...permabuy, name: 'a"b', displayName: 'a"b' };
    const [, row] = buildDomainsCsv([weird], NOW).split('\n');
    expect(row.startsWith('"a""b.ar.io"')).toBe(true);
  });
});
