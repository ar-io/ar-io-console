import { describe, expect, it } from 'vitest';
import {
  MAX_TIER_CHAR_LENGTH,
  bucketCharacterLength,
  findTierIndexForLength,
  formatTierCharacterLabel,
} from './arnsPriceTable';

describe('bucketCharacterLength', () => {
  it('maps 1..12 to themselves', () => {
    expect(bucketCharacterLength(1)).toBe(1);
    expect(bucketCharacterLength(3)).toBe(3);
    expect(bucketCharacterLength(12)).toBe(12);
  });

  it('collapses anything above 12 into the 13+ bucket', () => {
    expect(bucketCharacterLength(13)).toBe(13);
    expect(bucketCharacterLength(14)).toBe(13);
    expect(bucketCharacterLength(51)).toBe(13);
  });

  it('returns 0 for non-positive lengths', () => {
    expect(bucketCharacterLength(0)).toBe(0);
    expect(bucketCharacterLength(-5)).toBe(0);
  });

  it('returns 0 for non-finite lengths', () => {
    expect(bucketCharacterLength(NaN)).toBe(0);
    expect(bucketCharacterLength(Infinity)).toBe(0);
    expect(bucketCharacterLength(-Infinity)).toBe(0);
  });

  it('floors fractional lengths', () => {
    expect(bucketCharacterLength(4.7)).toBe(4);
    expect(bucketCharacterLength(12.9)).toBe(12);
    expect(bucketCharacterLength(12.0001)).toBe(12);
  });

  it('exposes MAX_TIER_CHAR_LENGTH as 12', () => {
    expect(MAX_TIER_CHAR_LENGTH).toBe(12);
  });
});

describe('findTierIndexForLength', () => {
  const tiers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

  it('finds the direct index for a dedicated tier length', () => {
    expect(findTierIndexForLength(3, tiers)).toBe(2);
    expect(findTierIndexForLength(12, tiers)).toBe(11);
  });

  it('maps the 13+ bucket to the collapsed tier index', () => {
    expect(findTierIndexForLength(13, tiers)).toBe(12);
    expect(findTierIndexForLength(20, tiers)).toBe(12);
  });

  it('returns -1 for an invalid length', () => {
    expect(findTierIndexForLength(0, tiers)).toBe(-1);
    expect(findTierIndexForLength(NaN, tiers)).toBe(-1);
  });

  it('returns -1 when the bucket is absent from the tier list', () => {
    expect(findTierIndexForLength(5, [1, 2, 13])).toBe(-1);
  });
});

describe('formatTierCharacterLabel', () => {
  it('renders numeric lengths as-is', () => {
    expect(formatTierCharacterLabel(1)).toBe('1');
    expect(formatTierCharacterLabel(12)).toBe('12');
  });

  it('renders the collapsed tier as "13+"', () => {
    expect(formatTierCharacterLabel(13)).toBe('13+');
  });
});
