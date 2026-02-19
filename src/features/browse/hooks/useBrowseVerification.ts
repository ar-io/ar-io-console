import { useState, useEffect, useCallback } from 'react';
import { useBrowseConfig } from './useBrowseConfig';
import type { VerificationEvent } from '../service-worker/types';

export type VerificationPhase = 'idle' | 'resolving' | 'fetching-manifest' | 'verifying' | 'complete';
export type VerificationStatus = 'idle' | 'verifying' | 'verified' | 'partial' | 'failed';

export interface VerificationStats {
  total: number;
  verified: number;
  failed: number;
  failedResources?: string[];
  currentResource?: string;
}

export interface RecentResource {
  path: string;
  status: 'verified' | 'failed' | 'verifying';
}

interface UseBrowseVerificationResult {
  status: VerificationStatus;
  phase: VerificationPhase;
  stats: VerificationStats;
  error: string | undefined;
  gateway: string | null;
  manifestTxId: string | null;
  startTime: number | null;
  isSingleFile: boolean;
  recentResources: RecentResource[];
  reset: () => void;
}

/**
 * Hook for tracking verification state from service worker messages.
 * Listens for SW verification events and maintains state.
 */
export function useBrowseVerification(): UseBrowseVerificationResult {
  const { config } = useBrowseConfig();

  const [status, setStatus] = useState<VerificationStatus>('idle');
  const [phase, setPhase] = useState<VerificationPhase>('idle');
  const [stats, setStats] = useState<VerificationStats>({
    total: 0,
    verified: 0,
    failed: 0,
    failedResources: [],
  });
  const [error, setError] = useState<string | undefined>();
  const [gateway, setGateway] = useState<string | null>(null);
  const [manifestTxId, setManifestTxId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isSingleFile, setIsSingleFile] = useState(false);
  const [recentResources, setRecentResources] = useState<RecentResource[]>([]);

  const reset = useCallback(() => {
    setStatus('idle');
    setPhase('idle');
    setStats({ total: 0, verified: 0, failed: 0, failedResources: [] });
    setError(undefined);
    setGateway(null);
    setManifestTxId(null);
    setStartTime(null);
    setIsSingleFile(false);
    setRecentResources([]);
  }, []);

  useEffect(() => {
    if (!config.verificationEnabled) return;

    const handleSwMessage = (event: MessageEvent) => {
      const { type, event: verificationEvent } = event.data;

      if (type === 'VERIFICATION_EVENT' && verificationEvent) {
        const vEvent = verificationEvent as VerificationEvent;

        switch (vEvent.type) {
          case 'routing-gateway':
            if (vEvent.gatewayUrl) {
              setGateway(vEvent.gatewayUrl);
              setPhase('fetching-manifest');
            }
            break;

          case 'verification-started':
            setStatus('verifying');
            setStats({
              total: vEvent.progress?.total || 1,
              verified: 0,
              failed: 0,
              failedResources: [],
            });
            setError(undefined);
            setPhase('resolving');
            setStartTime(Date.now());
            setManifestTxId(null);
            setIsSingleFile(false);
            setRecentResources([]);
            break;

          case 'verification-progress':
            if (vEvent.progress) {
              setStats(prev => ({
                ...prev,
                total: vEvent.progress!.total,
                verified: vEvent.progress!.current,
                currentResource: vEvent.resourcePath,
              }));

              if (vEvent.resourcePath) {
                setRecentResources(prev => {
                  const newList = [...prev.filter(r => r.path !== vEvent.resourcePath)];
                  newList.push({ path: vEvent.resourcePath!, status: 'verified' });
                  return newList.slice(-8);
                });
              }
            }
            break;

          case 'manifest-loaded':
            if (vEvent.progress) {
              setStats(prev => ({
                ...prev,
                total: vEvent.progress!.total,
              }));
            }
            setManifestTxId(vEvent.manifestTxId || null);
            setIsSingleFile(vEvent.isSingleFile ?? (vEvent.progress?.total === 1));
            setPhase('verifying');
            break;

          case 'verification-complete':
            if (vEvent.progress) {
              setStats(prev => ({
                ...prev,
                total: vEvent.progress!.total,
                verified: vEvent.progress!.current,
              }));
            }

            if (vEvent.error) {
              const verifiedCount = vEvent.progress?.current ?? 0;
              setStatus(verifiedCount > 0 ? 'partial' : 'failed');
              setError(vEvent.error);
            } else {
              setStatus('verified');
            }
            setPhase('complete');
            break;

          case 'verification-failed':
            if (vEvent.resourcePath) {
              // Individual resource failure
              setStats(prev => ({
                ...prev,
                failed: prev.failed + 1,
                failedResources: [...(prev.failedResources || []), vEvent.resourcePath!],
              }));
              setRecentResources(prev => {
                const newList = [...prev.filter(r => r.path !== vEvent.resourcePath)];
                newList.push({ path: vEvent.resourcePath!, status: 'failed' });
                return newList.slice(-8);
              });
            } else {
              // Top-level failure
              setError(vEvent.error);
              setStatus('failed');
              setPhase('complete');
            }
            break;
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, [config.verificationEnabled]);

  return {
    status,
    phase,
    stats,
    error,
    gateway,
    manifestTxId,
    startTime,
    isSingleFile,
    recentResources,
    reset,
  };
}
