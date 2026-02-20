import { useEffect, useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import type { InputType, RoutingStrategy } from '../types';
import { SLOW_THRESHOLD_MS, TIMEOUT_THRESHOLD_MS, MAX_GATEWAY_AUTO_RETRIES } from '../utils/constants';

interface RoutingLoadingScreenProps {
  identifier: string;
  inputType: InputType;
  routingStrategy: RoutingStrategy;
  preferredGateway?: string;
  startTime: number;
  onRetry: () => void;
  isCheckingHealth?: boolean;
  retryCount?: number;
  maxRetries?: number;
}

export function RoutingLoadingScreen({
  identifier,
  inputType,
  routingStrategy,
  preferredGateway,
  startTime,
  onRetry,
  isCheckingHealth,
  retryCount = 0,
  maxRetries = MAX_GATEWAY_AUTO_RETRIES,
}: RoutingLoadingScreenProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 100);
    return () => clearInterval(interval);
  }, [startTime]);

  const isSlow = elapsed >= SLOW_THRESHOLD_MS;
  const isTimedOut = elapsed >= TIMEOUT_THRESHOLD_MS;
  const isAutoRetrying = retryCount < maxRetries;

  const formatElapsed = (ms: number): string => {
    const seconds = ms / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    // Round total seconds first to avoid "1m 60s" edge case
    const totalSeconds = Math.round(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStrategyLabel = () => {
    switch (routingStrategy) {
      case 'fastest':
        return 'Finding fastest gateway';
      case 'preferred': {
        let hostname = 'preferred gateway';
        if (preferredGateway) {
          try {
            hostname = new URL(preferredGateway).hostname;
          } catch {
            hostname = preferredGateway;
          }
        }
        return `Connecting to ${hostname}`;
      }
      case 'roundRobin':
        return 'Selecting next gateway';
      default:
        return 'Selecting gateway';
    }
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className="max-w-md w-full mx-4">
        {/* Header with icon and title */}
        <div className="flex items-center justify-center gap-3 mb-6">
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
              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
            />
          </svg>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {isCheckingHealth ? 'Checking Gateway Health' : 'Resolving Content'}
            </h2>
            <p className="font-mono text-sm text-foreground/60">{identifier}</p>
          </div>
        </div>

        {/* Status */}
        <div className="bg-card rounded-xl p-4 border border-border/20 mb-4">
          <div className="flex items-center justify-center gap-2 text-sm text-foreground/80">
            <LoadingSpinner size="sm" />
            <span>{isCheckingHealth ? 'Verifying gateway availability...' : getStrategyLabel()}</span>
          </div>

          {inputType === 'arnsName' && !isCheckingHealth && (
            <p className="text-xs text-foreground/50 mt-2">
              Looking up ArNS name on AR.IO Network
            </p>
          )}
        </div>

        {/* Elapsed Time */}
        <div className="text-xs text-foreground/50 mb-4">
          Elapsed: {formatElapsed(elapsed)}
        </div>

        {/* Slow Warning */}
        {isSlow && !isTimedOut && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-amber-800">
              Taking longer than expected. Gateway may be slow.
            </p>
          </div>
        )}

        {/* Timeout / Retry */}
        {isTimedOut && !isAutoRetrying && (
          <div className="space-y-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">
                Connection timed out after {maxRetries} attempts.
              </p>
            </div>
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-full font-medium hover:opacity-90 transition-opacity"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Retry with Different Gateway
            </button>
          </div>
        )}

        {isAutoRetrying && retryCount > 0 && (
          <div className="text-xs text-foreground/50">
            Auto-retry {retryCount}/{maxRetries}
          </div>
        )}
      </div>
    </div>
  );
}
