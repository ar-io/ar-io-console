import { useMemo } from 'react';
import { AlertTriangle, ExternalLink, Info, Loader2, Rocket, Sparkles } from 'lucide-react';
import BaseModal from '@/components/modals/BaseModal';
import { tokenLabels, type SupportedTokenType } from '@/constants';
import { isFileFree } from '@/hooks/useFreeUploadLimit';
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
  wincForOneGiB?: string;
  perDataItemFeeWinc?: string;
  creditBalance: number;
  walletType: 'arweave' | 'ethereum' | 'solana' | null;
  jitPaymentEnabled: boolean;
  /** x402-only bundler mode — Ethereum wallets pay per-upload in base-usdc. */
  x402OnlyMode: boolean;
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
  finalizing: 'Finalizing on the network…',
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
  wincForOneGiB,
  perDataItemFeeWinc,
  creditBalance,
  walletType,
  jitPaymentEnabled,
  x402OnlyMode,
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
  // In x402-only mode an Ethereum wallet pays per-upload in base-usdc via the
  // x402 path (not base-eth JIT) — mirror Upload/Deploy/Capture so Pages can bill.
  const jitToken =
    x402OnlyMode && walletType === 'ethereum' ? 'base-usdc' : defaultJitToken(walletType);
  const canJit =
    billable &&
    supportsJitPayment(jitToken) &&
    (jitPaymentEnabled || (x402OnlyMode && walletType === 'ethereum'));
  const overSizeCeiling = size > MAX_PAGE_BYTES;

  // Content gate: a page must have a name and somewhere to link before it can be
  // published — this is what stops empty / still-default template pages going out.
  const contentIssues = useMemo(() => {
    const issues: string[] = [];
    if (!def.profile.displayName.trim()) issues.push('a display name');
    const hasRealLink = def.blocks.some(
      (b) =>
        (b.type === 'link' && !!b.url.trim() && b.url.trim() !== '#') ||
        (b.type === 'social' && b.items.some((i) => !!i.url.trim() && i.url.trim() !== '#')),
    );
    if (!hasRealLink) issues.push('at least one link');
    return issues;
  }, [def]);
  const contentValid = contentIssues.length === 0;

  const canPublish = !overSizeCeiling && contentValid && (free || hasCredits || canJit);

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
                <Sparkles className="h-3.5 w-3.5" /> Permanent
              </span>
            ) : creditsKnown ? (
              <span className="text-sm font-medium text-foreground">{credits.toFixed(6)} Credits</span>
            ) : (
              <span className="text-sm text-foreground/70">Calculating…</span>
            )}
          </div>

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

        {!contentValid && !overSizeCeiling && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
            <div className="text-xs text-warning">
              Add {contentIssues.join(' and ')} before publishing — a page needs a name and somewhere
              to link.
            </div>
          </div>
        )}

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
