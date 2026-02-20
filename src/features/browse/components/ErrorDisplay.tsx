import { LoadingSpinner } from './LoadingSpinner';

interface ErrorDisplayProps {
  error: Error | { message: string };
  onRetry?: () => void;
  isAutoRetrying?: boolean;
  retryAttempt?: number;
  maxRetries?: number;
}

export function ErrorDisplay({
  error,
  onRetry,
  isAutoRetrying,
  retryAttempt = 0,
  maxRetries = 3,
}: ErrorDisplayProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="max-w-md w-full mx-4 p-6 bg-card rounded-2xl border border-border/20 shadow-sm text-center">
        <div className="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-xl flex items-center justify-center">
          <svg
            className="w-6 h-6 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-2">
          {isAutoRetrying ? 'Retrying...' : 'Error Loading Content'}
        </h3>

        <p className="text-sm text-foreground/60 mb-4">
          {error.message || 'An unexpected error occurred'}
        </p>

        {isAutoRetrying && (
          <div className="flex items-center justify-center gap-2 mb-4 text-sm text-foreground/60">
            <LoadingSpinner size="sm" />
            <span>
              Attempt {retryAttempt + 1} of {maxRetries}...
            </span>
          </div>
        )}

        {onRetry && !isAutoRetrying && (
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
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
