import { describe, expect, it } from 'vitest';

import {
  blankRecordFields,
  RecordFieldsState,
  toRecordChange,
  validateRecordFields,
} from './recordFields';

const base = (over: Partial<RecordFieldsState> = {}): RecordFieldsState => ({
  ...blankRecordFields(3600),
  ...over,
});

describe('validateRecordFields', () => {
  it('is invalid with an empty target (a record write needs one)', () => {
    expect(validateRecordFields(base()).allValid).toBe(false);
    expect(validateRecordFields(base()).targetValid).toBe(false);
  });

  it('validates the Arweave target for protocol 0', () => {
    expect(
      validateRecordFields(base({ target: 'a'.repeat(43) })).allValid,
    ).toBe(true);
    // An IPFS CID is not a valid Arweave target.
    expect(
      validateRecordFields(base({ target: 'Qm' + '1'.repeat(44) })).targetValid,
    ).toBe(false);
  });

  it('validates the IPFS target for protocol 1', () => {
    expect(
      validateRecordFields(base({ protocol: 1, target: 'Qm' + '1'.repeat(44) }))
        .allValid,
    ).toBe(true);
    // A 43-char Arweave txid is not a valid CID.
    expect(
      validateRecordFields(base({ protocol: 1, target: 'a'.repeat(43) }))
        .targetValid,
    ).toBe(false);
  });

  it('bounds TTL', () => {
    const v = (ttl: string) =>
      validateRecordFields(base({ target: 'a'.repeat(43), ttl })).ttlValid;
    expect(v('59')).toBe(false);
    expect(v('60')).toBe(true);
    expect(v('2592000')).toBe(true);
    expect(v('2592001')).toBe(false);
    expect(v('12.5')).toBe(false);
  });

  it('accepts blank priority but rejects negative/non-integer', () => {
    const v = (priority: string) =>
      validateRecordFields(base({ target: 'a'.repeat(43), priority }))
        .priorityValid;
    expect(v('')).toBe(true);
    expect(v('0')).toBe(true);
    expect(v('3')).toBe(true);
    expect(v('-1')).toBe(false);
    expect(v('1.5')).toBe(false);
  });

  it('accepts blank logo but rejects a malformed logo txid', () => {
    const v = (logo: string) =>
      validateRecordFields(base({ target: 'a'.repeat(43), logo })).logoValid;
    expect(v('')).toBe(true);
    expect(v('b'.repeat(43))).toBe(true);
    expect(v('too-short')).toBe(false);
    // A pasted TX ID with surrounding whitespace is valid (validated trimmed).
    expect(v(`  ${'b'.repeat(43)}  `)).toBe(true);
  });

  it('caps keywords at 16', () => {
    const many = Array.from({ length: 17 }, (_, i) => `k${i}`).join(', ');
    expect(
      validateRecordFields(base({ target: 'a'.repeat(43), keywordsRaw: many }))
        .keywordsValid,
    ).toBe(false);
  });
});

describe('toRecordChange', () => {
  it('always carries transactionId, ttlSeconds, and targetProtocol', () => {
    const c = toRecordChange(base({ target: 'a'.repeat(43), protocol: 1 }));
    expect(c.transactionId).toBe('a'.repeat(43));
    expect(c.ttlSeconds).toBe(3600);
    expect(c.targetProtocol).toBe(1);
  });

  it('omits priority when blank but sends an explicit 0', () => {
    expect(
      toRecordChange(base({ target: 'a'.repeat(43), priority: '' })).priority,
    ).toBeUndefined();
    expect(
      toRecordChange(base({ target: 'a'.repeat(43), priority: '0' })).priority,
    ).toBe(0);
  });

  it('parses keywords and trims target/logo', () => {
    const c = toRecordChange(
      base({
        target: `  ${'a'.repeat(43)}  `,
        logo: `  ${'b'.repeat(43)}  `,
        keywordsRaw: 'web3, blog, web3',
      }),
    );
    expect(c.transactionId).toBe('a'.repeat(43));
    expect(c.logo).toBe('b'.repeat(43));
    expect(c.keywords).toEqual(['web3', 'blog']);
  });
});
