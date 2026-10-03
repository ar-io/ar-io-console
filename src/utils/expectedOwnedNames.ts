/**
 * Names a wallet has just bought, which its "your names" list must include.
 *
 * Turbo reports a bought name on chain about 3 seconds after `/sign` returns,
 * but a list read in that gap comes back without it. Cached, that stale list
 * stood in for the real one for hours, and a buyer was told "No domains yet"
 * for a name they had paid for. So a read that is missing an expected name is
 * not cached, and is read again shortly.
 */
export interface ExpectedOwnedName {
  address: string;
  name: string;
  /** Epoch ms after which the name is no longer waited for. */
  until: number;
}

/**
 * The expected names still missing from a fresh read for `address`. Expired
 * expectations are ignored; names compare case-insensitively, since ArNS
 * names are stored lower case.
 */
export function missingExpectedNames(
  expected: readonly ExpectedOwnedName[],
  address: string,
  names: readonly { name: string }[],
  now: number,
): ExpectedOwnedName[] {
  const held = new Set(names.map((n) => n.name.toLowerCase()));
  return expected.filter(
    (e) =>
      e.address === address &&
      e.until > now &&
      !held.has(e.name.toLowerCase()),
  );
}

/**
 * Expectations for `address` that ran out without the name ever appearing.
 * The read that finds them is cached briefly rather than for six hours: an
 * index lagging past the window must not bring the original symptom back.
 */
export function expiredUnmetNames(
  expected: readonly ExpectedOwnedName[],
  address: string,
  names: readonly { name: string }[],
  now: number,
): ExpectedOwnedName[] {
  const held = new Set(names.map((n) => n.name.toLowerCase()));
  return expected.filter(
    (e) => e.address === address && e.until <= now && !held.has(e.name.toLowerCase()),
  );
}

/** How long to wait before reading the list again while a name is missing. */
export const EXPECTED_NAME_RETRY_MS = 3_000;

/** Freshness for a list read after an expected name ran out unmet. */
export const UNMET_EXPECTATION_TTL_MS = 5 * 60 * 1000;
