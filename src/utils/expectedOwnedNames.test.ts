import { describe, expect, it } from 'vitest';

import { missingExpectedNames } from './expectedOwnedNames';

const A = 'OwnerAddress111';
const now = 1_000_000;

describe('missingExpectedNames', () => {
  it('reports a just-bought name the read does not include yet', () => {
    const expected = [{ address: A, name: 'nnn270', until: now + 60_000 }];
    expect(missingExpectedNames(expected, A, [], now)).toEqual(expected);
  });

  it('is satisfied once the name appears, whatever its case', () => {
    const expected = [{ address: A, name: 'nnn270', until: now + 60_000 }];
    expect(missingExpectedNames(expected, A, [{ name: 'NNN270' }], now)).toEqual([]);
  });

  it('ignores another wallet, and an expectation that has run out', () => {
    expect(
      missingExpectedNames(
        [
          { address: 'Someone', name: 'x', until: now + 60_000 },
          { address: A, name: 'y', until: now - 1 },
        ],
        A,
        [],
        now,
      ),
    ).toEqual([]);
  });
});
