import type { ArNSName } from '@/types';
import { daysUntil } from './domainExpiry';

const HEADERS = [
  'Name',
  'Type',
  'Registered',
  'Expires',
  'Days remaining',
  'ANT process ID',
  'Target',
];

/** Quote a CSV cell, escaping embedded quotes (RFC 4180). */
function csvCell(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

// A NaN/Infinity ms would make `new Date(ms).toISOString()` throw
// `RangeError: Invalid time value` and fail the whole export — emit an empty
// cell for a non-finite timestamp instead.
const isoDate = (ms: number) =>
  Number.isFinite(ms) ? new Date(ms).toISOString().split('T')[0] : '';

/**
 * Build a CSV of owned ArNS names. Pure (no DOM) so it's unit-testable.
 * Permabuy names show "Never" for expiry and blank days-remaining.
 */
export function buildDomainsCsv(
  domains: ArNSName[],
  now: number = Date.now(),
): string {
  const rows = domains.map((d) => {
    const isPermabuy = d.type === 'permabuy';
    return [
      `${d.name}.ar.io`,
      isPermabuy ? 'Permanent' : 'Lease',
      d.lastUpdated ? isoDate(d.lastUpdated.getTime()) : '',
      isPermabuy
        ? 'Never'
        : Number.isFinite(d.endTimestamp)
          ? isoDate(d.endTimestamp as number)
          : '',
      !isPermabuy && Number.isFinite(d.endTimestamp)
        ? String(daysUntil(d.endTimestamp as number, now))
        : '',
      d.processId ?? '',
      d.currentTarget ?? '',
    ];
  });
  return [
    HEADERS.map(csvCell).join(','),
    ...rows.map((r) => r.map(csvCell).join(',')),
  ].join('\n');
}

/** Build + download the domains CSV (browser only). */
export function downloadDomainsCsv(domains: ArNSName[]): void {
  const csv = buildDomainsCsv(domains);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `arns-domains-${new Date().toISOString().split('T')[0]}.csv`,
  );
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
