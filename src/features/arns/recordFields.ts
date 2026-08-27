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
  displayName?: string;
  logo?: string;
  description?: string;
  keywords?: string[];
}

/**
 * Convert a record editor state into the SDK param set. Free-text advanced
 * fields are sent verbatim (blanking one sends `''`, which clears it on-chain);
 * priority and logo are OMITTED when blank.
 *
 * Logo is not like the other text fields. The ANT program validates it as a
 * 43-character Arweave address, so an empty string is rejected outright:
 *
 *   AnchorError ... programs/ario-ant/src/lib.rs:1162
 *   Error Code: InvalidLogo. Error Number: 6021.
 *   Error Message: Logo must be a valid 43-character Arweave address.
 *
 * Sending `logo: ''` therefore failed EVERY record write made without a logo —
 * the base `@` record, adding an undername, and editing one — and it failed
 * *after* SetRecord had already succeeded, so the target saved and the metadata
 * did not. Omitting a blank logo means "leave it unchanged", which matches the
 * ANT-level setLogo path that already notes a logo can be changed but not
 * cleared.
 */
export function toRecordChange(s: RecordFieldsState): RecordChangeParams {
  const priorityTrimmed = s.priority.trim();
  const logoTrimmed = s.logo.trim();
  return {
    transactionId: s.target.trim(),
    ttlSeconds: Number(s.ttl),
    targetProtocol: s.protocol,
    ...(priorityTrimmed !== '' ? { priority: Number(priorityTrimmed) } : {}),
    displayName: s.displayName,
    ...(logoTrimmed !== '' ? { logo: logoTrimmed } : {}),
    description: s.description,
    keywords: parseKeywords(s.keywordsRaw),
  };
}
