/**
 * Client-side image downscaling for Pages (avatars / inline images / OG images).
 *
 * Resizes an uploaded image to fit within `maxDim` on its longest edge and
 * re-encodes it to WebP (falling back to PNG when the browser can't produce WebP),
 * returning a compact `data:` URI that embeds directly in the published HTML. This
 * keeps pages small so a typical page stays inside the bundler free tier (PRD §12).
 *
 * Pure DOM/Canvas — no new dependencies.
 */

export interface DownscaleOptions {
  /** Longest-edge cap in px (default 512). */
  maxDim?: number;
  /** Quality 0..1 for lossy encoders (default 0.85). */
  quality?: number;
  /** Preferred output mime (default `image/webp`). */
  mime?: string;
}

/** Downscale + re-encode an image File to a compact data URI. */
export async function downscaleImageToDataUrl(
  file: File,
  opts: DownscaleOptions = {},
): Promise<string> {
  const maxDim = opts.maxDim ?? 512;
  const quality = opts.quality ?? 0.85;
  const preferred = opts.mime ?? 'image/webp';

  const source = await loadImage(file);
  const srcW = 'width' in source ? source.width : 0;
  const srcH = 'height' in source ? source.height : 0;
  if (!srcW || !srcH) throw new Error('Could not read image dimensions');

  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const cx = canvas.getContext('2d');
  if (!cx) throw new Error('Could not acquire a 2D canvas context');
  cx.drawImage(source as CanvasImageSource, 0, 0, w, h);

  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    source.close();
  }

  // Prefer WebP; if the encoder ignores it (older Safari), fall back to PNG.
  let dataUrl = canvas.toDataURL(preferred, quality);
  if (!dataUrl.startsWith(`data:${preferred}`)) {
    dataUrl = canvas.toDataURL('image/png');
  }
  return dataUrl;
}

/** Approximate byte size of a `data:` URI's payload (base64 → bytes). */
export function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return dataUrl.length;
  const payload = dataUrl.slice(comma + 1);
  // base64 encodes 3 bytes per 4 chars; subtract padding.
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the <img> path (e.g. unsupported source in some browsers).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to load image'));
      el.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
