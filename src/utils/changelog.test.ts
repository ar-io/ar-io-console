import { describe, expect, it } from 'vitest';

import {
  orderSections,
  parseChangelog,
  parseInline,
} from './changelog';

/** Shaped exactly like the real file, hard wrap included. */
const SAMPLE = `# Changelog

All notable changes to the ar.io Console are documented in this file.

## [4.7.0] - 2026-09-01

### Fixed
- **Renewing returned "not found".** The console was still calling payment
  routes the service has since replaced, so every credits-paid change to a
  name failed outright.

### Added
- **Buying a name no longer needs SOL.** Turbo pays the fees.

## [4.6.0] - 2026-08-28

### Changed
- Something older.
`;

describe('parseChangelog', () => {
  it('reads every release, newest first, as the file orders them', () => {
    const entries = parseChangelog(SAMPLE);
    expect(entries.map((e) => e.version)).toEqual(['4.7.0', '4.6.0']);
    expect(entries[0].date).toBe('2026-09-01');
  });

  it('rejoins hard-wrapped bullets into whole sentences', () => {
    // Entries wrap at ~78 columns in the source; without this every bullet
    // would render as a fragment.
    const fixed = parseChangelog(SAMPLE)[0].sections.find(
      (s) => s.title === 'Fixed',
    )!;
    expect(fixed.items).toHaveLength(1);
    expect(fixed.items[0]).toContain('routes the service has since replaced');
    expect(fixed.items[0]).not.toContain('\n');
  });

  it('keeps sections separate', () => {
    const entry = parseChangelog(SAMPLE)[0];
    expect(entry.sections.map((s) => s.title)).toEqual(['Fixed', 'Added']);
  });

  it('ignores the preamble above the first release', () => {
    expect(parseChangelog(SAMPLE)[0].version).toBe('4.7.0');
  });

  it('never drops a bullet that appears before any section heading', () => {
    // Losing an entry silently is the one failure a changelog cannot afford.
    const entries = parseChangelog('## [1.0.0] - 2026-01-01\n- Orphan note.\n');
    expect(entries[0].sections[0].items).toEqual(['Orphan note.']);
  });

  it('drops a version heading that carried nothing', () => {
    expect(parseChangelog('## [9.9.9] - 2026-01-01\n\n')).toEqual([]);
  });

  it('handles a release with no date', () => {
    const entries = parseChangelog('## [Unreleased]\n\n### Added\n- A thing.\n');
    expect(entries[0].version).toBe('Unreleased');
    expect(entries[0].date).toBeUndefined();
  });

  it('parses the real CHANGELOG shape without losing releases', () => {
    const many = Array.from(
      { length: 24 },
      (_, i) => `## [1.0.${i}] - 2026-01-01\n\n### Added\n- Item ${i}.\n`,
    ).join('\n');
    expect(parseChangelog(many)).toHaveLength(24);
  });
});

describe('orderSections', () => {
  it('reads Added, Changed, Fixed, Removed regardless of file order', () => {
    const ordered = orderSections([
      { title: 'Fixed', items: ['a'] },
      { title: 'Added', items: ['b'] },
      { title: 'Removed', items: ['c'] },
      { title: 'Changed', items: ['d'] },
    ]);
    expect(ordered.map((s) => s.title)).toEqual([
      'Added',
      'Changed',
      'Fixed',
      'Removed',
    ]);
  });

  it('puts an unknown section last rather than dropping it', () => {
    // The file may grow a heading we have not listed.
    const ordered = orderSections([
      { title: 'Security', items: ['a'] },
      { title: 'Added', items: ['b'] },
    ]);
    expect(ordered.map((s) => s.title)).toEqual(['Added', 'Security']);
  });
});

describe('parseInline', () => {
  it('keeps the leading bold sentence that makes entries scannable', () => {
    expect(parseInline('**Big news.** Then detail.')).toEqual([
      { kind: 'strong', value: 'Big news.' },
      { kind: 'text', value: ' Then detail.' },
    ]);
  });

  it('reads inline code', () => {
    expect(parseInline('Use `npm ci` here.')).toEqual([
      { kind: 'text', value: 'Use ' },
      { kind: 'code', value: 'npm ci' },
      { kind: 'text', value: ' here.' },
    ]);
  });

  it('passes plain text through untouched', () => {
    expect(parseInline('Nothing special.')).toEqual([
      { kind: 'text', value: 'Nothing special.' },
    ]);
  });

  it('never loses characters, whatever the mix', () => {
    const src = 'A **b** c `d` e **f**';
    expect(parseInline(src).map((t) => t.value).join('')).toBe(
      'A b c d e f',
    );
  });
});
