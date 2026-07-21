/**
 * VersionHistory — list every published version of a page (newest-first) and let
 * the user roll the page's ArNS name back to any prior version ("Make live").
 *
 * Rollback re-points the ArNS name at a chosen version's tx via the parent's
 * `onMakeLive` (which wraps usePagePublish().repointArNS). It requires a domain
 * and Solana access — both are surfaced inline (a link-wallet banner via
 * useLinkedSolanaWallet, and an explanation when no domain is assigned). The
 * gateway tx URL of every version is always copyable regardless (PRD §7.7).
 */

import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Globe,
  History,
  Loader2,
  RadioTower,
} from 'lucide-react';
import CopyButton from '@/components/CopyButton';
import LinkSolanaWalletModal from '@/components/modals/LinkSolanaWalletModal';
import AssignDomainModal from '@/components/modals/AssignDomainModal';
import { getArweaveUrl } from '@/utils';
import { useLinkedSolanaWallet } from '@/hooks/useLinkedSolanaWallet';
import { useStore, type ConsolePage } from '@/store/useStore';

export interface VersionHistoryProps {
  page: ConsolePage;
  onBack: () => void;
  /** Re-point the domain at a version's tx. Returns success/error. */
  onMakeLive: (versionNumber: number) => Promise<{ success: boolean; error?: string }>;
}

function formatSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function VersionHistory({ page, onBack, onMakeLive }: VersionHistoryProps) {
  const { hasArNSAccess, needsLinking, isSolanaConnected, promptReconnect, showLinkModal, setShowLinkModal } =
    useLinkedSolanaWallet();
  const updatePageArNS = useStore((s) => s.updatePageArNS);

  const [busyVersion, setBusyVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);

  const hasDomain = Boolean(page.arns);
  const arnsLabel = page.arns
    ? page.arns.undername
      ? `${page.arns.undername}_${page.arns.name}`
      : page.arns.name
    : undefined;

  // The currently-live tx: the ArNS target when assigned, else the latest tx.
  const liveTxId = page.arns?.targetTxId || page.latestTxId;

  const handleMakeLive = async (versionNumber: number) => {
    setError(null);
    setBusyVersion(versionNumber);
    try {
      const res = await onMakeLive(versionNumber);
      if (!res.success) setError(res.error || 'Failed to update your domain.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update your domain.');
    } finally {
      setBusyVersion(null);
    }
  };

  const canRollback = hasDomain && hasArNSAccess && isSolanaConnected;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Toolbar */}
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All pages
      </button>

      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card">
          <History className="h-5 w-5 text-foreground" />
        </div>
        <div className="min-w-0">
          <h3 className="mb-0.5 font-heading text-xl font-bold text-foreground">Version history</h3>
          <p className="truncate text-sm text-foreground/70" title={page.title}>
            {page.title || 'Untitled Page'}
            {arnsLabel && <span className="text-foreground/50"> · {arnsLabel}</span>}
          </p>
        </div>
      </div>

      {/* Rollback context banners */}
      {!hasDomain && (
        <div className="mb-4 rounded-xl border border-border/20 bg-card p-3">
          <p className="text-xs text-foreground/70">
            Roll back needs a domain. Assign one to this page to point it at any previous
            version. Each version's transaction link below is always permanent and copyable.
          </p>
          {page.latestTxId && (
            <button
              type="button"
              onClick={() => setShowAssign(true)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary/90"
            >
              <Globe className="h-3.5 w-3.5" /> Assign a domain
            </button>
          )}
        </div>
      )}
      {hasDomain && needsLinking && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <span className="text-sm text-foreground/80">Link a Solana wallet to roll back your domain.</span>
          <button
            type="button"
            onClick={() => setShowLinkModal(true)}
            className="flex-shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90"
          >
            Link Wallet
          </button>
        </div>
      )}
      {hasDomain && !needsLinking && !isSolanaConnected && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <span className="text-sm text-foreground/80">Solana wallet session expired.</span>
          <button
            type="button"
            onClick={promptReconnect}
            className="flex-shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90"
          >
            Reconnect
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error">{error}</div>
      )}

      {/* Version list (newest-first) */}
      <div className="space-y-3">
        {page.versions.map((v) => {
          const isLive = v.txId === liveTxId;
          const gatewayUrl = getArweaveUrl(v.txId);
          return (
            <div
              key={v.version}
              className={`rounded-2xl border bg-card p-4 ${
                isLive ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border/20'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading text-sm font-bold text-foreground">v{v.version}</span>
                    {isLive && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                        <CheckCircle2 className="h-3 w-3" /> Live
                      </span>
                    )}
                    <span className="text-xs text-foreground/50">
                      {new Date(v.timestamp).toLocaleString()}
                    </span>
                    {v.size ? <span className="text-xs text-foreground/40">· {formatSize(v.size)}</span> : null}
                  </div>
                  {v.note && <p className="mt-1 text-xs text-foreground/70">{v.note}</p>}
                  <div className="mt-2 flex items-center gap-1.5">
                    <a
                      href={gatewayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 truncate font-mono text-xs text-primary hover:underline"
                      title={v.txId}
                    >
                      {v.txId.slice(0, 8)}…{v.txId.slice(-6)}
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                    <CopyButton textToCopy={v.txId} />
                  </div>
                </div>

                {/* Make live / rollback */}
                <div className="flex-shrink-0">
                  {isLive ? (
                    <span className="text-xs font-medium text-foreground/40">Current</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleMakeLive(v.version)}
                      disabled={!canRollback || busyVersion !== null}
                      title={
                        !hasDomain
                          ? 'Assign a domain to enable rollback'
                          : !canRollback
                            ? 'Link a Solana wallet to roll back'
                            : 'Point your domain at this version'
                      }
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/20 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {busyVersion === v.version ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating…
                        </>
                      ) : (
                        <>
                          <RadioTower className="h-3.5 w-3.5" /> Make live
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showLinkModal && (
        <LinkSolanaWalletModal onClose={() => setShowLinkModal(false)} isReconnect={!needsLinking} />
      )}

      {showAssign && page.latestTxId && (
        <AssignDomainModal
          onClose={() => setShowAssign(false)}
          manifestId={page.latestTxId}
          existingArnsName={page.arns?.name}
          existingUndername={page.arns?.undername}
          onSuccess={(name, undername, transactionId) => {
            updatePageArNS(page.id, {
              name,
              undername,
              targetTxId: page.latestTxId,
              arnsTxId: transactionId,
            });
            setShowAssign(false);
          }}
        />
      )}
    </div>
  );
}
