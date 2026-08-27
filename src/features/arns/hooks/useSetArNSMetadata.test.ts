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
      baseRecord: {
        transactionId: 'b'.repeat(43),
        ttlSeconds: 3600,
        targetProtocol: 0,
      },
      baseRecordOwner: 'z'.repeat(43),
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
      'Record owner',
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
      transferRecord: vi.fn().mockResolvedValue({ id: '7' }),
    };
    const base = { transactionId: 'c'.repeat(43), ttlSeconds: 900, targetProtocol: 0 };
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
    expect(ant.transferRecord).not.toHaveBeenCalled();
  });

  it('passes the ENTIRE base record param set to setBaseNameRecord and no owner', async () => {
    const ant = { setBaseNameRecord: vi.fn().mockResolvedValue({ id: '1' }) };
    const base = {
      transactionId: 'c'.repeat(43),
      ttlSeconds: 900,
      targetProtocol: 1,
      priority: 2,
      displayName: 'Home',
      logo: 'e'.repeat(43),
      description: 'the record',
      keywords: ['a', 'b'],
    };
    const ops = buildMetadataOps({ baseRecord: base });
    expect(ops.map((o) => o.label)).toEqual(['Target']);
    await ops[0].run(ant as never);
    expect(ant.setBaseNameRecord).toHaveBeenCalledWith(base);
    // Ownership is never bundled into the record write.
    expect((base as Record<string, unknown>).owner).toBeUndefined();
  });

  it('emits a Record owner op that calls transferRecord for the base @ record', async () => {
    const ant = {
      transferRecord: vi.fn().mockResolvedValue({ id: '1' }),
      setBaseNameRecord: vi.fn().mockResolvedValue({ id: '2' }),
    };
    const ops = buildMetadataOps({ baseRecordOwner: 'z'.repeat(43) });
    expect(ops.map((o) => o.label)).toEqual(['Record owner']);
    await ops[0].run(ant as never);
    expect(ant.transferRecord).toHaveBeenCalledWith({
      undername: '@',
      recipient: 'z'.repeat(43),
    });
    expect(ant.setBaseNameRecord).not.toHaveBeenCalled();
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
