/**
 * Pure form-state helpers for a single ANT record (base `@` or an undername),
 * shared by `RecordFieldsEditor` and both editor modals. Kept out of the
 * component file so it stays node-testable and free of React-refresh coupling.
 *
 * State mirrors `ANTSetBaseNameRecordParams` minus the ownership fields
 * (ownership is a separate transfer flow). All values are held as strings for
 * editing; `toRecordChange` converts a state into the SDK param shape.
 */
import {
  isArweaveTxId,
  isValidRecordTarget,
  MAX_KEYWORDS,
  MAX_TTL,
  MIN_TTL,
  parseKeywords,
  TARGET_PROTOCOL,
} from './utils';

export interface RecordFieldsState {
  target: string;
  /** 0 = Arweave, 1 = IPFS. */
  protocol: number;
  ttl: string;
  // Advanced (collapsed by default in the editor).
  priority: string;
  displayName: string;
  logo: string;
  description: string;
  keywordsRaw: string;
}

/** A blank record editor state seeded with a default TTL. */
export function blankRecordFields(defaultTtl: number): RecordFieldsState {
  return {
    target: '',
    protocol: TARGET_PROTOCOL.arweave,
    ttl: String(defaultTtl),
    priority: '',
    displayName: '',
    logo: '',
    description: '',
    keywordsRaw: '',
  };
}

/** Per-field validity of a record editor state. */
export interface RecordFieldsValidity {
  targetValid: boolean;
  ttlValid: boolean;
  priorityValid: boolean;
  logoValid: boolean;
  keywordsValid: boolean;
  /** True when every present field is valid AND the target is non-empty/valid. */
  allValid: boolean;
}

/**
 * Validate a record editor state. Target must be non-empty and valid for the
 * chosen protocol (a record write always requires a target). TTL is bounded;
 * priority (if present) is a non-negative integer; logo (if present) is an
 * Arweave txId; keywords are capped.
 */
export function validateRecordFields(
  s: RecordFieldsState,
): RecordFieldsValidity {
  const target = s.target.trim();
  const targetValid = isValidRecordTarget(target, s.protocol);
  const ttlNum = Number(s.ttl);
  const ttlValid =
    Number.isInteger(ttlNum) && ttlNum >= MIN_TTL && ttlNum <= MAX_TTL;
  const priorityValid =
    s.priority.trim() === '' ||
    (Number.isInteger(Number(s.priority)) && Number(s.priority) >= 0);
  // Validate the trimmed value (the write path sends `s.logo.trim()`), so a
  // pasted TX ID with surrounding whitespace isn't wrongly rejected.
  const logoValid = s.logo.trim() === '' || isArweaveTxId(s.logo.trim());
  const keywordsValid = parseKeywords(s.keywordsRaw).length <= MAX_KEYWORDS;
  return {
    targetValid,
    ttlValid,
    priorityValid,
    logoValid,
    keywordsValid,
    allValid:
      targetValid && ttlValid && priorityValid && logoValid && keywordsValid,
  };
}

/** The SDK-facing param set (minus `undername`) built from a valid state. */
export interface RecordChangeParams {
  transactionId: string;
  ttlSeconds: number;
  targetProtocol: number;
  priority?: number;
  /**
   * Metadata fields are TRI-STATE, and the three states are distinct
   * authorizations — the owner proof binds them separately, so "clear the
   * description" and "set it to an empty string" are not the same request.
   *
   *   omitted  → leave whatever is on chain untouched
   *   null     → clear it
   *   a value  → set it
   *
   * Never normalise `null` to `''` on the way in or out. The two mean
   * different things and the service can tell them apart.
   */
  displayName?: string | null;
  logo?: string | null;
  description?: string | null;
  keywords?: string[] | null;
}

/**
 * Convert a record editor state into the SDK param set.
 *
 * Takes the ORIGINAL state as well as the current one, because the params are
 * a diff, not a snapshot. Without the original there is no way to distinguish
 * the two things a blank box can mean:
 *
 *   - the field was always empty and the user never touched it → omit it, so
 *     whatever is on chain is left alone;
 *   - the field HAD a value and the user emptied it → send `null`, which is
 *     the authorization to clear it.
 *
 * Sending the current value unconditionally — which is what this used to do —
 * gets the first case wrong on every save: an untouched empty box was sent as
 * `''`, asking the service to write an empty string over a field the user
 * never opened. Omitting blanks unconditionally gets the second case wrong
 * instead, and makes a field impossible to clear once set. That was the
 * standing behaviour for `logo`, noted below as a limitation; it is now fixable.
 *
 * Logo has one extra rule that survives: the ANT program validates it as a
 * 43-character Arweave address and rejects `''` outright (InvalidLogo, 6021),
 * failing the write AFTER the target had already saved. Clearing a logo is
 * `null`, never the empty string.
 */
export function toRecordChange(
  s: RecordFieldsState,
  /**
   * State as loaded. Omit for a NEW record, where there is nothing on chain to
   * leave alone and every blank field is simply absent.
   */
  original?: RecordFieldsState,
): RecordChangeParams {
  const priorityTrimmed = s.priority.trim();

  return {
    transactionId: s.target.trim(),
    ttlSeconds: Number(s.ttl),
    targetProtocol: s.protocol,
    ...(priorityTrimmed !== '' ? { priority: Number(priorityTrimmed) } : {}),
    ...textField('displayName', s.displayName, original?.displayName),
    ...textField('logo', s.logo.trim(), original?.logo.trim()),
    ...textField('description', s.description, original?.description),
    ...keywordsField(s.keywordsRaw, original?.keywordsRaw),
  };
}

/** Tri-state for one free-text field: unchanged → omit, emptied → null. */
function textField(
  key: 'displayName' | 'logo' | 'description',
  current: string,
  original: string | undefined,
): Record<string, string | null> | Record<string, never> {
  // A new record: nothing on chain, so a blank field is simply not set.
  if (original === undefined) {
    return current === '' ? {} : { [key]: current };
  }
  if (current === original) return {};
  return { [key]: current === '' ? null : current };
}

/** Same rule for keywords, compared as parsed lists rather than raw text. */
function keywordsField(
  currentRaw: string,
  originalRaw: string | undefined,
): { keywords?: string[] | null } {
  const current = parseKeywords(currentRaw);

  if (originalRaw === undefined) {
    return current.length > 0 ? { keywords: current } : {};
  }

  const original = parseKeywords(originalRaw);
  // Compared parsed, so whitespace and separator edits that change nothing
  // real do not send a write.
  if (
    current.length === original.length &&
    current.every((k, i) => k === original[i])
  ) {
    return {};
  }
  return { keywords: current.length === 0 ? null : current };
}


/**
 * Drop the `null`s, for the write paths that cannot express a clear.
 *
 * `toRecordChange` produces the tri-state the SPONSORED record actions accept:
 * omitted leaves a field alone, `null` clears it. The `@ar.io/sdk` ANT writes
 * this app still uses have no third state — a field is either sent or it is
 * not — so a clear degrades here to "leave unchanged", which is exactly the
 * limitation those writes already had.
 *
 * Deliberately a separate step rather than a looser `toRecordChange`. The diff
 * is worth having on both paths today: it stops every save from writing empty
 * strings over fields the user never opened. Only the ability to CLEAR has to
 * wait, and when the sponsored actions land this adapter is what gets deleted.
 */
export function withoutClears(
  params: RecordChangeParams,
): Omit<RecordChangeParams, 'displayName' | 'logo' | 'description' | 'keywords'> & {
  displayName?: string;
  logo?: string;
  description?: string;
  keywords?: string[];
} {
  const { displayName, logo, description, keywords, ...rest } = params;
  return {
    ...rest,
    ...(typeof displayName === 'string' ? { displayName } : {}),
    ...(typeof logo === 'string' ? { logo } : {}),
    ...(typeof description === 'string' ? { description } : {}),
    ...(Array.isArray(keywords) ? { keywords } : {}),
  };
}
