import { useMemo } from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { isFileFree } from '@/hooks/useFreeUploadLimit';
import { MAX_PAGE_BYTES, estimatePageCredits } from '../publish/cost';

interface SizeMeterProps {
  sizeBytes: number;
  freeUploadLimitBytes: number;
  wincForOneGiB?: string;
  perDataItemFeeWinc?: string;
  className?: string;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Live page-size feedback in the editor: how big the page is against the hard
 * 2 MB single-item ceiling, and whether publishing it is free or costs credits —
 * so the user learns the cost while editing, not only at the publish modal.
 */
export default function SizeMeter({
  sizeBytes,
  freeUploadLimitBytes,
  wincForOneGiB,
  perDataItemFeeWinc,
  className,
}: SizeMeterProps) {
  const free = isFileFree(sizeBytes, freeUploadLimitBytes);
  const overCeiling = sizeBytes > MAX_PAGE_BYTES;
  const credits = useMemo(
    () => (free ? 0 : estimatePageCredits(sizeBytes, wincForOneGiB, perDataItemFeeWinc)),
    [free, sizeBytes, wincForOneGiB, perDataItemFeeWinc],
  );
  const creditsKnown = Number.isFinite(credits);
  const pct = Math.min(100, Math.max(1, (sizeBytes / MAX_PAGE_BYTES) * 100));
  const barColor = overCeiling ? 'bg-error' : free ? 'bg-success' : 'bg-primary';

  return (
    <div className={`rounded-2xl border border-border/20 bg-card p-3 ${className ?? ''}`}>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-foreground/60">Page size</span>
        <span className="font-medium text-foreground">{formatBytes(sizeBytes)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 text-xs">
        {overCeiling ? (
          <span className="inline-flex items-center gap-1 font-medium text-error">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            Over the {MAX_PAGE_BYTES / (1024 * 1024)} MB limit — shrink images to publish
          </span>
        ) : free ? (
          <span className="inline-flex items-center gap-1 font-medium text-success">
            <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
            Free to publish
          </span>
        ) : creditsKnown ? (
          <span className="text-foreground/70">≈ {credits.toFixed(6)} credits to publish</span>
        ) : (
          <span className="text-foreground/50">Calculating cost…</span>
        )}
      </div>
    </div>
  );
}
