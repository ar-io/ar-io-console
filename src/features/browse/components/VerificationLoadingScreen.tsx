import { useEffect, useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

export type VerificationPhase = 'resolving' | 'fetching-manifest' | 'verifying' | 'complete';

export interface VerificationLoadingScreenProps {
  identifier: string;
  phase: VerificationPhase;
  manifestTxId?: string;
  gateway?: string;
  progress: { current: number; total: number; failed?: number };
  recentResources: Array<{ path: string; status: 'verified' | 'failed' | 'verifying' }>;
  startTime: number | null;
  isSingleFile: boolean;
}

export function VerificationLoadingScreen({
  identifier,
  phase,
  manifestTxId,
  gateway,
  progress,
  recentResources,
  startTime,
  isSingleFile,
}: VerificationLoadingScreenProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [startTime]);

  const formatElapsed = (ms: number): string => {
    const seconds = ms / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(0);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatTxId = (txId: string): string => {
    if (txId.length <= 16) return txId;
    return `${txId.slice(0, 8)}...${txId.slice(-6)}`;
  };

  const formatGateway = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const getPhaseStatus = (targetPhase: VerificationPhase): 'complete' | 'active' | 'pending' => {
    const phaseOrder: VerificationPhase[] = ['resolving', 'fetching-manifest', 'verifying', 'complete'];
    const currentIndex = phaseOrder.indexOf(phase);
    const targetIndex = phaseOrder.indexOf(targetPhase);

    if (targetIndex < currentIndex) return 'complete';
    if (targetIndex === currentIndex) return 'active';
    return 'pending';
  };

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        {/* Header with icon and title */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="relative">
            <svg
              className="w-10 h-10 text-primary animate-pulse"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {isSingleFile ? 'Verifying Content' : 'Verifying Application'}
            </h2>
            <p className="text-foreground/60 font-mono text-sm">{identifier}</p>
          </div>
        </div>

        {/* Phase Indicators */}
        <div className="bg-card rounded-xl p-4 mb-4 border border-border/20">
          <PhaseRow
            status={getPhaseStatus('resolving')}
            label="Resolve identifier"
            detail={manifestTxId ? formatTxId(manifestTxId) : undefined}
          />
          <PhaseRow
            status={getPhaseStatus('fetching-manifest')}
            label="Fetch content"
            detail={progress.total > 1 ? `${progress.total} resources` : undefined}
          />
          <PhaseRow
            status={getPhaseStatus('verifying')}
            label={isSingleFile ? 'Verify content' : 'Verify resources'}
            detail={
              phase === 'verifying' || phase === 'complete'
                ? `${progress.current}/${progress.total}`
                : undefined
            }
            progress={phase === 'verifying' ? progressPercent : phase === 'complete' ? 100 : undefined}
          />
        </div>

        {/* Resource Log */}
        {!isSingleFile && recentResources.length > 0 && (
          <div className="bg-card rounded-xl p-4 mb-4 border border-border/20">
            <div className="text-xs text-foreground/60 mb-2 uppercase tracking-wide">Recent Activity</div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {recentResources.map((resource, index) => (
                <ResourceRow key={`${resource.path}-${index}`} path={resource.path} status={resource.status} />
              ))}
            </div>
          </div>
        )}

        {/* Metadata Footer */}
        <div className="flex items-center justify-center gap-4 text-xs text-foreground/50">
          {gateway && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              {formatGateway(gateway)}
            </span>
          )}
          {startTime && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatElapsed(elapsed)}
            </span>
          )}
        </div>

      </div>
    </div>
  );
}

interface PhaseRowProps {
  status: 'complete' | 'active' | 'pending';
  label: string;
  detail?: string;
  progress?: number;
}

function PhaseRow({ status, label, detail, progress }: PhaseRowProps) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-shrink-0 w-5 h-5">
        {status === 'complete' && (
          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
        {status === 'active' && <LoadingSpinner size="sm" />}
        {status === 'pending' && (
          <div className="w-5 h-5 rounded-full border-2 border-border/30" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm ${status === 'pending' ? 'text-foreground/50' : 'text-foreground'}`}>
            {label}
          </span>
          {detail && (
            <span className="text-xs font-mono text-foreground/60 truncate">{detail}</span>
          )}
        </div>

        {progress !== undefined && status === 'active' && (
          <div className="mt-1.5 w-full bg-card rounded-full h-1.5 overflow-hidden border border-border/20">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface ResourceRowProps {
  path: string;
  status: 'verified' | 'failed' | 'verifying';
}

function ResourceRow({ path, status }: ResourceRowProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {status === 'verified' && (
        <svg className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
      {status === 'failed' && (
        <svg className="w-3.5 h-3.5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {status === 'verifying' && <LoadingSpinner size="sm" />}
      <span className={`font-mono truncate ${status === 'failed' ? 'text-red-600' : 'text-foreground/60'}`}>
        {path}
      </span>
    </div>
  );
}
