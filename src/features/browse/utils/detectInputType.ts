import type { InputType } from '../types';

// Transaction ID: Exactly 43 characters, base64url pattern
const TX_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

// ArNS Name: 1-51 chars, lowercase alphanumeric with hyphens/underscores
const ARNS_PATTERN = /^[a-z0-9_-]{1,51}$/;

/**
 * Detects whether the input is a transaction ID or ArNS name
 * Transaction ID: Exactly 43 characters, base64url pattern [A-Za-z0-9_-]{43}
 * ArNS Name: Everything else (1-51 chars, lowercase)
 */
export function detectInputType(input: string): InputType {
  return TX_ID_PATTERN.test(input) ? 'txId' : 'arnsName';
}

/**
 * Validates if the input is a valid ArNS name or transaction ID
 */
export function isValidInput(input: string): boolean {
  if (!input || input.trim() === '') return false;

  return TX_ID_PATTERN.test(input) || ARNS_PATTERN.test(input);
}
