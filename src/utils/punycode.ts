/**
 * Punycode decoding for ArNS names — pure, dependency-free, and node-testable.
 *
 * ArNS stores internationalized names in their ASCII `xn--` (punycode) form. The
 * browser's URL/hostname APIs do NOT decode `xn--` back to Unicode, so we decode
 * it ourselves (RFC 3492) for display. Decoding is best-effort: malformed input
 * falls back to the original string rather than throwing.
 */

const MAX_INT = 2147483647;
const BASE = 36;
const T_MIN = 1;
const T_MAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;
const DELIMITER = '-';

/** Map a basic code point (0-9, A-Z, a-z) to its digit value, or BASE if invalid. */
function basicToDigit(codePoint: number): number {
  if (codePoint >= 0x30 && codePoint < 0x3a) return 26 + (codePoint - 0x30); // 0-9 → 26..35
  if (codePoint >= 0x41 && codePoint < 0x5b) return codePoint - 0x41; // A-Z → 0..25
  if (codePoint >= 0x61 && codePoint < 0x7b) return codePoint - 0x61; // a-z → 0..25
  return BASE;
}

function adapt(delta: number, numPoints: number, firstTime: boolean): number {
  let k = 0;
  delta = firstTime ? Math.floor(delta / DAMP) : delta >> 1;
  delta += Math.floor(delta / numPoints);
  for (; delta > ((BASE - T_MIN) * T_MAX) >> 1; k += BASE) {
    delta = Math.floor(delta / (BASE - T_MIN));
  }
  return Math.floor(k + ((BASE - T_MIN + 1) * delta) / (delta + SKEW));
}

/** Decode a punycode string (the part after `xn--`) to its Unicode form. */
function decode(input: string): string {
  const output: number[] = [];
  const inputLength = input.length;
  let i = 0;
  let n = INITIAL_N;
  let bias = INITIAL_BIAS;

  let basic = input.lastIndexOf(DELIMITER);
  if (basic < 0) basic = 0;

  for (let j = 0; j < basic; ++j) {
    if (input.charCodeAt(j) >= 0x80) throw new RangeError('not-basic');
    output.push(input.charCodeAt(j));
  }

  for (let index = basic > 0 ? basic + 1 : 0; index < inputLength; ) {
    const oldi = i;
    for (let w = 1, k = BASE; ; k += BASE) {
      if (index >= inputLength) throw new RangeError('invalid-input');
      const digit = basicToDigit(input.charCodeAt(index++));
      if (digit >= BASE || digit > Math.floor((MAX_INT - i) / w)) {
        throw new RangeError('invalid-input');
      }
      i += digit * w;
      const t = k <= bias ? T_MIN : k >= bias + T_MAX ? T_MAX : k - bias;
      if (digit < t) break;
      const baseMinusT = BASE - t;
      if (w > Math.floor(MAX_INT / baseMinusT)) throw new RangeError('overflow');
      w *= baseMinusT;
    }

    const out = output.length + 1;
    bias = adapt(i - oldi, out, oldi === 0);
    if (Math.floor(i / out) > MAX_INT - n) throw new RangeError('overflow');
    n += Math.floor(i / out);
    i %= out;
    output.splice(i++, 0, n);
  }

  return String.fromCodePoint(...output);
}

/**
 * Decode an ArNS name for display: any `xn--` label is converted to Unicode, the
 * rest is passed through unchanged. Best-effort — returns the input on failure.
 */
export function toUnicodeName(name: string): string {
  try {
    return name
      .split('.')
      .map((label) => (label.toLowerCase().startsWith('xn--') ? decode(label.slice(4)) : label))
      .join('.');
  } catch {
    return name;
  }
}
