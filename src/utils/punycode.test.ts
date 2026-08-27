import { describe, it, expect } from 'vitest';
import { toUnicodeName } from './punycode';

describe('toUnicodeName', () => {
  it('decodes xn-- labels to Unicode', () => {
    expect(toUnicodeName('xn--maana-pta')).toBe('mañana');
    expect(toUnicodeName('xn--bcher-kva')).toBe('bücher');
    expect(toUnicodeName('xn--caf-dma')).toBe('café');
    expect(toUnicodeName('xn--ls8h')).toBe('💩'); // emoji names are real on ArNS
  });

  it('is case-insensitive on the xn-- prefix', () => {
    expect(toUnicodeName('XN--ls8h')).toBe('💩');
  });

  it('passes plain ASCII names through unchanged', () => {
    expect(toUnicodeName('my-blog')).toBe('my-blog');
    expect(toUnicodeName('hackernoon')).toBe('hackernoon');
  });

  it('decodes each label independently', () => {
    expect(toUnicodeName('xn--ls8h.example')).toBe('💩.example');
  });

  it('falls back to the original string on malformed input', () => {
    expect(toUnicodeName('xn--…broken')).toBe('xn--…broken');
  });
});
