/**
 * Shared cost math for publishing a page. A page is a single data item, so its
 * cost is storage for its byte size plus the fixed per-data-item fee (Gotcha #9).
 * Used by both the publish modal and the in-editor size meter so they never drift.
 */
import { wincPerCredit } from '@/constants';

const GiB = 1024 ** 3;

/**
 * Hard ceiling for a single self-contained page (PRD §12). A page is ONE data
 * item, so an oversized one is almost always huge inlined media — publishing is
 * blocked above this and the user is pointed at reducing images. (Avatars are
 * auto-downscaled; this guards hand-pasted data-URIs.)
 */
export const MAX_PAGE_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Estimate the credit cost to publish a page of `sizeBytes`. Returns NaN when
 * pricing is not yet available (the storage rate is unknown). Callers should
 * treat a free page as 0 before calling this.
 */
export function estimatePageCredits(
  sizeBytes: number,
  wincForOneGiB?: string,
  perDataItemFeeWinc?: string,
): number {
  const wincNum = wincForOneGiB ? Number(wincForOneGiB) : NaN;
  if (!Number.isFinite(wincNum) || wincNum <= 0) return NaN;
  const perItem = perDataItemFeeWinc ? Number(perDataItemFeeWinc) : 0;
  const winc = (wincNum * sizeBytes) / GiB + perItem;
  return winc / wincPerCredit;
}
