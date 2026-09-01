import { describe, expect, it } from 'vitest';

import {
  blankRecordFields,
  RecordFieldsState,
  toRecordChange,
  withoutClears,
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

  it('omits a blank logo rather than sending an empty string', () => {
    // The ANT program validates logo as a 43-char Arweave address and rejects
    // '' with AnchorError 6021 (InvalidLogo). Sending it broke every record
    // write made without a logo, AFTER SetRecord had already succeeded.
    const c = toRecordChange(base({ target: 'a'.repeat(43), logo: '' }));
    expect('logo' in c).toBe(false);

    // Whitespace-only is still blank.
    expect('logo' in toRecordChange(base({ target: 'a'.repeat(43), logo: '   ' }))).toBe(false);

    // A real logo is still sent.
    expect(
      toRecordChange(base({ target: 'a'.repeat(43), logo: 'b'.repeat(43) })).logo,
    ).toBe('b'.repeat(43));
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

describe('toRecordChange — tri-state metadata', () => {
  const loaded: RecordFieldsState = {
    target: 'a'.repeat(43),
    protocol: 0,
    ttl: '3600',
    priority: '',
    displayName: 'My Blog',
    logo: 'b'.repeat(43),
    description: 'notes and links',
    keywordsRaw: 'arweave, ar-io',
  };

  it('omits every field the user did not touch', () => {
    // The three states are distinct authorizations, so resending an unchanged
    // value asks to write something the user never opened.
    const out = toRecordChange({ ...loaded }, loaded);
    expect(out).not.toHaveProperty('displayName');
    expect(out).not.toHaveProperty('logo');
    expect(out).not.toHaveProperty('description');
    expect(out).not.toHaveProperty('keywords');
  });

  it('sends null — never empty string — for a field the user cleared', () => {
    const out = toRecordChange(
      { ...loaded, displayName: '', description: '', keywordsRaw: '' },
      loaded,
    );
    expect(out.displayName).toBeNull();
    expect(out.description).toBeNull();
    expect(out.keywords).toBeNull();
  });

  it('sends the new value when a field is edited', () => {
    const out = toRecordChange({ ...loaded, displayName: 'Renamed' }, loaded);
    expect(out.displayName).toBe('Renamed');
    // Untouched siblings stay out of the request entirely.
    expect(out).not.toHaveProperty('description');
  });

  it('can finally clear a logo, which omit-when-blank made impossible', () => {
    const out = toRecordChange({ ...loaded, logo: '' }, loaded);
    expect(out.logo).toBeNull();
  });

  it('never sends an empty string as a logo', () => {
    // The ANT program rejects '' as InvalidLogo (6021) — and did so AFTER the
    // target had already saved, leaving the record half-written.
    for (const s of [
      { ...loaded, logo: '' },
      { ...loaded, logo: '   ' },
    ]) {
      expect(toRecordChange(s, loaded).logo).not.toBe('');
    }
  });

  it('omits blank fields on a NEW record, where nothing exists to clear', () => {
    const fresh: RecordFieldsState = {
      target: 'c'.repeat(43),
      protocol: 0,
      ttl: '600',
      priority: '',
      displayName: '',
      logo: '',
      description: '',
      keywordsRaw: '',
    };
    const out = toRecordChange(fresh);
    expect(out).not.toHaveProperty('displayName');
    expect(out).not.toHaveProperty('logo');
    expect(out).not.toHaveProperty('keywords');
    expect(out.transactionId).toBe('c'.repeat(43));
  });

  it('sets fields supplied on a new record', () => {
    const out = toRecordChange({
      target: 'c'.repeat(43),
      protocol: 0,
      ttl: '600',
      priority: '',
      displayName: 'Docs',
      logo: '',
      description: '',
      keywordsRaw: 'a, b',
    });
    expect(out.displayName).toBe('Docs');
    expect(out.keywords).toEqual(['a', 'b']);
  });

  it('does not write when only whitespace around keywords changed', () => {
    // Compared as parsed lists, so a cosmetic edit costs no approval.
    const out = toRecordChange({ ...loaded, keywordsRaw: ' arweave ,ar-io ' }, loaded);
    expect(out).not.toHaveProperty('keywords');
  });
});

describe('withoutClears', () => {
  const base = {
    transactionId: 'a'.repeat(43),
    ttlSeconds: 600,
    targetProtocol: 0,
  };

  it('drops a clear, since the ANT write cannot express one', () => {
    const out = withoutClears({
      ...base,
      displayName: null,
      logo: null,
      description: null,
      keywords: null,
    });
    expect(out).not.toHaveProperty('displayName');
    expect(out).not.toHaveProperty('logo');
    expect(out).not.toHaveProperty('description');
    expect(out).not.toHaveProperty('keywords');
  });

  it('keeps real values, including deliberately empty text', () => {
    const out = withoutClears({ ...base, displayName: '', description: 'x' });
    expect(out.displayName).toBe('');
    expect(out.description).toBe('x');
  });

  it('keeps an empty keyword list, which is a value not a clear', () => {
    expect(withoutClears({ ...base, keywords: [] }).keywords).toEqual([]);
  });

  it('leaves the non-metadata fields alone', () => {
    const out = withoutClears({ ...base, priority: 3, displayName: null });
    expect(out).toMatchObject({ ...base, priority: 3 });
  });
});
