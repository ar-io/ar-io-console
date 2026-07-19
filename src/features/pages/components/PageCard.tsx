/**
 * PageCard — one card per ConsolePage on the Pages dashboard.
 *
 * Shows a live thumbnail (an `<iframe srcDoc>` of the page's own rendered HTML),
 * title / template / version, the live URL (ArNS when assigned, else the gateway
 * URL for the latest tx), ArNS status, labels, an upload-status pill, and the
 * full action set (Edit / Duplicate / Assign domain / Version history / Visit /
 * Verify / Copy TX / Delete). Mirrors RecentDeploymentsPage's card patterns.
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import {
  Archive,
  CheckCircle,
  Clock,
  Copy,
  ExternalLink,
  Files,
  Globe,
  HelpCircle,
  History,
  MoreVertical,
  PenLine,
  ShieldCheck,
  Trash2,
  Unlink,
  XCircle,
} from 'lucide-react';
import CopyButton from '@/components/CopyButton';
import { getArweaveUrl } from '@/utils';
import { useStore, type ConsolePage } from '@/store/useStore';
import type { UploadStatus } from '@/hooks/useUploadStatus';
import { renderPageHtml, type RenderCtx } from '../render/renderPageHtml';
import { renderCtxFor } from '../publish/renderCtx';
import { computeDefHash } from '../publish/pageFile';
import { templates } from '../templates';
import { useElementWidth } from './useElementWidth';

/** Design size the thumbnail iframe renders at before being scaled to card width. */
const THUMB_W = 400;
const THUMB_H = 300;

function CardThumb({ html }: { html: string }) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const scale = width > 0 ? width / THUMB_W : 0;
  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden bg-white"
      style={{ height: scale ? THUMB_H * scale : 150 }}
    >
      {scale > 0 && (
        <iframe
          title="Page preview"
          srcDoc={html}
          sandbox=""
          scrolling="no"
          tabIndex={-1}
          aria-hidden="true"
          style={{
            width: THUMB_W,
            height: THUMB_H,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}

function renderStatusIcon(iconName: string) {
  switch (iconName) {
    case 'check-circle':
      return <CheckCircle className="h-3 w-3 text-success" />;
    case 'clock':
      return <Clock className="h-3 w-3 text-warning" />;
    case 'archive':
      return <Archive className="h-3 w-3 text-primary" />;
    case 'x-circle':
      return <XCircle className="h-3 w-3 text-error" />;
    case 'help-circle':
      return <HelpCircle className="h-3 w-3 text-foreground/80" />;
    default:
      return <Clock className="h-3 w-3 text-warning" />;
  }
}

function formatSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export interface PageCardProps {
  page: ConsolePage;
  arioGatewayUrl?: string;
  /** Cached/checked upload status for the page's latest tx. */
  status?: UploadStatus;
  /** Icon name for `status` (from useUploadStatus().getStatusIcon). */
  statusIconName?: string;
  onEdit: () => void;
  onDuplicate: () => void;
  onAssignDomain: () => void;
  onRemoveDomain: () => void;
  onVersionHistory: () => void;
  onDelete: () => void;
}

export default function PageCard({
  page,
  arioGatewayUrl,
  status,
  statusIconName,
  onEdit,
  onDuplicate,
  onAssignDomain,
  onRemoveDomain,
  onVersionHistory,
  onDelete,
}: PageCardProps) {
  const navigate = useNavigate();
  const configMode = useStore((s) => s.configMode);

  const isDraft = page.currentVersion < 1 || !page.latestTxId;
  const templateName = templates[page.template]?.meta.name ?? page.template;

  // Unpublished-changes signal: the working (last-edited) def differs from the
  // def hash captured at the current published version. Without this, editing a
  // published page autosaves into `page.def` and the card renders the draft as if
  // it were live, with no indication (#5).
  const hasUnpublishedChanges = useMemo(() => {
    if (isDraft) return false;
    const currentHash = page.versions.find((v) => v.version === page.currentVersion)?.defHash;
    if (!currentHash) return false;
    try {
      return computeDefHash(page.def) !== currentHash;
    } catch {
      return false;
    }
  }, [isDraft, page.versions, page.currentVersion, page.def]);

  const arnsLabel = page.arns
    ? page.arns.undername
      ? `${page.arns.undername}_${page.arns.name}`
      : page.arns.name
    : undefined;

  // Gateway-derived ArNS host suffix (e.g. `ar.io`), following the active config.
  const arnsHost = useMemo(
    () => renderCtxFor(page.def, { arioGatewayUrl, configMode }).arnsHost || 'ar.io',
    [page.def, arioGatewayUrl, configMode],
  );

  // Public URL: ArNS name.ar.io when assigned, else the gateway URL for the tx.
  const liveUrl = useMemo(() => {
    if (arnsLabel) return `https://${arnsLabel}.${arnsHost}`;
    return page.latestTxId ? getArweaveUrl(page.latestTxId) : '';
  }, [arnsLabel, arnsHost, page.latestTxId]);

  // Render the page's own HTML for the live thumbnail (keyed off def + identity).
  const thumbHtml = useMemo(() => {
    try {
      const opts: { arnsName?: string; selfTxId?: string } = {};
      if (arnsLabel) opts.arnsName = arnsLabel;
      if (page.latestTxId) opts.selfTxId = page.latestTxId;
      const ctx: RenderCtx = renderCtxFor(page.def, { arioGatewayUrl, configMode }, opts);
      return renderPageHtml(page.def, ctx);
    } catch (err) {
      console.error(`Failed to render thumbnail for page "${page.id}":`, err);
      return '<!doctype html><html><body></body></html>';
    }
  }, [page.def, page.id, page.latestTxId, arnsLabel, arioGatewayUrl, configMode]);

  const updatedLabel = new Date(page.updatedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border/20 bg-card shadow-sm">
      {/* Live thumbnail */}
      <div className="relative border-b border-border/20">
        <CardThumb html={thumbHtml} />
        {isDraft && (
          <span className="absolute left-3 top-3 rounded-full bg-foreground/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
            Draft
          </span>
        )}
        {hasUnpublishedChanges && (
          <span className="absolute left-3 top-3 rounded-full bg-warning/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
            Unpublished changes
          </span>
        )}
        {!isDraft && status && (
          <span
            className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-medium text-foreground shadow"
            title={`Status: ${status.status}`}
          >
            {statusIconName ? renderStatusIcon(statusIconName) : <Clock className="h-3 w-3 text-warning" />}
            {status.status}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {/* Title + template + version */}
        <div className="mb-1 flex items-start justify-between gap-2">
          <h4 className="min-w-0 flex-1 truncate font-heading text-base font-bold text-foreground" title={page.title}>
            {page.title || 'Untitled Page'}
          </h4>
          <span className="flex-shrink-0 rounded-full bg-card px-2 py-0.5 text-[11px] font-medium text-foreground/70 ring-1 ring-border/20">
            {isDraft ? 'Draft' : `v${page.currentVersion}`}
          </span>
        </div>
        <p className="text-xs text-foreground/60">
          {templateName}
          {!isDraft && page.versions.length > 0 && (
            <>
              {' · '}
              {page.versions.length} version{page.versions.length !== 1 ? 's' : ''}
            </>
          )}
          {' · '}
          {updatedLabel}
        </p>

        {/* Live URL / ArNS status */}
        <div className="mt-3 min-w-0">
          {isDraft ? (
            <span className="text-xs text-foreground/50">Not published yet</span>
          ) : arnsLabel ? (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1 truncate text-xs font-medium text-primary hover:underline"
              title={liveUrl}
            >
              <Globe className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{arnsLabel}.{arnsHost}</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={onAssignDomain}
              className="inline-flex items-center gap-1 text-xs font-medium text-foreground/70 hover:text-primary"
            >
              <Globe className="h-3.5 w-3.5" />
              No domain — Assign
            </button>
          )}
        </div>

        {/* Labels */}
        {page.labels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {page.labels.map((label) => (
              <span
                key={label}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2 pt-3">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            <PenLine className="h-3.5 w-3.5" />
            Edit
          </button>
          {!isDraft && (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/20 px-4 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Visit
            </a>
          )}
          {!isDraft && <CopyButton textToCopy={page.latestTxId} />}

          <div className="ml-auto">
            <Popover className="relative">
              <PopoverButton className="p-1.5 text-foreground/70 transition-colors hover:text-foreground focus:outline-none">
                <MoreVertical className="h-4 w-4" />
              </PopoverButton>
              <PopoverPanel
                anchor="bottom end"
                className="z-[9999] mt-1 w-52 rounded-2xl border border-border/20 bg-background py-1 shadow-lg"
              >
                {({ close }) => (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onDuplicate();
                        close();
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground/80 transition-colors hover:bg-primary/10 hover:text-foreground"
                    >
                      <Files className="h-4 w-4" />
                      Duplicate
                    </button>
                    {!isDraft && (
                      <button
                        type="button"
                        onClick={() => {
                          onAssignDomain();
                          close();
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground/80 transition-colors hover:bg-primary/10 hover:text-foreground"
                      >
                        <Globe className="h-4 w-4" />
                        {page.arns ? 'Change domain' : 'Assign domain'}
                      </button>
                    )}
                    {!isDraft && page.arns && (
                      <button
                        type="button"
                        onClick={() => {
                          onRemoveDomain();
                          close();
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground/80 transition-colors hover:bg-primary/10 hover:text-foreground"
                      >
                        <Unlink className="h-4 w-4" />
                        Remove domain
                      </button>
                    )}
                    {!isDraft && (
                      <button
                        type="button"
                        onClick={() => {
                          onVersionHistory();
                          close();
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground/80 transition-colors hover:bg-primary/10 hover:text-foreground"
                      >
                        <History className="h-4 w-4" />
                        Version history
                      </button>
                    )}
                    {!isDraft && (
                      <button
                        type="button"
                        onClick={() => {
                          navigate(`/verify?tx=${page.latestTxId}`);
                          close();
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground/80 transition-colors hover:bg-primary/10 hover:text-foreground"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Verify
                      </button>
                    )}
                    {!isDraft && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(page.latestTxId);
                          close();
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground/80 transition-colors hover:bg-primary/10 hover:text-foreground"
                      >
                        <Copy className="h-4 w-4" />
                        Copy TX ID
                      </button>
                    )}
                    <div className="my-1 border-t border-border/20" />
                    <button
                      type="button"
                      onClick={() => {
                        onDelete();
                        close();
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-error transition-colors hover:bg-error/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </>
                )}
              </PopoverPanel>
            </Popover>
          </div>
        </div>

        {/* Version size hint for published pages */}
        {!isDraft && page.versions[0]?.size ? (
          <p className="mt-2 text-[11px] text-foreground/40">{formatSize(page.versions[0].size)}</p>
        ) : null}
      </div>
    </div>
  );
}
