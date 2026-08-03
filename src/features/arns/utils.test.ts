import { describe, expect, it } from 'vitest';

import { isArweaveTxId, parseKeywords } from './utils';

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
