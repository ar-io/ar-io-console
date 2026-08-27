import { describe, expect, it } from 'vitest';

import {
  MAX_CONTROLLERS,
  isArweaveTxId,
  isControllerLimitReached,
  isValidIpfsCid,
  isValidPrimaryName,
  isValidRecordTarget,
  isValidSolanaAddress,
  isValidUndername,
  parseKeywords,
  parsePrimaryName,
  validateNewController,
} from './utils';

describe('isArweaveTxId', () => {
  it('accepts a well-formed 43-char base64url id', () => {
    expect(isArweaveTxId('a'.repeat(43))).toBe(true);
    expect(isArweaveTxId('AbC_-9'.padEnd(43, 'z'))).toBe(true);
  });

  it('rejects wrong length, bad chars, and empty', () => {
    expect(isArweaveTxId('a'.repeat(42))).toBe(false);
    expect(isArweaveTxId('a'.repeat(44))).toBe(false);
    expect(isArweaveTxId('!'.repeat(43))).toBe(false); // '!' not base64url
    expect(isArweaveTxId('')).toBe(false);
    expect(isArweaveTxId(undefined)).toBe(false);
    expect(isArweaveTxId(null)).toBe(false);
  });

  it('trims surrounding whitespace before checking', () => {
    expect(isArweaveTxId(`  ${'b'.repeat(43)}  `)).toBe(true);
  });
});

describe('isValidUndername', () => {
  it('accepts alphanumeric labels with inner - and _', () => {
    expect(isValidUndername('blog')).toBe(true);
    expect(isValidUndername('my-blog')).toBe(true);
    expect(isValidUndername('v2_docs')).toBe(true);
    expect(isValidUndername('2024')).toBe(true);
  });

  it('rejects the apex, empties, over-length, and bad leading chars', () => {
    expect(isValidUndername('@')).toBe(false);
    expect(isValidUndername('')).toBe(false);
    expect(isValidUndername('   ')).toBe(false);
    expect(isValidUndername('-lead')).toBe(false);
    expect(isValidUndername('_lead')).toBe(false);
    expect(isValidUndername('has space')).toBe(false);
    expect(isValidUndername('a'.repeat(62))).toBe(false);
  });
});

describe('isValidIpfsCid', () => {
  it('accepts a CIDv0 (Qm… base58btc, 46 chars)', () => {
    expect(isValidIpfsCid('Qm' + '1'.repeat(44))).toBe(true);
  });

  it('accepts a lowercase base32 CIDv1 (b…)', () => {
    expect(isValidIpfsCid('b' + 'a'.repeat(58))).toBe(true);
  });

  it('trims surrounding whitespace before checking', () => {
    expect(isValidIpfsCid(`  ${'Qm' + '1'.repeat(44)}  `)).toBe(true);
  });

  it('rejects empty, undefined, and null', () => {
    expect(isValidIpfsCid('')).toBe(false);
    expect(isValidIpfsCid(undefined)).toBe(false);
    expect(isValidIpfsCid(null)).toBe(false);
  });

  it('rejects a 43-char Arweave txid and other malformed strings', () => {
    expect(isValidIpfsCid('a'.repeat(43))).toBe(false); // Arweave txid, not a CID
    expect(isValidIpfsCid('Qm' + '1'.repeat(43))).toBe(false); // too short
    expect(isValidIpfsCid('b' + 'a'.repeat(10))).toBe(false); // too short for CIDv1
    expect(isValidIpfsCid('bABCDEF')).toBe(false); // uppercase not base32 lowercase
    expect(isValidIpfsCid('not a cid')).toBe(false);
  });
});

describe('isValidRecordTarget', () => {
  it('uses the Arweave rule for protocol 0', () => {
    expect(isValidRecordTarget('a'.repeat(43), 0)).toBe(true);
    expect(isValidRecordTarget('Qm' + '1'.repeat(44), 0)).toBe(false);
  });

  it('uses the IPFS CID rule for protocol 1', () => {
    expect(isValidRecordTarget('Qm' + '1'.repeat(44), 1)).toBe(true);
    expect(isValidRecordTarget('a'.repeat(43), 1)).toBe(false);
  });
});

describe('parseKeywords', () => {
  it('splits on commas and newlines, trimming each', () => {
    expect(parseKeywords('web3, blog\nportfolio ,  art')).toEqual([
      'web3',
      'blog',
      'portfolio',
      'art',
    ]);
  });

  it('drops empties and de-duplicates case-insensitively, preserving order', () => {
    expect(parseKeywords('Blog, blog, , BLOG, web3')).toEqual(['Blog', 'web3']);
  });

  it('returns an empty array for blank input', () => {
    expect(parseKeywords('')).toEqual([]);
    expect(parseKeywords('  ,  \n ')).toEqual([]);
  });
});

describe('parsePrimaryName', () => {
  it('returns just the base name for an apex name (no label)', () => {
    expect(parsePrimaryName('myname')).toEqual({ baseName: 'myname' });
  });

  it('splits an undername into label + base name', () => {
    expect(parsePrimaryName('blog_myname')).toEqual({
      label: 'blog',
      baseName: 'myname',
    });
  });

  it('splits on the LAST underscore (base names have no underscore; labels may)', () => {
    // The base name never contains an underscore (`isValidArNSName` forbids it),
    // while an undername label may — so `v2_docs_myname` is label `v2_docs`,
    // base `myname`.
    expect(parsePrimaryName('a_b_c')).toEqual({ label: 'a_b', baseName: 'c' });
    expect(parsePrimaryName('v2_docs_myname')).toEqual({
      label: 'v2_docs',
      baseName: 'myname',
    });
  });

  it('trims and lowercases before splitting', () => {
    expect(parsePrimaryName('  Blog_MyName  ')).toEqual({
      label: 'blog',
      baseName: 'myname',
    });
    expect(parsePrimaryName('  MyName  ')).toEqual({ baseName: 'myname' });
  });
});

describe('isValidPrimaryName', () => {
  it('accepts a valid apex name', () => {
    expect(isValidPrimaryName('myname')).toBe(true);
    expect(isValidPrimaryName('my-name-2024')).toBe(true);
  });

  it('accepts a valid undername primary', () => {
    expect(isValidPrimaryName('blog_myname')).toBe(true);
  });

  it('rejects empty, hyphen-leading, and invalid base names', () => {
    expect(isValidPrimaryName('')).toBe(false);
    expect(isValidPrimaryName('-myname')).toBe(false);
    expect(isValidPrimaryName('myname-')).toBe(false);
    expect(isValidPrimaryName('has space')).toBe(false);
  });

  it('rejects an invalid undername label', () => {
    // Leading '-' is not a valid undername label.
    expect(isValidPrimaryName('-blog_myname')).toBe(false);
    // Empty label (leading underscore) → invalid label.
    expect(isValidPrimaryName('_myname')).toBe(false);
  });
});

describe('validateNewController', () => {
  // Four known-valid Solana base58 pubkeys (each decodes to 32 bytes).
  const VALID_A = 'So11111111111111111111111111111111111111112';
  const VALID_B = '4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T';
  const VALID_C = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  const VALID_D = '11111111111111111111111111111111';
  // A full list at the SDK-defined cap (length === MAX_CONTROLLERS). The cap
  // check only counts length, so filler strings past the four named fixtures are
  // fine here.
  const FULL = Array.from({ length: MAX_CONTROLLERS }, (_, i) =>
    [VALID_A, VALID_B, VALID_C, VALID_D][i] ?? `filler-controller-${i}`,
  );

  it('uses fixtures that are actually valid Solana addresses', () => {
    expect(isValidSolanaAddress(VALID_A)).toBe(true);
    expect(isValidSolanaAddress(VALID_B)).toBe(true);
    expect(isValidSolanaAddress(VALID_C)).toBe(true);
    expect(isValidSolanaAddress(VALID_D)).toBe(true);
    expect(FULL).toHaveLength(MAX_CONTROLLERS);
  });

  it('rejects empty or whitespace-only candidates', () => {
    expect(validateNewController('', undefined, [])).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(validateNewController('   ', undefined, [])).toEqual({
      ok: false,
      reason: 'empty',
    });
  });

  it('rejects malformed (non-Solana) addresses', () => {
    expect(validateNewController('not an address', undefined, [])).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(
      validateNewController(
        '0x1234567890123456789012345678901234567890',
        undefined,
        [],
      ),
    ).toEqual({ ok: false, reason: 'invalid' });
    // A 43-char Arweave txId with base64url-only chars (`_`/`-`) is not valid
    // base58, so it is not a valid Solana pubkey.
    expect(
      validateNewController(`${'a'.repeat(41)}_-`, undefined, []),
    ).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects the owner (owner is implicitly a controller)', () => {
    expect(validateNewController(VALID_A, VALID_A, [])).toEqual({
      ok: false,
      reason: 'owner',
    });
  });

  it('rejects an address already in the controllers list', () => {
    expect(validateNewController(VALID_B, VALID_A, [VALID_B])).toEqual({
      ok: false,
      reason: 'duplicate',
    });
  });

  it('accepts a valid address that is neither owner nor a duplicate', () => {
    expect(validateNewController(VALID_B, VALID_A, [])).toEqual({ ok: true });
  });

  it('trims surrounding whitespace before validating', () => {
    expect(validateNewController(`  ${VALID_A}  `, undefined, [])).toEqual({
      ok: true,
    });
  });

  it('compares exactly (case-sensitive), never lowercasing', () => {
    // VALID_B differs by case from itself only trivially; a distinct valid
    // address is not flagged as a duplicate of an existing one.
    expect(validateNewController(VALID_A, undefined, [VALID_B])).toEqual({
      ok: true,
    });
  });

  it('rejects with "max" when the list is already at the controller cap', () => {
    // A brand-new valid address still cannot be added once the list is full.
    const brandNew = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
    expect(isValidSolanaAddress(brandNew)).toBe(true);
    expect(validateNewController(brandNew, VALID_A, FULL)).toEqual({
      ok: false,
      reason: 'max',
    });
  });

  it('returns "max" first — even for owner/duplicate/empty candidates', () => {
    // The cap check runs before every other check, so a full list is "max"
    // regardless of the candidate (the Add form is hidden at the cap anyway).
    expect(validateNewController(VALID_A, VALID_A, FULL)).toEqual({
      ok: false,
      reason: 'max',
    });
    expect(validateNewController(VALID_B, VALID_A, FULL)).toEqual({
      ok: false,
      reason: 'max',
    });
    expect(validateNewController('', VALID_A, FULL)).toEqual({
      ok: false,
      reason: 'max',
    });
  });

  it('still accepts a valid address one below the cap (< not <=)', () => {
    // A list one short of MAX_CONTROLLERS is not yet full, so a valid new
    // address is accepted.
    const oneBelowCap = Array.from(
      { length: MAX_CONTROLLERS - 1 },
      (_, i) => `filler-controller-${i}`,
    );
    expect(validateNewController(VALID_D, VALID_A, oneBelowCap)).toEqual({
      ok: true,
    });
  });
});

describe('MAX_CONTROLLERS / isControllerLimitReached', () => {
  it('caps controllers at 4 (the deployed contract limit, not the stale SDK 10)', () => {
    // The on-chain ario-ant contract enforces 4 (tightened 10→4 2026-05-21);
    // the SDK's exported MAX_CONTROLLERS=10 is stale and must NOT be tracked.
    expect(MAX_CONTROLLERS).toBe(4);
  });

  it('is false below the cap and true at/above it', () => {
    const list = (len: number) =>
      Array.from({ length: len }, (_, i) => `c${i}`);
    expect(isControllerLimitReached([])).toBe(false);
    expect(isControllerLimitReached(list(MAX_CONTROLLERS - 1))).toBe(false);
    expect(isControllerLimitReached(list(MAX_CONTROLLERS))).toBe(true);
    // Defensive: an ANT that somehow exceeded the cap is still reported full.
    expect(isControllerLimitReached(list(MAX_CONTROLLERS + 1))).toBe(true);
  });
});
