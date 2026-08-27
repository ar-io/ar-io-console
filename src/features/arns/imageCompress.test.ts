import { describe, expect, it } from 'vitest';

import { compressImage, targetDimensions } from './imageCompress';

describe('targetDimensions', () => {
  it('returns the input untouched when it already fits', () => {
    expect(targetDimensions(200, 100, 1024)).toEqual({ width: 200, height: 100 });
    expect(targetDimensions(1024, 1024, 1024)).toEqual({
      width: 1024,
      height: 1024,
    });
  });

  it('scales the longest edge down to the cap, preserving aspect ratio', () => {
    expect(targetDimensions(2048, 1024, 1024)).toEqual({
      width: 1024,
      height: 512,
    });
    expect(targetDimensions(1000, 4000, 1000)).toEqual({
      width: 250,
      height: 1000,
    });
  });

  it('never drops a dimension below 1px', () => {
    const d = targetDimensions(5000, 1, 100);
    expect(d.width).toBe(100);
    expect(d.height).toBeGreaterThanOrEqual(1);
  });

  it('floors fractional results', () => {
    expect(targetDimensions(1500, 1000, 1000)).toEqual({
      width: 1000,
      height: 666,
    });
  });

  it('is a no-op for degenerate inputs', () => {
    expect(targetDimensions(0, 0, 1024)).toEqual({ width: 0, height: 0 });
    expect(targetDimensions(200, 100, 0)).toEqual({ width: 200, height: 100 });
  });
});

describe('compressImage passthrough', () => {
  it('returns a small image untouched (no canvas work)', async () => {
    const file = new File([new Uint8Array(100)], 'logo.png', {
      type: 'image/png',
    });
    await expect(compressImage(file, 10_000)).resolves.toBe(file);
  });

  it('returns SVG as-is regardless of size', async () => {
    const file = new File([new Uint8Array(50_000)], 'logo.svg', {
      type: 'image/svg+xml',
    });
    await expect(compressImage(file, 10_000)).resolves.toBe(file);
  });

  it('returns GIF as-is regardless of size', async () => {
    const file = new File([new Uint8Array(50_000)], 'anim.gif', {
      type: 'image/gif',
    });
    await expect(compressImage(file, 10_000)).resolves.toBe(file);
  });

  it('passes through when the target is non-positive', async () => {
    const file = new File([new Uint8Array(50_000)], 'logo.png', {
      type: 'image/png',
    });
    await expect(compressImage(file, 0)).resolves.toBe(file);
  });
});
