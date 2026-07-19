import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ExternalLink, LayoutGrid, PenLine, PlusCircle, ShieldCheck } from 'lucide-react';
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
}

export default function PublishSuccess({
  result,
  liveUrl,
  isArns,
  onEdit,
  onCreateAnother,
  onViewAllPages,
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
          {isArns
            ? 'Published permanently and pointed at your domain.'
            : 'Published permanently to the permaweb.'}
        </p>
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
