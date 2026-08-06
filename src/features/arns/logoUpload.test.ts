import { describe, expect, it } from 'vitest';

import {
  ACCEPTED_IMAGE_MIME,
  IMAGE_ACCEPT,
  isImageDescriptor,
  validateLogoFile,
} from './logoUpload';

describe('isImageDescriptor', () => {
  it('accepts images by MIME type', () => {
    expect(isImageDescriptor({ name: 'a.png', type: 'image/png' })).toBe(true);
    expect(isImageDescriptor({ name: 'a.jpg', type: 'image/jpeg' })).toBe(true);
    expect(isImageDescriptor({ name: 'a.svg', type: 'image/svg+xml' })).toBe(
      true,
    );
  });

  it('is case-insensitive on MIME', () => {
    expect(isImageDescriptor({ name: 'a.png', type: 'IMAGE/PNG' })).toBe(true);
  });

  it('falls back to the extension when MIME is empty', () => {
    expect(isImageDescriptor({ name: 'logo.png', type: '' })).toBe(true);
    expect(isImageDescriptor({ name: 'LOGO.JPEG', type: '' })).toBe(true);
    expect(isImageDescriptor({ name: 'icon.svg', type: '' })).toBe(true);
  });

  it('rejects non-images by MIME', () => {
    expect(isImageDescriptor({ name: 'a.pdf', type: 'application/pdf' })).toBe(
      false,
    );
    expect(isImageDescriptor({ name: 'a.txt', type: 'text/plain' })).toBe(
      false,
    );
  });

  it('rejects non-image extensions when MIME is empty', () => {
    expect(isImageDescriptor({ name: 'doc.pdf', type: '' })).toBe(false);
    expect(isImageDescriptor({ name: 'noext', type: '' })).toBe(false);
    expect(isImageDescriptor({ name: 'trailing.', type: '' })).toBe(false);
  });

  it('exposes the accept string built from the accepted MIME list', () => {
    expect(IMAGE_ACCEPT).toBe(ACCEPTED_IMAGE_MIME.join(','));
    expect(IMAGE_ACCEPT).toContain('image/png');
  });
});

describe('validateLogoFile', () => {
  const png = (size: number) => ({ name: 'logo.png', type: 'image/png', size });

  it('accepts a small png that fits the free tier', () => {
    expect(validateLogoFile(png(1000), 100_000).ok).toBe(true);
  });

  it("rejects a non-image with reason 'not-image'", () => {
    const r = validateLogoFile(
      { name: 'doc.pdf', type: 'application/pdf', size: 100 },
      100_000,
    );
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toBe('not-image');
  });

  it("rejects an empty file with reason 'empty'", () => {
    const r = validateLogoFile(png(0), 100_000);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toBe('empty');
  });

  it("rejects an oversized image with reason 'too-large'", () => {
    const r = validateLogoFile(png(200_000), 100_000);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toBe('too-large');
  });

  it("is 'too-large' when it exceeds the remaining allowance", () => {
    // Under the per-item cap but over what the wallet has left.
    const r = validateLogoFile(png(50_000), 100_000, 10_000);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toBe('too-large');
  });

  it('passes with a null (unlimited) allowance — size cap alone decides', () => {
    expect(validateLogoFile(png(50_000), 100_000, null).ok).toBe(true);
  });

  it('passes with an undefined allowance — size cap alone decides', () => {
    expect(validateLogoFile(png(50_000), 100_000, undefined).ok).toBe(true);
  });

  it("is 'too-large' when there is no free tier (freeLimit 0)", () => {
    const r = validateLogoFile(png(10), 0);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toBe('too-large');
  });
});
