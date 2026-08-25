import { describe, expect, it, vi } from 'vitest';

import { antRecordWriter, turboRecordWriter } from './writers';

const rec = { undername: 'blog', transactionId: 'a'.repeat(43), ttlSeconds: 3600 };

function fakeAnt() {
  return {
    setUndernameRecord: vi.fn().mockResolvedValue({ id: 'u1' }),
    removeUndernameRecord: vi.fn().mockResolvedValue({ id: 'u2' }),
    setBaseNameRecord: vi.fn().mockResolvedValue({ id: 'b1' }),
  };
}
function fakeTurbo() {
  return {
    setArNSRecord: vi.fn().mockResolvedValue({ messageId: 't1' }),
    removeArNSRecord: vi.fn().mockResolvedValue({ messageId: 't2' }),
  };
}

describe('antRecordWriter', () => {
  it('routes the apex to setBaseNameRecord, not setUndernameRecord', () => {
    // The ANT client splits these; Turbo does not. Getting it wrong writes an
    // undername literally called "@".
    const ant = fakeAnt();
    void antRecordWriter(ant).setRecord({ ...rec, undername: '@' });
    expect(ant.setBaseNameRecord).toHaveBeenCalledWith({
      transactionId: rec.transactionId,
      ttlSeconds: rec.ttlSeconds,
    });
    expect(ant.setUndernameRecord).not.toHaveBeenCalled();
  });

  it('routes a label to setUndernameRecord', async () => {
    const ant = fakeAnt();
    await expect(antRecordWriter(ant).setRecord(rec)).resolves.toEqual({ id: 'u1' });
    expect(ant.setUndernameRecord).toHaveBeenCalledWith(rec);
  });

  it('refuses to remove the apex record', async () => {
    // Deleting it stops the name resolving at all — there is no ANT method for
    // it and it would not be a recoverable mistake.
    const ant = fakeAnt();
    await expect(
      antRecordWriter(ant).removeRecord({ undername: '@' }),
    ).rejects.toThrow(/cannot be removed/i);
    expect(ant.removeUndernameRecord).not.toHaveBeenCalled();
  });
});

describe('turboRecordWriter', () => {
  it('passes the apex through as a normal undername', async () => {
    const turbo = fakeTurbo();
    await turboRecordWriter('ant-1', turbo).setRecord({ ...rec, undername: '@' });
    expect(turbo.setArNSRecord).toHaveBeenCalledWith({
      antId: 'ant-1', undername: '@',
      transactionId: rec.transactionId, ttlSeconds: rec.ttlSeconds,
    });
  });

  it('normalises messageId to the shared id shape', async () => {
    const turbo = fakeTurbo();
    const w = turboRecordWriter('ant-1', turbo);
    await expect(w.setRecord(rec)).resolves.toEqual({ id: 't1' });
    await expect(w.removeRecord({ undername: 'blog' })).resolves.toEqual({ id: 't2' });
  });

  it('fails fast on an empty antId instead of sending a doomed request', async () => {
    const turbo = fakeTurbo();
    const w = turboRecordWriter('', turbo);
    await expect(w.setRecord(rec)).rejects.toThrow(/no ANT on record/i);
    await expect(w.removeRecord({ undername: 'blog' })).rejects.toThrow(/no ANT on record/i);
    expect(turbo.setArNSRecord).not.toHaveBeenCalled();
    expect(turbo.removeArNSRecord).not.toHaveBeenCalled();
  });
});
