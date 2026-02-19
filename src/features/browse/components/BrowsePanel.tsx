import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Minimize2, Settings } from 'lucide-react';
import { WayfinderProvider } from '@ar.io/wayfinder-react';
import {
  createRoutingStrategy,
  TrustedPeersGatewaysProvider,
  SimpleCacheGatewaysProvider,
  SimpleCacheRoutingStrategy,
  StaticRoutingStrategy,
  type RoutingOption,
} from '@ar.io/wayfinder-core';
import { useStore } from '@/store/useStore';
import { BrowseSearchBar } from './BrowseSearchBar';
import { BrowseContentViewer } from './BrowseContentViewer';
import { BrowseSettingsFlyout } from './BrowseSettingsFlyout';
import {
  VerificationBadge,
  type VerificationState,
  type VerificationStats,
} from './VerificationBadge';
import { VerificationBlockedModal } from './VerificationBlockedModal';
import { VerificationLoadingScreen } from './VerificationLoadingScreen';
import { swMessenger } from '../utils/serviceWorkerMessaging';
import { getTrustedGateways, getRoutingGateways } from '../utils/trustedGateways';
import { gatewayHealth } from '../utils/gatewayHealth';
import type { VerificationEvent } from '../service-worker/types';

interface WayfinderWrapperProps {
  children: React.ReactNode;
  gatewayRefreshCounter: number;
}

function WayfinderWrapper({ children, gatewayRefreshCounter }: WayfinderWrapperProps) {
  const browseConfig = useStore((state) => state.browseConfig);

  const wayfinderConfig = useMemo(() => {
    const getHostGateway = (): URL | null => {
      if (typeof window === 'undefined') return null;

      const hostname = window.location.hostname;

      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('192.168')) {
        return null;
      }

      const parts = hostname.split('.');

      // Strip 'console' subdomain if present to get the gateway
      if (parts[0] === 'console' && parts.length > 1) {
        const gateway = parts.slice(1).join('.');
        return new URL(`https://${gateway}`);
      }

      return new URL(`https://${hostname}`);
    };

    const resilientProvider = {
      async getGateways(): Promise<URL[]> {
        const peersEndpoints: string[] = ['https://turbo-gateway.com'];

        const hostGateway = getHostGateway();
        if (hostGateway) {
          peersEndpoints.push(hostGateway.toString());
        }

        for (const trustedGateway of peersEndpoints) {
          try {
            const provider = new TrustedPeersGatewaysProvider({ trustedGateway });
            const gateways = await provider.getGateways();
            if (gateways && gateways.length > 0) {
              return gateways;
            }
          } catch {
            // Try next endpoint
          }
        }

        if (hostGateway) {
          return [hostGateway];
        }

        return [new URL('https://turbo-gateway.com')];
      },
    };

    const limitedProvider = {
      async getGateways() {
        const allGateways = await resilientProvider.getGateways();

        const gatewayUrls = allGateways.map(g => g.toString());
        let healthyUrls = gatewayHealth.filterHealthy(gatewayUrls);

        if (healthyUrls.length === 0) {
          console.log('[BrowsePanel] All gateways marked unhealthy, clearing cache');
          gatewayHealth.clear();
          healthyUrls = gatewayUrls;
        }

        // Shuffle using Fisher-Yates algorithm
        const shuffled = [...healthyUrls];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        return shuffled.slice(0, Math.min(20, shuffled.length)).map(url => new URL(url));
      },
    };

    const gatewaysProvider = new SimpleCacheGatewaysProvider({
      gatewaysProvider: limitedProvider,
      ttlSeconds: 3 * 60,
    });

    let routingStrategy;

    if (browseConfig.routingStrategy === 'preferred') {
      const preferredGatewayRaw = browseConfig.preferredGateway?.trim();
      const preferredGateway = preferredGatewayRaw && preferredGatewayRaw.length > 0
        ? preferredGatewayRaw
        : 'https://turbo-gateway.com';

      routingStrategy = new StaticRoutingStrategy({
        gateway: preferredGateway,
      });
    } else {
      const strategyName: RoutingOption =
        browseConfig.routingStrategy === 'roundRobin' ? 'balanced' : browseConfig.routingStrategy;

      const baseStrategy = createRoutingStrategy({
        strategy: strategyName,
        gatewaysProvider,
      });

      // Wrap with cache to avoid re-pinging on every request (5 min TTL)
      // This is especially important for 'fastest' which pings all gateways
      routingStrategy = new SimpleCacheRoutingStrategy({
        routingStrategy: baseStrategy,
        ttlSeconds: 5 * 60, // 5 minutes
      });
    }

    return {
      routingSettings: {
        strategy: routingStrategy,
      },
      telemetrySettings: {
        enabled: false,
      },
      verificationSettings: {
        enabled: false,
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browseConfig.routingStrategy, browseConfig.preferredGateway, gatewayRefreshCounter]);

  // Only use gatewayRefreshCounter in key - settings changes shouldn't reset verification state
  const routingKey = `browse-${gatewayRefreshCounter}`;

  return (
    <WayfinderProvider key={routingKey} {...wayfinderConfig}>
      {children}
    </WayfinderProvider>
  );
}

interface BrowsePanelContentProps {
  setGatewayRefreshCounter: (fn: (prev: number) => number) => void;
}

function BrowsePanelContent({ setGatewayRefreshCounter }: BrowsePanelContentProps) {
  const browseConfig = useStore((state) => state.browseConfig);

  const [searchInput, setSearchInput] = useState('');
  const [isSearched, setIsSearched] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchCounter, setSearchCounter] = useState(0);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [swReady, setSwReady] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-retry if we were waiting for connection
      if (searchInput && isSearched) {
        setSearchCounter((prev) => prev + 1);
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [searchInput, isSearched]);

  // Verification state tracking
  const [verificationState, setVerificationState] = useState<VerificationState>('idle');
  const [verificationStats, setVerificationStats] = useState<VerificationStats>({
    total: 0,
    verified: 0,
    failed: 0,
    failedResources: [],
  });
  const [verificationError, setVerificationError] = useState<string | undefined>();
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [userBypassedVerification, setUserBypassedVerification] = useState(false);

  // Additional verification loading screen state
  const [verificationPhase, setVerificationPhase] = useState<'idle' | 'resolving' | 'fetching-manifest' | 'verifying' | 'complete'>('idle');
  const [routingGateway, setRoutingGateway] = useState<string | null>(null);
  const [verificationStartTime, setVerificationStartTime] = useState<number | null>(null);
  const [manifestTxId, setManifestTxId] = useState<string | null>(null);
  const [isSingleFileContent, setIsSingleFileContent] = useState(false);
  const [recentVerifiedResources, setRecentVerifiedResources] = useState<Array<{ path: string; status: 'verified' | 'failed' | 'verifying' }>>([]);

  // Initialize from URL query parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    if (query && query.trim()) {
      setSearchInput(query.trim());
      setIsSearched(true);
    }

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const query = params.get('q');
      if (query && query.trim()) {
        setSearchInput(query.trim());
        setIsSearched(true);
      } else {
        setSearchInput('');
        setIsSearched(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Track previous verification enabled state to detect when it's toggled OFF
  const prevVerificationEnabled = useRef(browseConfig.verificationEnabled);

  // Initialize service worker for verification
  useEffect(() => {
    async function initServiceWorker() {
      if (!browseConfig.verificationEnabled) {
        // If verification was just disabled, cancel any in-progress verification
        if (prevVerificationEnabled.current && searchInput) {
          swMessenger.clearVerification(searchInput).catch(() => {
            // Non-critical
          });
        }
        prevVerificationEnabled.current = false;
        setSwReady(false);
        return;
      }

      prevVerificationEnabled.current = true;

      try {
        if (!swMessenger.isControlling()) {
          await new Promise(resolve => setTimeout(resolve, 100));

          if (!swMessenger.isControlling()) {
            console.warn('[Browse] Controller not ready yet - will retry on next render');
            setSwReady(false);
            return;
          }
        }

        const trustedGateways = await getTrustedGateways(browseConfig.trustedGatewayCount);
        const routingGateways = await getRoutingGateways();

        await swMessenger.initializeWayfinder({
          trustedGateways: trustedGateways.map(gw => gw.url),
          routingGateways: routingGateways.map(u => u.toString()),
          routingStrategy: browseConfig.routingStrategy,
          preferredGateway: browseConfig.preferredGateway,
          enabled: true,
          strict: browseConfig.strictVerification,
          concurrency: browseConfig.verificationConcurrency,
          verificationMethod: browseConfig.verificationMethod,
        });

        setSwReady(true);
      } catch (error) {
        console.error('[Browse] SW initialization failed:', error);
        setSwReady(false);
      }
    }

    initServiceWorker();
  }, [browseConfig.verificationEnabled, browseConfig.routingStrategy, browseConfig.preferredGateway, browseConfig.strictVerification, browseConfig.verificationConcurrency, browseConfig.verificationMethod, browseConfig.trustedGatewayCount, searchInput]);

  // Cleanup: cancel verification when leaving the page
  useEffect(() => {
    return () => {
      // On unmount, cancel any in-progress verification
      if (searchInput && browseConfig.verificationEnabled) {
        swMessenger.clearVerification(searchInput).catch(() => {
          // Non-critical - component is unmounting anyway
        });
      }
    };
  }, [searchInput, browseConfig.verificationEnabled]);

  // Track if settings changed (not first mount) to restart verification
  const isFirstMount = useRef(true);
  const prevSettingsRef = useRef({
    routingStrategy: browseConfig.routingStrategy,
    preferredGateway: browseConfig.preferredGateway,
    strictVerification: browseConfig.strictVerification,
    verificationConcurrency: browseConfig.verificationConcurrency,
    verificationMethod: browseConfig.verificationMethod,
    trustedGatewayCount: browseConfig.trustedGatewayCount,
  });

  // Restart verification when settings change during active search
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    const prevSettings = prevSettingsRef.current;
    const settingsChanged =
      prevSettings.routingStrategy !== browseConfig.routingStrategy ||
      prevSettings.preferredGateway !== browseConfig.preferredGateway ||
      prevSettings.strictVerification !== browseConfig.strictVerification ||
      prevSettings.verificationConcurrency !== browseConfig.verificationConcurrency ||
      prevSettings.verificationMethod !== browseConfig.verificationMethod ||
      prevSettings.trustedGatewayCount !== browseConfig.trustedGatewayCount;

    // Update ref for next comparison
    prevSettingsRef.current = {
      routingStrategy: browseConfig.routingStrategy,
      preferredGateway: browseConfig.preferredGateway,
      strictVerification: browseConfig.strictVerification,
      verificationConcurrency: browseConfig.verificationConcurrency,
      verificationMethod: browseConfig.verificationMethod,
      trustedGatewayCount: browseConfig.trustedGatewayCount,
    };

    // If settings changed and we have an active search, restart
    if (settingsChanged && isSearched && searchInput) {
      // Reset verification state
      setVerificationState('idle');
      setVerificationStats({ total: 0, verified: 0, failed: 0, failedResources: [] });
      setVerificationError(undefined);
      setShowBlockedModal(false);
      setUserBypassedVerification(false);
      setVerificationPhase('idle');
      setRoutingGateway(null);
      setVerificationStartTime(null);
      setManifestTxId(null);
      setIsSingleFileContent(false);
      setRecentVerifiedResources([]);
      setResolvedUrl(null);

      // Clear old verification and trigger new search
      if (browseConfig.verificationEnabled) {
        swMessenger.clearVerification(searchInput).catch(() => {});
      }

      // Increment counters to force re-fetch
      setGatewayRefreshCounter((prev) => prev + 1);
      setSearchCounter((prev) => prev + 1);
    }
  }, [
    browseConfig.routingStrategy,
    browseConfig.preferredGateway,
    browseConfig.strictVerification,
    browseConfig.verificationConcurrency,
    browseConfig.verificationMethod,
    browseConfig.trustedGatewayCount,
    isSearched,
    searchInput,
    browseConfig.verificationEnabled,
    setGatewayRefreshCounter,
  ]);

  // Listen for service worker verification events
  useEffect(() => {
    if (!browseConfig.verificationEnabled) return;

    const handleSwMessage = (event: MessageEvent) => {
      const { type, event: verificationEvent } = event.data;
      if (type === 'VERIFICATION_EVENT' && verificationEvent) {
        const vEvent = verificationEvent as VerificationEvent;

        if (vEvent.type === 'routing-gateway' && vEvent.gatewayUrl) {
          const isTxId = /^[A-Za-z0-9_-]{43}$/.test(vEvent.identifier);
          const gatewayHost = new URL(vEvent.gatewayUrl).host;
          const fullUrl = isTxId
            ? `${vEvent.gatewayUrl}/${vEvent.identifier}`
            : `https://${vEvent.identifier}.${gatewayHost}`;
          setResolvedUrl(fullUrl);
          setRoutingGateway(vEvent.gatewayUrl);
          setVerificationPhase('fetching-manifest');
        }

        if (vEvent.type === 'verification-started') {
          setVerificationState('verifying');
          setVerificationStats({
            total: vEvent.progress?.total || 1,
            verified: 0,
            failed: 0,
          });
          setVerificationError(undefined);
          setShowBlockedModal(false);
          setUserBypassedVerification(false);
          setVerificationPhase('resolving');
          setVerificationStartTime(Date.now());
          setManifestTxId(null);
          setIsSingleFileContent(false);
          setRecentVerifiedResources([]);
        }

        if (vEvent.type === 'verification-progress' && vEvent.progress) {
          const { total, current } = vEvent.progress;
          setVerificationStats(prev => ({
            ...prev,
            total,
            verified: current,
            currentResource: vEvent.resourcePath,
          }));
          if (vEvent.resourcePath) {
            const resourcePath = vEvent.resourcePath;
            setRecentVerifiedResources(prev => {
              const newList = [...prev.filter(r => r.path !== resourcePath)];
              newList.push({ path: resourcePath, status: 'verified' });
              return newList.slice(-8);
            });
          }
        }

        if (vEvent.type === 'manifest-loaded' && vEvent.progress) {
          const { total } = vEvent.progress;
          setVerificationStats(prev => ({
            ...prev,
            total,
          }));
          setManifestTxId(vEvent.manifestTxId || null);
          setIsSingleFileContent(vEvent.isSingleFile ?? total === 1);
          setVerificationPhase('verifying');
        }

        if (vEvent.type === 'verification-complete') {
          if (vEvent.progress) {
            const { total, current } = vEvent.progress;
            setVerificationStats(prev => ({
              ...prev,
              total,
              verified: current,
            }));
          }

          if (vEvent.error) {
            const verifiedCount = vEvent.progress?.current ?? 0;
            setVerificationState(verifiedCount > 0 ? 'partial' : 'failed');
            setVerificationError(vEvent.error);

            if (browseConfig.strictVerification && !userBypassedVerification) {
              setShowBlockedModal(true);
            }
          } else {
            setVerificationState('verified');
          }
          setVerificationPhase('complete');
        }

        if (vEvent.type === 'verification-failed') {
          if (vEvent.resourcePath) {
            const resourcePath = vEvent.resourcePath;
            setVerificationStats(prev => ({
              ...prev,
              failed: prev.failed + 1,
              failedResources: [...(prev.failedResources || []), resourcePath],
            }));
            setRecentVerifiedResources(prev => {
              const newList = [...prev.filter(r => r.path !== resourcePath)];
              newList.push({ path: resourcePath, status: 'failed' });
              return newList.slice(-8);
            });
          } else {
            setVerificationError(vEvent.error);
            setVerificationState('failed');
            setVerificationPhase('complete');

            if (browseConfig.strictVerification && !userBypassedVerification) {
              setShowBlockedModal(true);
            }
          }
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, [browseConfig.verificationEnabled, browseConfig.strictVerification, userBypassedVerification]);

  const handleSearch = useCallback(async (input: string) => {
    setSearchInput(input);
    setIsSearched(true);
    setIsCollapsed(false);
    setRetryAttempts(0);
    setSearchCounter((prev) => prev + 1);

    // Reset verification state
    setVerificationState('idle');
    setVerificationStats({ total: 0, verified: 0, failed: 0, failedResources: [] });
    setVerificationError(undefined);
    setShowBlockedModal(false);
    setUserBypassedVerification(false);
    setVerificationPhase('idle');
    setRoutingGateway(null);
    setVerificationStartTime(null);
    setManifestTxId(null);
    setIsSingleFileContent(false);
    setRecentVerifiedResources([]);

    if (browseConfig.verificationEnabled && input) {
      try {
        await swMessenger.clearVerification(input);
      } catch {
        // Non-critical
      }
    }

    // Update URL with search query
    const url = new URL(window.location.href);
    url.searchParams.set('q', input);
    window.history.pushState({}, '', url.toString());
  }, [browseConfig.verificationEnabled]);

  const handleRetry = useCallback(async () => {
    const newAttempts = retryAttempts + 1;
    setRetryAttempts(newAttempts);

    // Reset verification state
    setVerificationState('idle');
    setVerificationStats({ total: 0, verified: 0, failed: 0, failedResources: [] });
    setVerificationError(undefined);
    setShowBlockedModal(false);
    setUserBypassedVerification(false);
    setVerificationPhase('idle');
    setRoutingGateway(null);
    setVerificationStartTime(null);
    setManifestTxId(null);
    setIsSingleFileContent(false);
    setRecentVerifiedResources([]);

    if (browseConfig.verificationEnabled && searchInput) {
      try {
        await swMessenger.clearVerification(searchInput);
      } catch {
        // Non-critical
      }
    }

    setGatewayRefreshCounter((prev) => prev + 1);
    setSearchCounter((prev) => prev + 1);
  }, [retryAttempts, setGatewayRefreshCounter, browseConfig.verificationEnabled, searchInput]);

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const handleUrlResolved = useCallback((url: string | null) => {
    setResolvedUrl(url);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleGoBack = useCallback(() => {
    setSearchInput('');
    setIsSearched(false);
    setShowBlockedModal(false);
    setVerificationState('idle');
    setVerificationStats({ total: 0, verified: 0, failed: 0, failedResources: [] });
    setVerificationError(undefined);
    setUserBypassedVerification(false);

    const url = new URL(window.location.href);
    url.searchParams.delete('q');
    window.history.pushState({}, '', url.toString());
  }, []);

  const handleProceedAnyway = useCallback(() => {
    setUserBypassedVerification(true);
    setShowBlockedModal(false);
  }, []);

  const shouldBlockContent = browseConfig.verificationEnabled &&
    browseConfig.strictVerification &&
    (verificationState === 'failed' || verificationState === 'partial') &&
    !userBypassedVerification;

  const verificationBadgeElement = browseConfig.verificationEnabled &&
    isSearched &&
    searchInput &&
    verificationState !== 'idle' &&
    verificationState !== 'verifying' ? (
      <VerificationBadge
        state={verificationState}
        stats={verificationStats}
        strictMode={browseConfig.strictVerification}
      />
    ) : undefined;

  // Render the content viewer (iframe or verification states)
  const renderContentViewer = () => {
    // Show offline message when network is unavailable
    if (!isOnline) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-card">
          <div className="text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-xl flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
              </svg>
            </div>
            <div className="text-xl font-semibold text-foreground mb-2">
              You&apos;re Offline
            </div>
            <div className="text-foreground/60 max-w-md mb-4">
              Unable to browse Arweave content without an internet connection.
              Content will automatically load when you&apos;re back online.
            </div>
            <div className="text-sm text-foreground/40">
              Waiting for connection...
            </div>
          </div>
        </div>
      );
    }

    if (browseConfig.verificationEnabled && swReady) {
      return (
        <>
          {(verificationState === 'verifying' || verificationState === 'idle') && (
            <VerificationLoadingScreen
              identifier={searchInput}
              phase={verificationPhase === 'idle' || verificationPhase === 'complete' ? 'resolving' : verificationPhase}
              manifestTxId={manifestTxId || undefined}
              gateway={routingGateway || undefined}
              progress={{
                current: verificationStats.verified,
                total: verificationStats.total,
                failed: verificationStats.failed,
              }}
              recentResources={recentVerifiedResources}
              startTime={verificationStartTime}
              isSingleFile={isSingleFileContent}
            />
          )}

          {!shouldBlockContent && (
            <iframe
              key={`${searchInput}-${searchCounter}`}
              src={`/ar-proxy/${searchInput}/`}
              className={`w-full h-full border-0 bg-white ${
                verificationState === 'verifying' || verificationState === 'idle'
                  ? 'invisible absolute'
                  : ''
              }`}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
              title={`Verified content for ${searchInput}`}
            />
          )}

          {shouldBlockContent && (
            <div className="w-full h-full flex items-center justify-center bg-card">
              <div className="text-center p-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="text-xl font-semibold text-foreground mb-2">
                  Content Blocked
                </div>
                <div className="text-foreground/60 max-w-md">
                  Verification failed and strict mode is enabled.
                  Use the dialog to retry, go back, or proceed at your own risk.
                </div>
              </div>
            </div>
          )}
        </>
      );
    }

    return (
      <BrowseContentViewer
        key={`${searchInput}-${searchCounter}`}
        input={searchInput}
        onRetry={handleRetry}
        onUrlResolved={handleUrlResolved}
        retryAttempts={retryAttempts}
      />
    );
  };

  // When showing results, use negative margin to reclaim Layout padding for more iframe space
  const isShowingResults = isSearched && searchInput;

  // Fullscreen mode uses CSS fixed positioning instead of portal to avoid iframe reload
  const isFullscreen = isShowingResults && isCollapsed;

  return (
    <div className={isShowingResults && !isFullscreen ? '-mt-6 sm:-mt-8 -mb-6 sm:-mb-8' : ''}>
      {/* Normal mode: show search bar */}
      {!isFullscreen && (
        <BrowseSearchBar
          onSearch={handleSearch}
          isSearched={isSearched}
          currentInput={searchInput}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
          onOpenSettings={handleOpenSettings}
          verificationBadge={verificationBadgeElement}
        />
      )}

      {isShowingResults && (
        <div
          className={isFullscreen
            ? 'fixed inset-0 z-[100] bg-white flex flex-col'
            : ''
          }
        >
          {/* Fullscreen toolbar */}
          {isFullscreen && (
            <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2 pointer-events-auto">
                <button
                  type="button"
                  onClick={handleToggleCollapse}
                  className="p-2 bg-foreground/90 text-white rounded-lg hover:bg-foreground transition-colors shadow-lg"
                  title="Exit fullscreen"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <div className="px-3 py-1.5 bg-white/95 backdrop-blur-sm rounded-lg border border-border/30 shadow-lg flex items-center gap-2">
                  <span className="text-sm font-mono text-foreground/50">ar://</span>
                  <span className="text-sm font-mono text-foreground">{searchInput}</span>
                  {verificationBadgeElement}
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenSettings}
                className="p-2 bg-white/95 backdrop-blur-sm text-foreground/60 rounded-lg hover:bg-white hover:text-foreground transition-colors border border-border/30 shadow-lg pointer-events-auto"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Content viewer - same element in both modes to prevent reload */}
          <div
            className={isFullscreen ? 'flex-1 overflow-hidden' : 'overflow-hidden rounded-2xl border border-border/20'}
            style={isFullscreen ? undefined : { height: 'calc(100vh - 115px)' }}
            key="content-viewer-container"
          >
            {renderContentViewer()}
          </div>

          {/* Gateway URL below iframe (normal mode only) */}
          {!isFullscreen && resolvedUrl && (
            <div className="h-5 px-3 flex items-center justify-end">
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground/25 hover:text-foreground/40 text-[11px] font-mono"
                title={resolvedUrl}
              >
                {new URL(resolvedUrl).hostname}
              </a>
            </div>
          )}
        </div>
      )}

      {showBlockedModal && (
        <VerificationBlockedModal
          identifier={searchInput}
          errorMessage={verificationError}
          failedCount={verificationStats.failed}
          totalCount={verificationStats.total}
          onGoBack={handleGoBack}
          onRetry={handleRetry}
          onProceedAnyway={handleProceedAnyway}
        />
      )}

      <BrowseSettingsFlyout isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}

export default function BrowsePanel() {
  const [gatewayRefreshCounter, setGatewayRefreshCounter] = useState(0);

  return (
    <WayfinderWrapper gatewayRefreshCounter={gatewayRefreshCounter}>
      <BrowsePanelContent setGatewayRefreshCounter={setGatewayRefreshCounter} />
    </WayfinderWrapper>
  );
}
