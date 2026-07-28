import { describe, it, expect } from 'vitest';
import { formatUnitsExact } from './formatUnits';

describe('formatUnitsExact', () => {
  it('formats common amounts and trims trailing zeros', () => {
    expect(formatUnitsExact('500000000000000000', 18)).toBe('0.5'); // 0.5 ETH
    expect(formatUnitsExact('1000000000000000000', 18)).toBe('1'); // 1 ETH
    expect(formatUnitsExact('1000000', 6)).toBe('1'); // 1 ARIO/USDC
    expect(formatUnitsExact('1500000', 6)).toBe('1.5');
    expect(formatUnitsExact('1', 6)).toBe('0.000001');
    expect(formatUnitsExact('0', 18)).toBe('0');
  });

  it('preserves precision that Number() would lose (the whole point)', () => {
    // 0.500000000000000001 ETH — one wei above 0.5. Number(5e17 + 1)/1e18 rounds to 0.5.
    expect(formatUnitsExact('500000000000000001', 18)).toBe('0.500000000000000001');
    // Verify the float path really does lose it, so this test is meaningful.
    expect(Number('500000000000000001') / 1e18).toBe(0.5);
  });

  it('caps fractional digits by truncation when asked (for compact display)', () => {
    expect(formatUnitsExact('123456789012345678', 18, 6)).toBe('0.123456');
    expect(formatUnitsExact('123456789012345678', 18)).toBe('0.123456789012345678');
    expect(formatUnitsExact('1500000', 6, 6)).toBe('1.5'); // cap doesn't add zeros
  });

  it('handles zero-decimal tokens and negatives', () => {
    expect(formatUnitsExact('42', 0)).toBe('42');
    expect(formatUnitsExact('-1500000', 6)).toBe('-1.5');
  });

  it('returns null for non-integer input', () => {
    expect(formatUnitsExact('1.5', 6)).toBeNull();
    expect(formatUnitsExact('abc', 6)).toBeNull();
    expect(formatUnitsExact('', 6)).toBeNull();
  });

  it('throws on invalid config (decimals / maxFractionDigits)', () => {
    expect(() => formatUnitsExact('1', -1)).toThrow(RangeError);
    expect(() => formatUnitsExact('1', 1.5)).toThrow(RangeError);
    expect(() => formatUnitsExact('1', 6, -1)).toThrow(RangeError);
    expect(() => formatUnitsExact('1', 6, 2.5)).toThrow(RangeError);
  });
});
