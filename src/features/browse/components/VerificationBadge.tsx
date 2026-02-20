import { useState, useEffect, useRef } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

export type VerificationState =
  | 'idle'           // No verification in progress
  | 'verifying'      // Verification in progress
  | 'ready'          // Manifest verified, serving on-demand (lazy verification)
  | 'verified'       // All resources verified successfully
  | 'failed'         // At least one resource failed verification
  | 'partial';       // Some verified, some still pending

export interface VerificationStats {
  total: number;
  verified: number;
  failed: number;
  currentResource?: string;
  failedResources?: string[];
}

interface VerificationBadgeProps {
  state: VerificationState;
  stats: VerificationStats;
  strictMode: boolean;
  onDetailsClick?: () => void;
}

export function VerificationBadge({
  state,
  stats,
  strictMode,
  onDetailsClick,
}: VerificationBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

  if (state === 'idle') return null;

  const getStateConfig = () => {
    switch (state) {
      case 'verifying':
        return {
          icon: <LoadingSpinner size="sm" className="text-white" />,
          bgColor: 'bg-primary',
          textColor: 'text-white',
          label: 'Verifying...',
          description: `Checking ${stats.total} resource${stats.total !== 1 ? 's' : ''}`,
        };
      case 'ready':
        return {
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          ),
          bgColor: 'bg-emerald-600',
          textColor: 'text-white',
          label: 'Verified',
          description: `Manifest verified, ${stats.verified}/${stats.total} resources loaded`,
        };
      case 'verified':
        return {
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          ),
          bgColor: 'bg-emerald-600',
          textColor: 'text-white',
          label: 'Verified',
          description: `${stats.verified} resource${stats.verified !== 1 ? 's' : ''} verified`,
        };
      case 'failed':
        return {
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          bgColor: 'bg-red-600',
          textColor: 'text-white',
          label: 'Verification Failed',
          description: `${stats.failed} of ${stats.total} failed`,
        };
      case 'partial':
        return {
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          bgColor: 'bg-amber-500',
          textColor: 'text-white',
          label: 'Partial Verification',
          description: `${stats.verified} verified, ${stats.failed} failed`,
        };
      default:
        return null;
    }
  };

  const config = getStateConfig();
  if (!config) return null;

  // For failed states, show text to make the warning clear
  const showLabel = state === 'failed' || state === 'partial';

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-1.5 p-1.5 ${showLabel ? 'pr-2' : ''} rounded-lg ${config.bgColor} ${config.textColor} text-xs font-medium hover:opacity-90 transition-opacity`}
        title={config.description}
      >
        {config.icon}
        {showLabel && (
          <span className="hidden sm:inline">{state === 'failed' ? 'Failed' : 'Partial'}</span>
        )}
        <svg
          className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="absolute top-full right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-card border border-border/20 rounded-xl shadow-lg p-4 z-50">
          <div className="text-sm text-foreground mb-3">
            <div className="font-semibold mb-2">Verification Details</div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-foreground/60">Total Resources:</span>
                <span className="font-mono">{stats.total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-foreground/60">Verified:</span>
                <span className="font-mono text-emerald-600">{stats.verified}</span>
              </div>
              {stats.failed > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-foreground/60">Failed:</span>
                  <span className="font-mono text-red-600">{stats.failed}</span>
                </div>
              )}
            </div>

            {stats.total > 0 && (
              <div className="mt-3">
                <div className="w-full bg-card rounded-full h-2 overflow-hidden border border-border/20">
                  <div className="h-full flex">
                    <div
                      className="bg-emerald-600 transition-all duration-300"
                      style={{ width: `${Math.min((stats.verified / stats.total) * 100, 100)}%` }}
                    />
                    <div
                      className="bg-red-600 transition-all duration-300"
                      style={{ width: `${Math.min((stats.failed / stats.total) * 100, 100 - Math.min((stats.verified / stats.total) * 100, 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {state === 'verifying' && stats.currentResource && (
              <div className="mt-3 pt-3 border-t border-border/20">
                <div className="text-xs text-foreground/60">Currently verifying:</div>
                <div className="text-xs font-mono text-foreground truncate mt-1">
                  {stats.currentResource}
                </div>
              </div>
            )}

            {stats.failedResources && stats.failedResources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/20">
                <div className="text-xs text-foreground/60 mb-2">Failed Resources:</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {stats.failedResources.map((path, index) => (
                    <div key={index} className="flex items-center gap-1.5 text-xs">
                      <svg className="w-3 h-3 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="font-mono text-red-600 truncate" title={path}>
                        {path}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {strictMode && state === 'failed' && (
              <div className="mt-3 pt-3 border-t border-border/20">
                <div className="text-xs text-red-600">
                  Content blocked due to strict mode. Verification must pass to view content.
                </div>
              </div>
            )}

            {!strictMode && state === 'failed' && (
              <div className="mt-3 pt-3 border-t border-border/20">
                <div className="text-xs text-amber-600">
                  Content displayed despite verification failure. Enable strict mode in settings for maximum security.
                </div>
              </div>
            )}
          </div>

          {onDetailsClick && (
            <button
              onClick={onDetailsClick}
              className="w-full mt-2 px-3 py-1.5 text-xs text-primary hover:text-primary/80 border border-border/20 rounded-lg hover:bg-card/80 transition-colors"
            >
              View Full Report
            </button>
          )}

          <a
            href="https://docs.ar.io/learn/wayfinder/"
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-2 text-center text-xs text-foreground/50 hover:text-primary transition-colors"
          >
            Learn more about Wayfinder
          </a>
        </div>
      )}
    </div>
  );
}
