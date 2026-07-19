import { useMemo } from 'react';
import { AlertTriangle, ExternalLink, Info, Loader2, Rocket, Sparkles } from 'lucide-react';
import BaseModal from '@/components/modals/BaseModal';
import { tokenLabels, type SupportedTokenType } from '@/constants';
import { isFileFree, formatFreeLimit } from '@/hooks/useFreeUploadLimit';
import { supportsJitPayment } from '@/utils/jitPayment';
import type { PageDef } from '../schema';
import type { RenderCtx } from '../render/renderPageHtml';
import { renderPageHtml } from '../render/renderPageHtml';
import { arnsLabel } from '../publish/permalink';
import { MAX_PAGE_BYTES, estimatePageCredits } from '../publish/cost';
import type { PublishStage } from '../hooks/usePagePublish';

interface PublishModalProps {
  def: PageDef;
  ctx: RenderCtx;
  arns?: { name: string; undername?: string };
  note: string;
  /** Version number this publish will create (1 for a first publish). */
  nextVersion?: number;
  /** Edit the changelog note inline (shown on re-publishes). */
  onNoteChange?: (note: string) => void;
  publishing: boolean;
  stage: PublishStage;
  error: string | null;
  notice?: string | null;
  onClose: () => void;
  onConfirm: (opts: { jitEnabled: boolean; selectedJitToken: SupportedTokenType }) => void;
  // pricing inputs
  freeUploadLimitBytes: number;
  /** Lifetime free-tier quota in bytes (0 = uncapped). Free is quota-limited, not guaranteed. */
  lifetimeFreeBytes?: number;
  wincForOneGiB?: string;
  perDataItemFeeWinc?: string;
  creditBalance: number;
  walletType: 'arweave' | 'ethereum' | 'solana' | null;
  jitPaymentEnabled: boolean;
}

function defaultJitToken(walletType: PublishModalProps['walletType']): SupportedTokenType {
  if (walletType === 'arweave') return 'ario';
  if (walletType === 'solana') return 'solana';
  return 'base-eth';
}

const STAGE_TEXT: Record<PublishStage, string> = {
  idle: '',
  rendering: 'Generating page…',
  uploading: 'Uploading to the permaweb…',
  'updating-arns': 'Updating your domain…',
  complete: 'Done',
  error: '',
};

export default function PublishModal({
  def,
  ctx,
  arns,
  note,
  nextVersion,
  onNoteChange,
  publishing,
  stage,
  error,
  notice,
  onClose,
  onConfirm,
  freeUploadLimitBytes,
  lifetimeFreeBytes = 0,
  wincForOneGiB,
  perDataItemFeeWinc,
  creditBalance,
  walletType,
  jitPaymentEnabled,
}: PublishModalProps) {
  const html = useMemo(() => {
    try {
      return renderPageHtml(def, ctx);
    } catch (e) {
      console.error('Publish preview render failed:', e);
      return '';
    }
  }, [def, ctx]);

  const size = useMemo(() => new Blob([html]).size, [html]);
  const free = isFileFree(size, freeUploadLimitBytes);

  const credits = useMemo(() => {
    if (free) return 0;
    return estimatePageCredits(size, wincForOneGiB, perDataItemFeeWinc);
  }, [free, wincForOneGiB, perDataItemFeeWinc, size]);

  const billable = !free;
  const creditsKnown = Number.isFinite(credits);
  const hasCredits = free || (creditsKnown && creditBalance >= credits);
  const jitToken = defaultJitToken(walletType);
  const canJit = billable && jitPaymentEnabled && supportsJitPayment(jitToken);
  const overSizeCeiling = size > MAX_PAGE_BYTES;
  const canPublish = !overSizeCeiling && (free || hasCredits || canJit);

  const domainLabel = arns ? `${arnsLabel(arns)}.${ctx.arnsHost || 'ar.io'}` : '';

  const handleConfirm = () => {
    onConfirm({ jitEnabled: canJit && !hasCredits, selectedJitToken: jitToken });
  };

  return (
    <BaseModal onClose={onClose}>
      <div className="mx-auto w-full max-w-lg min-w-[90vw] p-5 sm:min-w-[460px]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/20">
            <Rocket className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-bold text-foreground">Ready to publish</h3>
            <p className="text-xs text-foreground/70">Your page will be permanent on Arweave.</p>
          </div>
        </div>

        {/* Summary */}
        <div className="mb-3 rounded-xl bg-card p-3 text-sm">
          <div className="space-y-2">
            <Row label="Page" value={def.title || def.profile.displayName || 'Untitled'} />
            {domainLabel && <Row label="Domain" value={domainLabel} />}
            {typeof nextVersion === 'number' && (
              <Row
                label="Version"
                value={nextVersion <= 1 ? 'First version' : `Version ${nextVersion}`}
              />
            )}
            <Row label="Size" value={`${(size / 1024).toFixed(1)} KB`} />
          </div>
        </div>

        {/* Changelog note — only for re-publishes; a first version has nothing to note */}
        {onNoteChange && typeof nextVersion === 'number' && nextVersion >= 2 && (
          <div className="mb-3">
            <label htmlFor="publish-note" className="mb-1.5 block text-xs font-medium text-foreground/70">
              What changed? <span className="text-foreground/40">(optional)</span>
            </label>
            <input
              id="publish-note"
              type="text"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              disabled={publishing}
              placeholder="e.g. Updated links and header"
              className="w-full rounded-xl border border-border/20 bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/50 disabled:opacity-60"
            />
            <p className="mt-1 text-xs text-foreground/50">Kept with this version's permanent history.</p>
          </div>
        )}
        {/* First-version note passthrough (read-only, if one was set in the editor) */}
        {note && (!nextVersion || nextVersion < 2) && (
          <div className="mb-3 rounded-xl bg-card p-3 text-sm">
            <Row label="Note" value={note} />
          </div>
        )}

        {/* Cost */}
        <div className="mb-4 rounded-xl border border-border/20 bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground/70">Cost</span>
            {free ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-sm font-semibold text-success">
                <Sparkles className="h-3.5 w-3.5" /> Free · Permanent
              </span>
            ) : creditsKnown ? (
              <span className="text-sm font-medium text-foreground">{credits.toFixed(6)} Credits</span>
            ) : (
              <span className="text-sm text-foreground/70">Calculating…</span>
            )}
          </div>

          {free && (
            <p className="mt-1.5 text-xs text-foreground/50">
              {lifetimeFreeBytes > 0 ? (
                <>
                  Free within your {formatFreeLimit(lifetimeFreeBytes)} lifetime free tier. Once
                  that&rsquo;s used up, pages are paid by size plus a small per-item fee.
                </>
              ) : (
                <>Under the {formatFreeLimit(freeUploadLimitBytes)} free tier — no credits needed.</>
              )}
            </p>
          )}

          {billable && creditsKnown && (
            <>
              <div className="mt-2.5 flex items-center justify-between border-t border-border/10 pt-2.5">
                <span className="text-xs text-foreground/70">Your balance</span>
                <span className="text-sm text-foreground">{creditBalance.toFixed(6)} Credits</span>
              </div>
              <a
                href="https://docs.ar.io/build/upload/turbo-credits"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-xs text-foreground/45 transition-colors hover:text-foreground/70"
              >
                What are credits?
                <ExternalLink className="h-3 w-3" />
              </a>
              {!hasCredits && !canJit && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-error/20 bg-error/10 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-error" />
                  <div className="text-xs text-error">
                    Need {Math.max(0, credits - creditBalance).toFixed(6)} more credits.{' '}
                    <a href="/topup" className="underline hover:text-error/80">
                      Top up
                    </a>{' '}
                    to continue.
                  </div>
                </div>
              )}
              {canJit && !hasCredits && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-foreground/60">
                  <Info className="h-3.5 w-3.5 text-primary" />
                  Auto-pays with {tokenLabels[jitToken]} at publish (crypto).
                </p>
              )}
            </>
          )}
        </div>

        {overSizeCeiling && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-error/20 bg-error/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-error" />
            <div className="text-xs text-error">
              This page is {(size / (1024 * 1024)).toFixed(1)} MB — over the{' '}
              {MAX_PAGE_BYTES / (1024 * 1024)} MB single-file limit. Remove or shrink large images
              (or link to them instead of embedding) to publish.
            </div>
          </div>
        )}

        {notice && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground/80">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-error/20 bg-error/10 p-3 text-xs text-error">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Terms */}
        <div className="mb-4 rounded-lg bg-card/40 px-3 py-2">
          <p className="text-center text-xs text-foreground/70">
            Once published, this page will be publicly accessible and cannot be removed. By
            publishing, you agree to our{' '}
            <a
              href="https://ardrive.io/tos-and-privacy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline transition-colors hover:text-primary/80"
            >
              Terms of Service
            </a>
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={publishing}
            className="flex-1 rounded-full border border-border/20 px-4 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={publishing || !canPublish}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {publishing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {STAGE_TEXT[stage] || 'Publishing…'}
              </>
            ) : billable && canJit && !hasCredits ? (
              'Publish & Auto-Pay'
            ) : (
              'Publish page'
            )}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-foreground/70">{label}</span>
      <span className="min-w-0 truncate text-right text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}
