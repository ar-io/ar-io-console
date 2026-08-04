/**
 * Pure, node-testable helpers for the logo-upload flow shared by the ANT-level
 * logo (EditDetailsModal) and record logos (RecordFieldsEditor). Kept free of
 * React/DOM (and the `File` global) so it runs under the node vitest env — the
 * component adapts a real `File` to the lightweight `{ name, type, size }`
 * descriptor at the call site. Mirrors the style of `recordFields.ts`.
 */
import { formatFreeLimit, isFileFree } from '../../utils/freeTier';

/** Image MIME types accepted for a logo upload. */
export const ACCEPTED_IMAGE_MIME = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'image/bmp',
] as const;

/**
 * File extensions that map to an accepted image type. Used only as a fallback
 * when the browser reports an empty MIME type (some environments do).
 */
const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'ico',
  'bmp',
]);

/** The `accept` attribute string for the hidden file `<input>`. */
export const IMAGE_ACCEPT = ACCEPTED_IMAGE_MIME.join(',');

/** A lightweight file descriptor (avoids depending on the DOM `File` global). */
export interface FileDescriptor {
  name: string;
  type: string;
  size: number;
}

/**
 * Whether a file descriptor names an image: true when the MIME is in the
 * accepted list, or — when the MIME is empty — when the filename extension maps
 * to a known image type.
 */
export function isImageDescriptor(desc: {
  name: string;
  type: string;
}): boolean {
  const type = (desc.type || '').toLowerCase();
  if (type !== '') {
    return (ACCEPTED_IMAGE_MIME as readonly string[]).includes(type);
  }
  const dot = desc.name.lastIndexOf('.');
  if (dot < 0 || dot === desc.name.length - 1) return false;
  const ext = desc.name.slice(dot + 1).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

/** Outcome of validating a candidate logo file. */
export type LogoFileValidation =
  | { ok: true }
  | {
      ok: false;
      reason: 'empty' | 'not-image' | 'too-large';
      message: string;
    };

/**
 * Validate a candidate logo file: it must be a non-empty image that fits the
 * bundler free tier (so the upload costs nothing). `freeLimit` is the per-item
 * free size cap; `bytesRemaining` is the wallet's remaining allowance (a number,
 * `null` = unlimited, `undefined` = unknown → size cap alone decides), threaded
 * to `isFileFree`.
 */
export function validateLogoFile(
  desc: FileDescriptor,
  freeLimit: number,
  bytesRemaining?: number | null,
): LogoFileValidation {
  if (!isImageDescriptor(desc)) {
    return {
      ok: false,
      reason: 'not-image',
      message: 'Choose an image file (PNG, JPG, GIF, WebP, SVG, or ICO).',
    };
  }
  if (desc.size <= 0) {
    return {
      ok: false,
      reason: 'empty',
      message: 'That file is empty. Choose a valid image.',
    };
  }
  if (!isFileFree(desc.size, freeLimit, bytesRemaining)) {
    return {
      ok: false,
      reason: 'too-large',
      message: `Image too large for a free upload — max ${formatFreeLimit(
        freeLimit,
      )}. Paste an existing TX ID instead.`,
    };
  }
  return { ok: true };
}
