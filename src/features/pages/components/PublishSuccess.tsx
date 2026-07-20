import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ExternalLink, Globe, LayoutGrid, PenLine, PlusCircle, ShieldCheck } from 'lucide-react';
import CopyButton from '@/components/CopyButton';
import type { PublishResult } from '../hooks/usePagePublish';

interface PublishSuccessProps {
  result: PublishResult;
  /** The page's public URL (ArNS `name.ar.io` when assigned, else the gateway URL). */
  liveUrl: string;
  /** True when `liveUrl` is an assigned ArNS domain. */
  isArns: boolean;
  onEdit: () => void;
  onCreateAnother: () => void;
  /** Return to the Pages dashboard (the list of all pages). */
  onViewAllPages?: () => void;
  /** Open the assign-domain flow for this page (shown only when no domain yet). */
  onAssignDomain?: () => void;
}

export default function PublishSuccess({
  result,
  liveUrl,
  isArns,
  onEdit,
  onCreateAnother,
  onViewAllPages,
  onAssignDomain,
}: PublishSuccessProps) {
  const navigate = useNavigate();
  const txId = result.txId ?? '';
  const shortTx = txId ? `${txId.slice(0, 8)}…${txId.slice(-6)}` : '';

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex flex-col items-center py-4 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
          <CheckCircle2 className="h-7 w-7 text-success" />
        </div>
        <h3 className="font-heading text-2xl font-bold text-foreground">Your page is live</h3>
        <p className="mt-1 text-sm text-foreground/70">
          {result.version && result.version >= 2
            ? `Version ${result.version} is now live — published permanently${
                isArns ? ' at your domain' : ' to the permaweb'
              }.`
            : isArns
              ? 'Published permanently and pointed at your domain.'
              : 'Published permanently to the permaweb.'}
        </p>
        {result.version && result.version >= 2 && (
          <p className="mt-1 text-xs text-foreground/50">
            Earlier versions stay permanent — roll back anytime from version history.
          </p>
        )}
      </div>

      {/* Partial success: page live, ArNS failed */}
      {result.arnsError && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            Your page is live, but the domain update didn't complete: {result.arnsError} You can
            assign a domain again from the editor.
          </span>
        </div>
      )}

      {/* Live URL */}
      <div className="mb-3 rounded-2xl border border-border/20 bg-card p-4">
        <div className="mb-1 text-xs font-medium text-foreground/60">
          {isArns ? 'Your domain' : 'Live URL'}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate font-mono text-sm text-primary hover:underline"
          >
            {liveUrl}
          </a>
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visit page"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-foreground/70 hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <CopyButton textToCopy={liveUrl} />
        </div>
      </div>

      {/* Nudge to attach a memorable ArNS name (no domain yet) */}
      {!isArns && onAssignDomain && txId && (
        <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/15">
              <Globe className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Give it a memorable link</p>
              <p className="mt-0.5 text-xs text-foreground/70">
                Your page lives at the permanent gateway URL above. Point a domain at it for a
                short, human link like <span className="font-mono text-foreground/80">yourname.ar.io</span> —
                now or later.
              </p>
              <button
                type="button"
                onClick={onAssignDomain}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90"
              >
                <Globe className="h-3.5 w-3.5" /> Assign a domain
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TX id */}
      {txId && (
        <div className="mb-4 rounded-2xl border border-border/20 bg-card p-4">
          <div className="mb-1 text-xs font-medium text-foreground/60">Transaction ID</div>
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">{shortTx}</span>
            <button
              type="button"
              onClick={() => navigate(`/verify?tx=${txId}`)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/20 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Verify
            </button>
            <CopyButton textToCopy={txId} />
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onCreateAnother}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-border/20 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/50"
        >
          <PlusCircle className="h-4 w-4" /> Create another
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <PenLine className="h-4 w-4" /> Edit page
        </button>
      </div>

      {onViewAllPages && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onViewAllPages}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
          >
            <LayoutGrid className="h-4 w-4" /> Back to all pages
          </button>
        </div>
      )}
    </div>
  );
}
