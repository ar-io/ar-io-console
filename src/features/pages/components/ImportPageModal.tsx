import { useState } from 'react';
import { AlertTriangle, DownloadCloud, Info, Loader2 } from 'lucide-react';
import BaseModal from '@/components/modals/BaseModal';
import type { RenderCtx } from '../render/renderPageHtml';
import { importPageFromSource, type ImportedPage } from '../publish/importPage';

interface ImportPageModalProps {
  ctx: RenderCtx;
  onClose: () => void;
  onImported: (page: ImportedPage) => void;
}

/**
 * Recover an already-published page for editing — the cross-device / cleared-cache
 * path. Takes an ArNS name or tx id, fetches the page, and hands the recovered
 * PageDef back to the panel to hydrate the editor (PRD §9.2).
 */
export default function ImportPageModal({ ctx, onClose, onImported }: ImportPageModalProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (loading || !input.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const result = await importPageFromSource(input, ctx);
      onImported(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load that page.');
      setLoading(false);
    }
  };

  return (
    <BaseModal onClose={loading ? () => {} : onClose}>
      <div className="mx-auto w-full max-w-lg min-w-[90vw] p-5 sm:min-w-[460px]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/20">
            <DownloadCloud className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-bold text-foreground">Edit an existing page</h3>
            <p className="text-xs text-foreground/70">
              Load a page you already published — even on a new device.
            </p>
          </div>
        </div>

        <label htmlFor="import-page-input" className="mb-1.5 block text-xs font-medium text-foreground/70">
          Domain name or transaction id
        </label>
        <input
          id="import-page-input"
          autoFocus
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="myname.ar.io  ·  or a 43-character transaction id"
          disabled={loading}
          className="w-full rounded-xl border border-border/20 bg-card px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/50 disabled:opacity-60"
        />

        <p className="mt-2 flex items-start gap-1.5 text-xs text-foreground/60">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
          <span>
            Every ar.io page carries its own design, so we can rebuild it in the editor. Publishing
            your edits creates a new permanent version and keeps your domain pointed at the latest one.
          </span>
        </p>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-error/20 bg-error/10 p-3 text-xs text-error">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-full border border-border/20 px-4 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={loading || !input.trim()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </>
            ) : (
              'Load page'
            )}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
