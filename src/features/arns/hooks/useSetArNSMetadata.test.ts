import { describe, expect, it, vi } from 'vitest';

import { buildMetadataOps, ArNSMetadataChanges } from './useSetArNSMetadata';

describe('buildMetadataOps', () => {
  it('returns no ops for an empty diff', () => {
    expect(buildMetadataOps({})).toEqual([]);
  });

  it('emits one op per changed field, in a fixed order', () => {
    const changes: ArNSMetadataChanges = {
      logo: 'a'.repeat(43),
      name: 'My Blog',
      baseRecord: { transactionId: 'b'.repeat(43), ttlSeconds: 3600 },
      ticker: 'BLOG',
      keywords: ['web3'],
      description: 'hi',
    };
    const labels = buildMetadataOps(changes).map((o) => o.label);
    expect(labels).toEqual([
      'Nickname',
      'Ticker',
      'Description',
      'Keywords',
      'Logo',
      'Target',
    ]);
  });

  it('only includes fields present in the diff', () => {
    const labels = buildMetadataOps({ description: 'x', keywords: [] }).map(
      (o) => o.label,
    );
    expect(labels).toEqual(['Description', 'Keywords']);
  });

  it('routes each op to the matching ANT setter with the right args', async () => {
    const ant = {
      setName: vi.fn().mockResolvedValue({ id: '1' }),
      setTicker: vi.fn().mockResolvedValue({ id: '2' }),
      setDescription: vi.fn().mockResolvedValue({ id: '3' }),
      setKeywords: vi.fn().mockResolvedValue({ id: '4' }),
      setLogo: vi.fn().mockResolvedValue({ id: '5' }),
      setBaseNameRecord: vi.fn().mockResolvedValue({ id: '6' }),
    };
    const base = { transactionId: 'c'.repeat(43), ttlSeconds: 900 };
    const ops = buildMetadataOps({
      name: 'N',
      ticker: 'T',
      description: 'D',
      keywords: ['k1', 'k2'],
      logo: 'd'.repeat(43),
      baseRecord: base,
    });
    for (const op of ops) await op.run(ant as never);

    expect(ant.setName).toHaveBeenCalledWith({ name: 'N' });
    expect(ant.setTicker).toHaveBeenCalledWith({ ticker: 'T' });
    expect(ant.setDescription).toHaveBeenCalledWith({ description: 'D' });
    expect(ant.setKeywords).toHaveBeenCalledWith({ keywords: ['k1', 'k2'] });
    expect(ant.setLogo).toHaveBeenCalledWith({ txId: 'd'.repeat(43) });
    expect(ant.setBaseNameRecord).toHaveBeenCalledWith(base);
  });

  it('treats a falsy-but-present field (empty string, empty array) as a change', () => {
    // Clearing description to '' must still emit a write, so `undefined`
    // (untouched) and `''` (cleared) are distinguished.
    expect(buildMetadataOps({ description: '' }).map((o) => o.label)).toEqual([
      'Description',
    ]);
    expect(buildMetadataOps({ keywords: [] }).map((o) => o.label)).toEqual([
      'Keywords',
    ]);
  });
});
