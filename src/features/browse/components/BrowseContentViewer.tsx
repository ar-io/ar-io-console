import { useEffect, useMemo, useState, memo, useRef } from 'react';
import { useWayfinderUrl } from '@ar.io/wayfinder-react';
import { RoutingLoadingScreen } from './RoutingLoadingScreen';
import { ErrorDisplay } from './ErrorDisplay';
import { detectInputType } from '../utils/detectInputType';
import { checkGatewayHealth } from '../utils/gatewayHealthCheck';
import { MAX_GATEWAY_AUTO_RETRIES } from '../utils/constants';
import { useStore } from '@/store/useStore';

interface BrowseContentViewerProps {
  input: string;
  onRetry: () => void;
  onUrlResolved: (url: string | null) => void;
  retryAttempts?: number;
}

export const BrowseContentViewer = memo(function BrowseContentViewer({
  input,
  onRetry,
  onUrlResolved,
  retryAttempts = 0,
}: BrowseContentViewerProps) {
  const inputType = detectInputType(input);
  const hasAutoRetried = useRef(false);
  const browseConfig = useStore((state) => state.browseConfig);

  const [mountTime] = useState(() => Date.now());
  const [healthCheckPassed, setHealthCheckPassed] = useState(false);
  const healthCheckStarted = useRef(false);
  const isMounted = useRef(true);

  // Track mount status to prevent state updates after unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const params = useMemo(
    () => (inputType === 'txId' ? { txId: input } : { arnsName: input }),
    [inputType, input]
  );

  const { resolvedUrl, isLoading, error } = useWayfinderUrl(params);

  // Pre-flight health check
  useEffect(() => {
    if (!resolvedUrl || isLoading || healthCheckStarted.current) {
      return;
    }

    healthCheckStarted.current = true;

    checkGatewayHealth(resolvedUrl).then((result) => {
      // Don't update state if component unmounted during async check
      if (!isMounted.current) return;

      if (result.healthy) {
        console.log(`[ContentViewer] Gateway healthy (${result.latencyMs}ms)`);
        setHealthCheckPassed(true);
      } else {
        console.log(`[ContentViewer] Gateway unhealthy: ${result.error}`);
        if (retryAttempts < MAX_GATEWAY_AUTO_RETRIES) {
          console.log(`[ContentViewer] Health check failed, retrying with different gateway (attempt ${retryAttempts + 1}/${MAX_GATEWAY_AUTO_RETRIES})`);
          onRetry();
        } else {
          setHealthCheckPassed(true);
        }
      }
    });
  }, [resolvedUrl, isLoading, retryAttempts, onRetry]);

  // Notify parent when URL is resolved AND health check passed
  useEffect(() => {
    if (healthCheckPassed && resolvedUrl) {
      onUrlResolved(resolvedUrl);
    } else if (!resolvedUrl) {
      onUrlResolved(null);
    }
  }, [resolvedUrl, healthCheckPassed, onUrlResolved]);

  const isCheckingHealth = !!resolvedUrl && !isLoading && !healthCheckPassed;

  // Auto-retry logic for useWayfinderUrl errors with exponential backoff
  useEffect(() => {
    if (error && !isLoading && retryAttempts < MAX_GATEWAY_AUTO_RETRIES && !hasAutoRetried.current) {
      const isGatewayError =
        error.message.toLowerCase().includes('gateway') ||
        error.message.toLowerCase().includes('network') ||
        error.message.toLowerCase().includes('failed to fetch') ||
        error.message.toLowerCase().includes('timeout') ||
        error.message.toLowerCase().includes('offline');

      if (isGatewayError) {
        hasAutoRetried.current = true;
        // Exponential backoff: 500ms, 1s, 2s (with jitter to avoid thundering herd)
        const baseDelay = 500 * Math.pow(2, retryAttempts);
        const jitter = Math.random() * 200; // Add 0-200ms jitter
        const delay = baseDelay + jitter;

        const timeoutId = setTimeout(() => {
          console.log(`Auto-retrying with fresh gateways (attempt ${retryAttempts + 1}/${MAX_GATEWAY_AUTO_RETRIES}, delay: ${Math.round(delay)}ms)...`);
          onRetry();
        }, delay);

        return () => clearTimeout(timeoutId);
      }
    }

    if (!error) {
      hasAutoRetried.current = false;
    }
  }, [error, isLoading, retryAttempts, onRetry]);

  // Show loading screen during resolution or health check
  if (isLoading || isCheckingHealth) {
    return (
      <RoutingLoadingScreen
        identifier={input}
        inputType={inputType}
        routingStrategy={browseConfig.routingStrategy}
        preferredGateway={browseConfig.preferredGateway}
        startTime={mountTime}
        onRetry={onRetry}
        isCheckingHealth={isCheckingHealth}
        retryCount={retryAttempts}
        maxRetries={MAX_GATEWAY_AUTO_RETRIES}
      />
    );
  }

  if (error) {
    const showRetryButton = retryAttempts >= MAX_GATEWAY_AUTO_RETRIES;
    const isAutoRetrying = retryAttempts < MAX_GATEWAY_AUTO_RETRIES;

    return (
      <ErrorDisplay
        error={error}
        onRetry={showRetryButton ? onRetry : undefined}
        isAutoRetrying={isAutoRetrying}
        retryAttempt={retryAttempts}
        maxRetries={MAX_GATEWAY_AUTO_RETRIES}
      />
    );
  }

  if (!resolvedUrl || !healthCheckPassed) {
    return (
      <div className="flex items-center justify-center h-full text-foreground/60">
        No content available
      </div>
    );
  }

  return (
    <iframe
      src={resolvedUrl}
      className="w-full h-full border-0 bg-white"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      title={`Content for ${input}`}
    />
  );
});
