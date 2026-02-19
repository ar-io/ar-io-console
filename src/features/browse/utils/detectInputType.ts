import type { InputType } from '../types';

/**
 * Detects whether the input is a transaction ID or ArNS name
 * Transaction ID: Exactly 43 characters, base64url pattern [A-Za-z0-9_-]{43}
 * ArNS Name: Everything else (1-51 chars, lowercase)
 */
export function detectInputType(input: string): InputType {
  const txIdPattern = /^[A-Za-z0-9_-]{43}$/;
  return txIdPattern.test(input) ? 'txId' : 'arnsName';
}

/**
 * Validates if the input is a valid ArNS name or transaction ID
 */
export function isValidInput(input: string): boolean {
  if (!input || input.trim() === '') return false;

  const txIdPattern = /^[A-Za-z0-9_-]{43}$/;
  const arnsPattern = /^[a-z0-9_-]{1,51}$/i;

  return txIdPattern.test(input) || arnsPattern.test(input);
}
