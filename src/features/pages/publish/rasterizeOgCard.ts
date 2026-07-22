/**
 * Rasterise an OG-card SVG to a PNG Blob in the browser (Image + canvas).
 *
 * Best-effort: returns null on any failure — non-browser env, image load error,
 * timeout, missing 2d context, or a tainted canvas — so publishing can proceed
 * without a preview image rather than break. The OG SVG is fully self-contained
 * (theme colors + at most an inline `data:` avatar, no external refs), so the
 * canvas never taints in practice; the try/catch is defence-in-depth.
 *
 * Browser-only, so this is intentionally not covered by the node/vitest suite;
 * the pure SVG it consumes is exhaustively tested in `render/ogCard.test.ts`.
 */
import { OG_WIDTH, OG_HEIGHT } from '../render/ogCard';

/** Rasterise an OG-card SVG string to a PNG Blob, or null on any failure. */
export async function rasterizeSvgToPng(
  svg: string,
  width = OG_WIDTH,
  height = OG_HEIGHT,
  timeoutMs = 8000,
): Promise<Blob | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return new Promise<Blob | null>((resolve) => {
    let settled = false;
    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(blob);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);

    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const c2d = canvas.getContext('2d');
        if (!c2d) return finish(null);
        c2d.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => finish(blob), 'image/png');
      } catch {
        finish(null);
      }
    };
    img.onerror = () => finish(null);
    img.src = url;
  });
}
