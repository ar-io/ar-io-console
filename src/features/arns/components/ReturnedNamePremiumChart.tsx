import { useMemo } from 'react';

import { auctionMultiplier, START_RNP_PREMIUM } from '../returnedNamePricing';

interface ReturnedNamePremiumChartProps {
  startTimestamp: number;
  endTimestamp: number;
  /** Live clock, so the "now" marker tracks the current premium. */
  now: number;
  startPremium?: number;
  className?: string;
}

const VB_W = 320;
const VB_H = 132;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 16;
const PAD_B = 26;

/** Fraction 0..1 of the way through the auction window at `now`. */
function elapsedFraction(start: number, end: number, now: number): number {
  const span = end - start;
  if (span <= 0) return now >= end ? 1 : 0;
  return Math.max(0, Math.min(1, (now - start) / span));
}

function fmtDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

/**
 * Self-contained SVG chart of a returned name's Dutch-auction premium decaying
 * linearly from `startPremium`× (auction open) to 1× (auction close). No chart
 * library — the multiplier is linear in time, so the price curve (price = base ×
 * demand × multiplier) has the exact same shape the arns-react RNPChart draws.
 *
 * The portion already elapsed is a solid line; the remaining decay is dashed,
 * with a dot + label at the current premium. Purely presentational.
 */
export default function ReturnedNamePremiumChart({
  startTimestamp,
  endTimestamp,
  now,
  startPremium = START_RNP_PREMIUM,
  className,
}: ReturnedNamePremiumChartProps) {
  const geom = useMemo(() => {
    const innerW = VB_W - PAD_L - PAD_R;
    const innerH = VB_H - PAD_T - PAD_B;

    // Map a premium multiplier to a Y coordinate (startPremium at top, 1 at floor).
    const yFor = (m: number) => {
      const t = (m - 1) / Math.max(1e-9, startPremium - 1); // 1 → 0, start → 1
      return PAD_T + (1 - Math.max(0, Math.min(1, t))) * innerH;
    };
    const xFor = (frac: number) => PAD_L + Math.max(0, Math.min(1, frac)) * innerW;

    const startY = yFor(startPremium);
    const endY = yFor(1);
    const frac = elapsedFraction(startTimestamp, endTimestamp, now);
    const nowMult = auctionMultiplier({
      startTimestamp,
      endTimestamp,
      now,
      startPremium,
    });
    const nowX = xFor(frac);
    const nowY = yFor(nowMult);

    const x0 = xFor(0);
    const x1 = xFor(1);
    const floorY = PAD_T + innerH;

    return {
      x0,
      x1,
      startY,
      endY,
      nowX,
      nowY,
      floorY,
      nowMult,
      // Area under the whole decay line.
      areaPath: `M ${x0} ${startY} L ${x1} ${endY} L ${x1} ${floorY} L ${x0} ${floorY} Z`,
      pastLine: `M ${x0} ${startY} L ${nowX} ${nowY}`,
      futureLine: `M ${nowX} ${nowY} L ${x1} ${endY}`,
    };
  }, [startTimestamp, endTimestamp, now, startPremium]);

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Auction premium currently ${geom.nowMult.toFixed(1)}x, decaying to 1x by ${fmtDate(endTimestamp)}`}
      >
        <defs>
          <linearGradient id="rnp-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--color-primary))" stopOpacity="0.22" />
            <stop offset="100%" stopColor="rgb(var(--color-primary))" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 1x floor line */}
        <line
          x1={geom.x0}
          y1={geom.floorY}
          x2={geom.x1}
          y2={geom.floorY}
          stroke="rgb(var(--color-foreground))"
          strokeOpacity="0.12"
          strokeWidth="1"
        />

        {/* Area under the decay */}
        <path d={geom.areaPath} fill="url(#rnp-area)" />

        {/* Remaining decay (future) — dashed */}
        <path
          d={geom.futureLine}
          fill="none"
          stroke="rgb(var(--color-primary))"
          strokeOpacity="0.45"
          strokeWidth="2"
          strokeDasharray="4 4"
          strokeLinecap="round"
        />
        {/* Elapsed decay (past) — solid */}
        <path
          d={geom.pastLine}
          fill="none"
          stroke="rgb(var(--color-primary))"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Now marker */}
        <line
          x1={geom.nowX}
          y1={PAD_T - 6}
          x2={geom.nowX}
          y2={geom.floorY}
          stroke="rgb(var(--color-primary))"
          strokeOpacity="0.25"
          strokeWidth="1"
        />
        <circle
          cx={geom.nowX}
          cy={geom.nowY}
          r="4.5"
          fill="rgb(var(--color-primary))"
          stroke="rgb(var(--color-background))"
          strokeWidth="2"
        />

        {/* Start premium label (top-left) */}
        <text
          x={geom.x0}
          y={geom.startY - 5}
          fontSize="10"
          fill="rgb(var(--color-foreground))"
          fillOpacity="0.55"
        >
          {Math.round(startPremium)}x
        </text>
        {/* Floor label (bottom-right) */}
        <text
          x={geom.x1}
          y={geom.floorY - 4}
          fontSize="10"
          textAnchor="end"
          fill="rgb(var(--color-foreground))"
          fillOpacity="0.55"
        >
          1x
        </text>

        {/* Date axis */}
        <text
          x={geom.x0}
          y={VB_H - 8}
          fontSize="10"
          fill="rgb(var(--color-foreground))"
          fillOpacity="0.55"
        >
          {fmtDate(startTimestamp)}
        </text>
        <text
          x={geom.x1}
          y={VB_H - 8}
          fontSize="10"
          textAnchor="end"
          fill="rgb(var(--color-foreground))"
          fillOpacity="0.55"
        >
          {fmtDate(endTimestamp)}
        </text>
      </svg>
    </div>
  );
}
