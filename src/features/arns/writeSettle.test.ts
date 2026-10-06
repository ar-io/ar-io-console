import { describe, expect, it } from 'vitest';

import {
  SETTLE_DELAYS_MS,
  apexReflects,
  applyApexWrite,
  applyControllerWrite,
  applyRecordWrite,
  controllersReflect,
  nextSettleStep,
  recordsReflect,
  type RecordWrite,
} from './writeSettle';
import type { UndernameRecord } from './hooks/useUndernames';
import type { ANTDetails } from './hooks/useANTDetails';

const rec = (undername: string, transactionId: string, extra: Partial<UndernameRecord> = {}): UndernameRecord => ({
  undername,
  transactionId,
  ttlSeconds: 3600,
  targetProtocol: 0,
  ...extra,
});

const set = (undername: string, transactionId: string, ttlSeconds = 3600): RecordWrite => ({
  kind: 'set',
  undername,
  change: { transactionId, ttlSeconds, targetProtocol: 0 },
});

describe('SETTLE_DELAYS_MS', () => {
  it('is a short, bounded, increasing schedule', () => {
    expect(SETTLE_DELAYS_MS.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < SETTLE_DELAYS_MS.length; i++) {
      expect(SETTLE_DELAYS_MS[i]).toBeGreaterThan(SETTLE_DELAYS_MS[i - 1]);
    }
    expect(SETTLE_DELAYS_MS[0]).toBeGreaterThanOrEqual(1_000);
  });
});

describe('recordsReflect', () => {
  it('needs the undername with the written target and TTL', () => {
    const w = set('docs', 'TX1', 900);
    expect(recordsReflect([rec('docs', 'TX1', { ttlSeconds: 900 })], w)).toBe(true);
    expect(recordsReflect([rec('docs', 'TX0', { ttlSeconds: 900 })], w)).toBe(false);
    expect(recordsReflect([rec('docs', 'TX1', { ttlSeconds: 3600 })], w)).toBe(false);
    expect(recordsReflect([], w)).toBe(false);
    expect(recordsReflect(undefined, w)).toBe(false);
  });

  it('matches undernames case-insensitively', () => {
    expect(recordsReflect([rec('docs', 'TX1')], set('Docs', 'TX1'))).toBe(true);
    expect(recordsReflect([rec('docs', 'TX1')], { kind: 'remove', undername: 'DOCS' })).toBe(false);
  });

  it('a removal is reflected once the undername is gone', () => {
    const w: RecordWrite = { kind: 'remove', undername: 'old' };
    expect(recordsReflect([rec('old', 'TX')], w)).toBe(false);
    expect(recordsReflect([rec('new', 'TX')], w)).toBe(true);
    expect(recordsReflect([], w)).toBe(true);
    // Unknown is not "gone": nothing was read.
    expect(recordsReflect(undefined, w)).toBe(false);
  });
});

describe('applyRecordWrite', () => {
  it('appends a new record, which sorts last like a fresh on-chain index', () => {
    const out = applyRecordWrite([rec('a', 'T1')], set('b', 'T2'));
    expect(out?.map((r) => r.undername)).toEqual(['a', 'b']);
    expect(out?.[1]).toMatchObject({ transactionId: 'T2', ttlSeconds: 3600 });
  });

  it('updates an existing record in place and keeps untouched metadata', () => {
    const before = [rec('a', 'T1', { displayName: 'A', description: 'keep' }), rec('b', 'T2')];
    const out = applyRecordWrite(before, {
      kind: 'set',
      undername: 'a',
      change: { transactionId: 'T9', ttlSeconds: 60, targetProtocol: 0, displayName: 'New' },
    });
    expect(out?.map((r) => r.undername)).toEqual(['a', 'b']);
    expect(out?.[0]).toMatchObject({ transactionId: 'T9', ttlSeconds: 60, displayName: 'New', description: 'keep' });
  });

  it('removes a record', () => {
    const out = applyRecordWrite([rec('a', 'T1'), rec('b', 'T2')], { kind: 'remove', undername: 'a' });
    expect(out?.map((r) => r.undername)).toEqual(['b']);
  });

  it('leaves an unloaded list alone', () => {
    expect(applyRecordWrite(undefined, set('a', 'T'))).toBeUndefined();
  });

  it('is already reflected after applying', () => {
    const w = set('x', 'T');
    expect(recordsReflect(applyRecordWrite([], w), w)).toBe(true);
    const r: RecordWrite = { kind: 'remove', undername: 'x' };
    expect(recordsReflect(applyRecordWrite([rec('x', 'T')], r), r)).toBe(true);
  });
});

describe('apex', () => {
  const ant: ANTDetails = { name: 'n', ticker: 't', description: '', keywords: [], logo: '', target: 'OLD', ttlSeconds: 3600 };

  it('reflects the written target and TTL', () => {
    const w = set('@', 'NEW', 900);
    expect(apexReflects(ant, w)).toBe(false);
    expect(apexReflects({ ...ant, target: 'NEW', ttlSeconds: 900 }, w)).toBe(true);
    expect(apexReflects(undefined, w)).toBe(false);
  });

  it('applies the write to the base record fields only', () => {
    const out = applyApexWrite(ant, {
      kind: 'set',
      undername: '@',
      change: { transactionId: 'NEW', ttlSeconds: 900, targetProtocol: 1, description: 'apex desc' },
    });
    expect(out).toMatchObject({ target: 'NEW', ttlSeconds: 900, targetProtocol: 1, recordDescription: 'apex desc', description: '' });
  });
});

describe('controllers', () => {
  const state = { owner: 'O', controllers: ['A', 'B'] };

  it('reflects an add once present and a remove once absent', () => {
    expect(controllersReflect(state, { kind: 'add', address: 'C' })).toBe(false);
    expect(controllersReflect({ ...state, controllers: ['A', 'B', 'C'] }, { kind: 'add', address: 'C' })).toBe(true);
    expect(controllersReflect(state, { kind: 'remove', address: 'A' })).toBe(false);
    expect(controllersReflect({ ...state, controllers: ['B'] }, { kind: 'remove', address: 'A' })).toBe(true);
    expect(controllersReflect(undefined, { kind: 'remove', address: 'A' })).toBe(false);
  });

  it('applies adds and removes without duplicates', () => {
    expect(applyControllerWrite(state, { kind: 'add', address: 'C' })?.controllers).toEqual(['A', 'B', 'C']);
    expect(applyControllerWrite(state, { kind: 'add', address: 'A' })?.controllers).toEqual(['A', 'B']);
    expect(applyControllerWrite(state, { kind: 'remove', address: 'A' })?.controllers).toEqual(['B']);
    expect(applyControllerWrite(undefined, { kind: 'add', address: 'C' })).toBeUndefined();
  });
});

describe('nextSettleStep', () => {
  const last = SETTLE_DELAYS_MS.length - 1;

  it('stops on the first read that reflects the write', () => {
    expect(nextSettleStep({ attempt: 0, reflected: true, readFailed: false })).toBe('accept');
  });

  it('keeps the local change while attempts remain', () => {
    expect(nextSettleStep({ attempt: 0, reflected: false, readFailed: false })).toBe('retry');
    expect(nextSettleStep({ attempt: 0, reflected: false, readFailed: true })).toBe('retry');
  });

  it('accepts the chain on the last attempt', () => {
    expect(nextSettleStep({ attempt: last, reflected: false, readFailed: false })).toBe('accept');
  });

  it('gives up quietly when the last read fails', () => {
    expect(nextSettleStep({ attempt: last, reflected: false, readFailed: true })).toBe('give-up');
  });
});
