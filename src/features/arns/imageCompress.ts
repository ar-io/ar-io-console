/**
 * Client-side image compression for logo uploads, so oversized images can still
 * land in the bundler free tier (a logo upload stays zero-cost) instead of being
 * rejected outright. Canvas-based, no dependencies — ported from arns-react's
 * `imageUtils.ts` and adapted to the console's style/types.
 *
 * The pure `targetDimensions` helper (downscale math) is DOM-free so it runs
 * under the node vitest env; the `compressImage` entry point touches the DOM
 * (`Image`/`<canvas>`) only after its early passthrough returns, so callers can
 * still import it from node for the passthrough paths.
 */

/** Cap the longest edge before compressing — logos never need to exceed this. */
const MAX_DIMENSION = 1024;
/** Never shrink below this; past it, an image simply can't fit the target. */
const MIN_DIMENSION = 64;
/** Quality steps to try before shrinking dimensions and resetting quality. */
const MAX_QUALITY_ATTEMPTS = 8;

/** Downscaled canvas dimensions. */
export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Fit `width`×`height` inside a `maxPx` box, preserving aspect ratio. Returns the
 * input untouched when it already fits (or is degenerate). Pure + node-testable.
 */
export function targetDimensions(
  width: number,
  height: number,
  maxPx: number,
): Dimensions {
  if (width <= 0 || height <= 0 || maxPx <= 0) return { width, height };
  if (width <= maxPx && height <= maxPx) return { width, height };
  const ratio = Math.min(maxPx / width, maxPx / height);
  return {
    width: Math.max(1, Math.floor(width * ratio)),
    height: Math.max(1, Math.floor(height * ratio)),
  };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression.'));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

function extForType(type: string): string {
  if (type === 'image/webp') return 'webp';
  if (type === 'image/png') return 'png';
  return 'jpg';
}

function blobToFile(blob: Blob, originalName: string): File {
  const base = originalName.replace(/\.[^.]+$/, '') || 'logo';
  return new File([blob], `${base}.${extForType(blob.type)}`, {
    type: blob.type,
    lastModified: Date.now(),
  });
}

/**
 * Compress `file` so it fits within `maxBytes`, best-effort. Passes small images
 * through untouched, and returns SVG/GIF as-is (vector / animation can't be
 * canvas-recompressed safely). PNG transparency is preserved when a lossless PNG
 * re-encode at the downscaled size already fits; otherwise it falls back to WEBP
 * (which keeps alpha), and non-PNG sources use JPEG. When the target can't be
 * reached it returns the smallest result it produced (never throws for that) so
 * the caller can re-validate and surface the existing "too large" error.
 *
 * @throws when the canvas 2D context is unavailable or the image fails to load.
 */
export async function compressImage(
  file: File,
  maxBytes: number,
): Promise<File> {
  // Can't meaningfully recompress vector/animated images — return untouched.
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;
  // Already fits (or no real target): passthrough, no re-encode.
  if (maxBytes <= 0 || file.size <= maxBytes) return file;

  const img = await loadImage(file);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is unavailable — cannot compress image.');
  }

  const isPng = file.type === 'image/png';
  // WEBP keeps PNG's transparency; photos (and other sources) compress best as JPEG.
  const lossyType =
    isPng || file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';

  let { width, height } = targetDimensions(
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
    MAX_DIMENSION,
  );

  const draw = () => {
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
  };
  draw();

  // 1) PNG source: try a lossless PNG re-encode first — it preserves
  //    transparency exactly and may already fit at the downscaled size.
  if (isPng) {
    const pngBlob = await canvasToBlob(canvas, 'image/png');
    if (pngBlob && pngBlob.size <= maxBytes) {
      return blobToFile(pngBlob, file.name);
    }
  }

  // 2) Lossy pass: step quality down, shrinking dimensions when quality bottoms out.
  let quality = 0.9;
  let best: Blob | null = null;
  for (let i = 0; i < MAX_QUALITY_ATTEMPTS; i++) {
    const blob = await canvasToBlob(canvas, lossyType, quality);
    if (!blob) break;
    if (!best || blob.size < best.size) best = blob;
    if (blob.size <= maxBytes) {
      best = blob;
      break;
    }
    quality -= 0.1;
    if (quality < 0.4) {
      if (width <= MIN_DIMENSION || height <= MIN_DIMENSION) break;
      width = Math.max(MIN_DIMENSION, Math.floor(width * 0.8));
      height = Math.max(MIN_DIMENSION, Math.floor(height * 0.8));
      draw();
      quality = 0.9;
    }
  }

  // Return best effort even if still over — the caller re-validates and shows the
  // existing "too large" error rather than us throwing here.
  return best ? blobToFile(best, file.name) : file;
}
