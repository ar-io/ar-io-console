import { describe, it, expect } from 'vitest';
import { isArUrl, parseArUrl, resolveArUrl, type ResolveCtx } from './arResolve';

const ctx: ResolveCtx = { gateway: 'https://turbo-gateway.com', arnsHost: 'ar.io' };

// A real 43-char base64url Arweave tx id.
const TX = 'qX7mR2kP9wL4nT8vB1cZ6yH3jF5dG0sA7eU2oI9pW4t';

describe('isArUrl', () => {
  it('detects ar:// urls case-insensitively', () => {
    expect(isArUrl('ar://jenny')).toBe(true);
    expect(isArUrl('AR://Jenny')).toBe(true);
    expect(isArUrl('  ar://x  ')).toBe(true);
  });
  it('rejects non-ar values', () => {
    expect(isArUrl('https://example.com')).toBe(false);
    expect(isArUrl('mailto:a@b.c')).toBe(false);
    expect(isArUrl('#anchor')).toBe(false);
    expect(isArUrl(42)).toBe(false);
    expect(isArUrl(undefined)).toBe(false);
  });
});

describe('parseArUrl', () => {
  it('parses a 43-char tx id', () => {
    expect(parseArUrl(`ar://${TX}`)).toEqual({ kind: 'tx', value: TX });
  });
  it('parses a bare name', () => {
    expect(parseArUrl('ar://jenny')).toEqual({ kind: 'name', value: 'jenny' });
  });
  it('splits an undername', () => {
    expect(parseArUrl('ar://links_myname')).toEqual({
      kind: 'name',
      value: 'myname',
      undername: 'links',
    });
  });
  it('returns null for non-ar or empty', () => {
    expect(parseArUrl('https://example.com')).toBeNull();
    expect(parseArUrl('ar://')).toBeNull();
  });
});

describe('resolveArUrl', () => {
  it('resolves a tx id against the gateway', () => {
    expect(resolveArUrl(`ar://${TX}`, ctx)).toBe(`https://turbo-gateway.com/${TX}`);
  });
  it('resolves an ArNS name against the host', () => {
    expect(resolveArUrl('ar://jenny', ctx)).toBe('https://jenny.ar.io');
  });
  it('resolves an undername with the underscore preserved', () => {
    expect(resolveArUrl('ar://links_myname', ctx)).toBe('https://links_myname.ar.io');
  });
  it('normalises a trailing slash on the gateway', () => {
    expect(resolveArUrl(`ar://${TX}`, { gateway: 'https://turbo-gateway.com/', arnsHost: 'ar.io' })).toBe(
      `https://turbo-gateway.com/${TX}`,
    );
  });
  it('passes through https and mailto unchanged', () => {
    expect(resolveArUrl('https://example.com/x', ctx)).toBe('https://example.com/x');
    expect(resolveArUrl('mailto:hi@example.com', ctx)).toBe('mailto:hi@example.com');
    expect(resolveArUrl('#section', ctx)).toBe('#section');
  });
  it('is deterministic', () => {
    expect(resolveArUrl('ar://jenny', ctx)).toBe(resolveArUrl('ar://jenny', ctx));
  });
});
