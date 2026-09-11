import { describe, expect, it } from 'vitest';

import {
  BLANK_BUY_TARGET,
  buildTargetOptions,
  describeBuyTarget,
  describeOptionMeta,
  labelForTxId,
  relativeTime,
  resolveBuyTarget,
  shortTxId,
} from './buyTarget';

/** Distinct, well-formed 43-char Arweave ids. */
const TX_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const TX_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const TX_C = 'ccccccccccccccccccccccccccccccccccccccccccc';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = 1_000_000_000_000;

describe('resolveBuyTarget', () => {
  it('leaves an untouched control on the standard default', () => {
    expect(resolveBuyTarget(BLANK_BUY_TARGET)).toEqual({
      txId: undefined,
      valid: true,
    });
  });

  it('accepts a well-formed id', () => {
    expect(resolveBuyTarget({ mode: 'custom', txId: TX_A })).toEqual({
      txId: TX_A,
      valid: true,
    });
  });

  it('trims a pasted id rather than rejecting the whitespace', () => {
    expect(resolveBuyTarget({ mode: 'custom', txId: `  ${TX_A}\n` }).txId)
      .toBe(TX_A);
  });

  it('treats an emptied custom field as the default, not an error', () => {
    // Opening the control, reading it and changing your mind must not leave the
    // buy button dead with no visible cause.
    expect(resolveBuyTarget({ mode: 'custom', txId: '   ' })).toEqual({
      txId: undefined,
      valid: true,
    });
  });

  it('blocks a malformed id instead of letting the mint revert', () => {
    // Minting against this fails the on-chain `is_valid_arweave_id` check,
    // which the buyer would meet as an opaque program error after paying.
    const r = resolveBuyTarget({ mode: 'custom', txId: 'not-a-tx-id' });
    expect(r.valid).toBe(false);
    expect(r.txId).toBeUndefined();
    expect(r.error).toMatch(/43/);
  });
});

describe('buildTargetOptions', () => {
  it('offers manifest deploys, pages and uploads newest first', () => {
    const options = buildTargetOptions({
      deploys: [{ type: 'manifest', manifestId: TX_A, timestamp: 100, appName: 'My Site' }],
      pages: [{ title: 'Links', latestTxId: TX_B, updatedAt: 300 }],
      uploads: [{ id: TX_C, fileName: 'cv.pdf', timestamp: 200 }],
    });
    expect(options.map((o) => o.txId)).toEqual([TX_B, TX_C, TX_A]);
    expect(options.map((o) => o.kind)).toEqual(['page', 'file', 'site']);
    expect(options[2].label).toBe('My Site');
  });

  it('skips deploys with no single address to point at', () => {
    // A `files` deploy is a bag of data items and an `arns-update` is a record
    // write — neither is a destination.
    expect(
      buildTargetOptions({
        deploys: [
          { type: 'files', id: TX_A, timestamp: 1 },
          { type: 'arns-update', id: TX_B, timestamp: 2 },
        ],
      }),
    ).toEqual([]);
  });

  it('drops entries whose id is missing or malformed', () => {
    expect(
      buildTargetOptions({
        deploys: [{ type: 'manifest', timestamp: 1 }],
        pages: [{ title: 'Draft', latestTxId: '', updatedAt: 2 }],
        uploads: [{ id: 'short', fileName: 'x', timestamp: 3 }],
      }),
    ).toEqual([]);
  });

  it('de-duplicates an id that a page and its deploy both recorded', () => {
    const options = buildTargetOptions({
      deploys: [{ type: 'manifest', manifestId: TX_A, timestamp: 10, appName: 'Deploy' }],
      pages: [{ title: 'Page', latestTxId: TX_A, updatedAt: 20 }],
    });
    expect(options).toHaveLength(1);
    // The newer record wins, so the label matches what they last touched.
    expect(options[0].label).toBe('Page');
  });

  it('ranks a page by its last PUBLISH, not its last edit', () => {
    // `updatedAt` moves every time a draft is touched, while `latestTxId` stays
    // on the last published version. Ranking by it would float a stale id above
    // genuinely newer work.
    const options = buildTargetOptions({
      pages: [
        { title: 'Edited today, published long ago', latestTxId: TX_A,
          updatedAt: 9_000, versions: [{ timestamp: 10 }] },
      ],
      uploads: [{ id: TX_B, fileName: 'newer.png', timestamp: 500 }],
    });
    expect(options.map((o) => o.txId)).toEqual([TX_B, TX_A]);
  });

  it('falls back to updatedAt for a page with no version timestamps', () => {
    const [opt] = buildTargetOptions({
      pages: [{ title: 'Legacy', latestTxId: TX_A, updatedAt: 42, versions: [] }],
    });
    expect(opt.timestamp).toBe(42);
  });

  it('caps the list so the picker never becomes a scroll of history', () => {
    const uploads = Array.from({ length: 20 }, (_, i) => ({
      id: `${'z'.repeat(42)}${i % 10}`,
      fileName: `f${i}`,
      timestamp: i,
    }));
    expect(buildTargetOptions({ uploads, limit: 3 })).toHaveLength(3);
  });

  it('falls back to a generic label rather than rendering a blank row', () => {
    const [opt] = buildTargetOptions({
      deploys: [{ type: 'manifest', manifestId: TX_A, timestamp: 1, appName: '  ' }],
    });
    expect(opt.label).toBe('Site deploy');
  });
});

describe('describeBuyTarget', () => {
  it('names the default without overclaiming which page it is', () => {
    // The tx behind DEFAULT_ARNS_TARGET_TX is titled "ArNS - Ar.io Name
    // System", not ar.io's landing page.
    expect(describeBuyTarget(BLANK_BUY_TARGET)).toBe('Default landing page');
  });

  it('uses the picked item’s own label', () => {
    const options = buildTargetOptions({
      pages: [{ title: 'Links', latestTxId: TX_B, updatedAt: 1 }],
    });
    expect(describeBuyTarget({ mode: 'deployment', txId: TX_B }, options))
      .toBe('Links');
  });

  it('shortens a hand-pasted id it has no label for', () => {
    expect(describeBuyTarget({ mode: 'custom', txId: TX_A })).toBe(shortTxId(TX_A));
  });

  it('dates the summary so two deploys of one site stay distinguishable', () => {
    // Collapsed, this line is the ONLY thing on screen describing the choice.
    // Undated it re-creates the ambiguity the rows were just fixed for.
    const options = buildTargetOptions({
      deploys: [
        { type: 'manifest', manifestId: TX_A, timestamp: NOW - 2 * DAY, appName: 'Checker' },
        { type: 'manifest', manifestId: TX_B, timestamp: NOW - 5 * DAY, appName: 'Checker' },
      ],
    });
    expect(describeBuyTarget({ mode: 'deployment', txId: TX_A }, options, NOW))
      .toBe('Checker · 2d ago');
    expect(describeBuyTarget({ mode: 'deployment', txId: TX_B }, options, NOW))
      .toBe('Checker · 5d ago');
  });

  it('omits the date when the caller gives no clock', () => {
    const options = buildTargetOptions({
      pages: [{ title: 'Links', latestTxId: TX_B, updatedAt: 1, versions: [{ timestamp: 1 }] }],
    });
    expect(describeBuyTarget({ mode: 'deployment', txId: TX_B }, options)).toBe('Links');
  });
});


describe('relativeTime', () => {
  it('reports each scale coarsely', () => {
    expect(relativeTime(NOW - 30_000, NOW)).toBe('just now');
    expect(relativeTime(NOW - 5 * MIN, NOW)).toBe('5m ago');
    expect(relativeTime(NOW - 3 * HOUR, NOW)).toBe('3h ago');
    expect(relativeTime(NOW - 2 * DAY, NOW)).toBe('2d ago');
    expect(relativeTime(NOW - 10 * DAY, NOW)).toBe('1w ago');
    expect(relativeTime(NOW - 60 * DAY, NOW)).toBe('2mo ago');
    expect(relativeTime(NOW - 800 * DAY, NOW)).toBe('2y ago');
  });

  it('says nothing for a missing or future timestamp', () => {
    // A future stamp means clock skew or a restored backup. "in 3 days" on a
    // thing you already published reads as a bug in the row.
    expect(relativeTime(undefined, NOW)).toBeUndefined();
    expect(relativeTime(NOW + DAY, NOW)).toBeUndefined();
    expect(relativeTime(0, NOW)).toBeUndefined();
  });
});

describe('describeOptionMeta', () => {
  it('disambiguates two deploys that share a title', () => {
    // The defect this exists to prevent: deploying the same site twice produced
    // two identical rows, separable only by squinting at a truncated id.
    const [a, b] = buildTargetOptions({
      deploys: [
        { type: 'manifest', manifestId: TX_A, timestamp: NOW - 2 * DAY, appName: 'Checker' },
        { type: 'manifest', manifestId: TX_B, timestamp: NOW - 5 * DAY, appName: 'Checker' },
      ],
    });
    expect(describeOptionMeta(a, NOW)).toBe(`Site · 2d ago · ${shortTxId(TX_A)}`);
    expect(describeOptionMeta(b, NOW)).toBe(`Site · 5d ago · ${shortTxId(TX_B)}`);
  });

  it('drops the date segment rather than rendering it blank', () => {
    const [opt] = buildTargetOptions({
      uploads: [{ id: TX_C, fileName: 'x.png' }],
    });
    expect(describeOptionMeta(opt, NOW)).toBe(`File · ${shortTxId(TX_C)}`);
  });
});

describe('labelForTxId', () => {
  it('names an id the buyer picked from their own work', () => {
    const options = buildTargetOptions({
      deploys: [{ type: 'manifest', manifestId: TX_A, timestamp: 1, appName: 'My Site' }],
    });
    expect(labelForTxId(TX_A, options)).toBe('My Site');
  });

  it('has no name for a hand-pasted id, and does not invent one', () => {
    expect(labelForTxId(TX_B, [])).toBeUndefined();
  });

  it('is undefined when nothing was chosen', () => {
    expect(labelForTxId(undefined, [])).toBeUndefined();
  });
});
