/**
 * PagesDashboard — the default Pages view: every page the user has created,
 * newest-first, with per-page status, live URL, version, domain, and the full
 * action set. Mirrors RecentDeploymentsPage's patterns (status pills via
 * useUploadStatus, Export CSV, Check Status, empty state).
 *
 * Publishing / editing / rollback are driven by the parent PagesPanel via
 * callbacks; this component owns only list-level concerns (status polling,
 * assign-domain modal, delete confirmation, export).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  DownloadCloud,
  LayoutTemplate,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useStore, type ConsolePage } from '@/store/useStore';
import { useUploadStatus } from '@/hooks/useUploadStatus';
import AssignDomainModal from '@/components/modals/AssignDomainModal';
import PageCard from './PageCard';

export interface PagesDashboardProps {
  arioGatewayUrl?: string;
  onCreate: () => void;
  onImport: () => void;
  onEdit: (page: ConsolePage) => void;
  onDuplicate: (page: ConsolePage) => void;
  onVersionHistory: (page: ConsolePage) => void;
}

export default function PagesDashboard({
  arioGatewayUrl,
  onCreate,
  onImport,
  onEdit,
  onDuplicate,
  onVersionHistory,
}: PagesDashboardProps) {
  const pages = useStore((s) => s.pages);
  const deletePage = useStore((s) => s.deletePage);
  const updatePageArNS = useStore((s) => s.updatePageArNS);

  const {
    initializeFromCache,
    checkMultipleStatuses,
    statusChecking,
    uploadStatuses,
    getStatusIcon,
  } = useUploadStatus();

  const [assignPage, setAssignPage] = useState<ConsolePage | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ConsolePage | null>(null);

  // Newest-first (pages are stored newest-first already, but sort defensively).
  const sortedPages = useMemo(
    () => [...pages].sort((a, b) => b.updatedAt - a.updatedAt),
    [pages],
  );

  const publishedTxIds = useMemo(
    () => sortedPages.filter((p) => p.latestTxId).map((p) => p.latestTxId),
    [sortedPages],
  );

  // Warm status from cache on mount / when the set of tx ids changes (no API calls).
  useEffect(() => {
    if (publishedTxIds.length > 0) initializeFromCache(publishedTxIds);
  }, [publishedTxIds, initializeFromCache]);

  const anyChecking = Object.values(statusChecking).some(Boolean);

  const exportToCSV = useCallback(() => {
    if (sortedPages.length === 0) return;
    const headers = [
      'Title',
      'Template',
      'Current Version',
      'Version Count',
      'Latest TX ID',
      'ArNS Name',
      'ArNS Undername',
      'Labels',
      'Created',
      'Updated',
    ];
    const rows = sortedPages.map((p) => [
      p.title,
      p.template,
      String(p.currentVersion),
      String(p.versions.length),
      p.latestTxId,
      p.arns?.name ?? '',
      p.arns?.undername ?? '',
      p.labels.join('; '),
      new Date(p.createdAt).toLocaleString(),
      new Date(p.updatedAt).toLocaleString(),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `pages-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [sortedPages]);

  // Empty state — no pages at all.
  if (sortedPages.length === 0) {
    return (
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-6">
        <div className="rounded-2xl border border-border/20 bg-card/60 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <h3 className="mb-1 font-heading text-xl font-bold text-foreground">Create your first page</h3>
          <p className="mx-auto mb-5 max-w-md text-sm text-foreground/70">
            Build a permanent link-in-bio page from a template, point your name at it, and it's live
            on the permaweb in seconds — usually for free.
          </p>
          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
            >
              <LayoutTemplate className="h-4 w-4" />
              Browse templates
            </button>
            <button
              type="button"
              onClick={onImport}
              className="inline-flex items-center gap-2 rounded-full border border-border/20 bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40"
            >
              <DownloadCloud className="h-4 w-4" />
              Edit an existing page
            </button>
          </div>
          <p className="mt-4 text-xs text-foreground/50">
            Already made one on another device? Load it with its ArNS name or transaction id.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* List header + actions */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-bold text-foreground">Your pages</h3>
          <p className="text-sm text-foreground/70">
            {sortedPages.length} page{sortedPages.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {publishedTxIds.length > 0 && (
            <button
              type="button"
              onClick={() => checkMultipleStatuses(publishedTxIds, true)}
              disabled={anyChecking}
              className="inline-flex items-center gap-1 rounded-full border border-border/20 bg-card px-3 py-2 text-xs text-foreground transition-colors hover:border-primary/40 disabled:opacity-50"
              title="Check status for all published pages"
            >
              <RefreshCw className={`h-3 w-3 ${anyChecking ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Check Status</span>
            </button>
          )}
          <button
            type="button"
            onClick={exportToCSV}
            className="inline-flex items-center gap-1 rounded-full border border-border/20 bg-card px-3 py-2 text-xs text-foreground transition-colors hover:border-primary/40"
            title="Export pages to CSV"
          >
            <Archive className="h-3 w-3" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button
            type="button"
            onClick={onImport}
            className="inline-flex items-center gap-1 rounded-full border border-border/20 bg-card px-3 py-2 text-xs text-foreground transition-colors hover:border-primary/40"
            title="Load a page you published elsewhere to edit it"
          >
            <DownloadCloud className="h-3 w-3" />
            <span className="hidden sm:inline">Edit existing</span>
          </button>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Create page
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sortedPages.map((page) => {
          const status = page.latestTxId ? uploadStatuses[page.latestTxId] : undefined;
          const statusIconName = status ? getStatusIcon(status.status, status.info) : undefined;
          return (
            <PageCard
              key={page.id}
              page={page}
              arioGatewayUrl={arioGatewayUrl}
              status={status}
              statusIconName={statusIconName}
              onEdit={() => onEdit(page)}
              onDuplicate={() => onDuplicate(page)}
              onAssignDomain={() => setAssignPage(page)}
              onVersionHistory={() => onVersionHistory(page)}
              onDelete={() => setDeleteConfirm(page)}
            />
          );
        })}
      </div>

      {/* Assign / change domain */}
      {assignPage && assignPage.latestTxId && (
        <AssignDomainModal
          onClose={() => setAssignPage(null)}
          manifestId={assignPage.latestTxId}
          existingArnsName={assignPage.arns?.name}
          existingUndername={assignPage.arns?.undername}
          onSuccess={(arnsName, undername, transactionId) => {
            updatePageArNS(assignPage.id, {
              name: arnsName,
              undername,
              targetTxId: assignPage.latestTxId,
              arnsTxId: transactionId,
            });
            setAssignPage(null);
          }}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <DeleteConfirm
          page={deleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => {
            deletePage(deleteConfirm.id);
            setDeleteConfirm(null);
          }}
        />
      )}
    </div>
  );
}

function DeleteConfirm({
  page,
  onCancel,
  onConfirm,
}: {
  page: ConsolePage;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border/20 bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-error/15">
              <Trash2 className="h-4 w-4 text-error" />
            </div>
            <h3 className="font-heading text-lg font-bold text-foreground">Delete page?</h3>
          </div>
          <button onClick={onCancel} className="p-1 text-foreground/50 hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-sm text-foreground/70">
          This removes <span className="font-medium text-foreground">{page.title || 'this page'}</span> from
          your console only.
        </p>
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            Published versions are permanent on Arweave and cannot be removed. Any assigned domain keeps
            pointing at the last published version.
          </span>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-border/20 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-error px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
