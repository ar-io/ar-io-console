import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Info,
  Loader2,
  Save,
  Tag,
  XCircle,
} from 'lucide-react';

import { ArNSName } from '@/types';
import BaseModal from '../../../components/modals/BaseModal';
import { isArweaveTxId, parseKeywords } from '../utils';
import { useANTDetails } from '../hooks/useANTDetails';
import {
  ArNSMetadataChanges,
  useSetArNSMetadata,
} from '../hooks/useSetArNSMetadata';

interface EditDetailsModalProps {
  domain: ArNSName;
  onClose: () => void;
  /** Called after at least one field is written, so the caller can refresh. */
  onSuccess?: () => void;
}

const DEFAULT_TTL = 3600;
const MIN_TTL = 60;
const MAX_TTL = 2_592_000; // 30 days
const MAX_KEYWORDS = 16;

const arraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Edit an owned name's ANT metadata (nickname, ticker, description, keywords,
 * logo) and its base `@` target record. Each changed field is a separate ANT
 * write / wallet signature — there's no batch setter — so the modal saves only
 * what changed and shows per-field progress.
 */
export default function EditDetailsModal({
  domain,
  onClose,
  onSuccess,
}: EditDetailsModalProps) {
  const details = useANTDetails(domain.processId, true);
  const { apply, phase, progress, completed, error, isBusy } =
    useSetArNSMetadata();

  // Form fields — seeded from the loaded ANT state once it arrives.
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [description, setDescription] = useState('');
  const [keywordsRaw, setKeywordsRaw] = useState('');
  const [logo, setLogo] = useState('');
  const [target, setTarget] = useState('');
  const [ttl, setTtl] = useState(String(DEFAULT_TTL));
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (details.data && !seeded) {
      setName(details.data.name);
      setTicker(details.data.ticker);
      setDescription(details.data.description);
      setKeywordsRaw(details.data.keywords.join(', '));
      setLogo(details.data.logo);
      setTarget(details.data.target ?? '');
      setTtl(String(details.data.ttlSeconds ?? DEFAULT_TTL));
      setSeeded(true);
    }
  }, [details.data, seeded]);

  const orig = details.data;
  const keywords = useMemo(() => parseKeywords(keywordsRaw), [keywordsRaw]);
  const ttlNum = Number(ttl);

  // Per-field validity for the fields the user actually touched.
  const logoValid = logo.trim() === '' || isArweaveTxId(logo);
  const targetTrimmed = target.trim();
  const targetValid = targetTrimmed === '' || isArweaveTxId(targetTrimmed);
  const ttlValid =
    Number.isInteger(ttlNum) && ttlNum >= MIN_TTL && ttlNum <= MAX_TTL;
  const keywordsValid = keywords.length <= MAX_KEYWORDS;

  // Diff vs. the loaded state — only changed + valid fields are written.
  const changes: ArNSMetadataChanges = useMemo(() => {
    if (!orig) return {};
    const c: ArNSMetadataChanges = {};
    if (name.trim() !== orig.name) c.name = name.trim();
    if (ticker.trim() !== orig.ticker) c.ticker = ticker.trim();
    if (description !== orig.description) c.description = description;
    if (!arraysEqual(keywords, orig.keywords)) c.keywords = keywords;
    // Logo can be changed but not cleared (setLogo requires a txId).
    if (logo.trim() && logo.trim() !== orig.logo && isArweaveTxId(logo))
      c.logo = logo.trim();
    // Base record needs a valid target txId; TTL can't be set without one.
    const targetChanged = targetTrimmed !== (orig.target ?? '');
    const ttlChanged = ttlNum !== (orig.ttlSeconds ?? DEFAULT_TTL);
    if (
      targetTrimmed &&
      isArweaveTxId(targetTrimmed) &&
      ttlValid &&
      (targetChanged || ttlChanged)
    ) {
      c.baseRecord = { transactionId: targetTrimmed, ttlSeconds: ttlNum };
    }
    return c;
  }, [
    orig,
    name,
    ticker,
    description,
    keywords,
    logo,
    targetTrimmed,
    ttlNum,
    ttlValid,
  ]);

  const changeCount = Object.keys(changes).length;
  const allValid = logoValid && targetValid && ttlValid && keywordsValid;
  const canSave = seeded && changeCount > 0 && allValid && !isBusy;

  const handleSave = async () => {
    try {
      const ok = await apply(domain.processId, changes);
      if (ok) onSuccess?.();
    } catch {
      // Partial/total failure surfaced via `error` (includes what saved).
    }
  };

  const inputCls =
    'w-full rounded-2xl border border-border/20 bg-card p-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-50';

  return (
    <BaseModal onClose={onClose} showCloseButton>
      <div className="max-h-[88vh] w-[92vw] max-w-lg overflow-y-auto p-6">
        <div className="mb-4">
          <h3 className="font-heading text-xl font-bold text-foreground">
            Edit details{' '}
            <span className="font-mono text-primary">
              {domain.displayName}.ar.io
            </span>
          </h3>
        </div>

        {phase === 'success' ? (
          <div className="rounded-2xl border border-primary/30 bg-card p-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-primary" />
            <p className="font-semibold text-foreground">Details updated</p>
            {completed.length > 0 && (
              <p className="mt-1 text-sm text-foreground/70">
                Saved: {completed.join(', ')}.
              </p>
            )}
            <button
              onClick={onClose}
              className="mt-4 rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Close
            </button>
          </div>
        ) : details.isLoading || !seeded ? (
          <div className="flex items-center gap-2 py-10 text-sm text-foreground/70">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading current details…
          </div>
        ) : details.isError ? (
          <div className="flex items-start gap-2 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
            <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>Couldn&apos;t load this name&apos;s current details.</span>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-start gap-2 rounded-2xl border border-border/20 bg-card p-3 text-xs text-foreground/70">
              <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
              Each changed field is saved as a separate transaction, so expect
              one wallet approval per field. It&apos;s free apart from a tiny SOL
              network fee.
            </div>

            {/* Nickname */}
            <label className="mb-1 block text-sm font-medium">Nickname</label>
            <input
              className={`${inputCls} mb-4`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Display name"
              disabled={isBusy}
            />

            {/* Ticker */}
            <label className="mb-1 block text-sm font-medium">Ticker</label>
            <input
              className={`${inputCls} mb-4`}
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="ANT"
              disabled={isBusy}
            />

            {/* Description */}
            <label className="mb-1 block text-sm font-medium">Description</label>
            <textarea
              className={`${inputCls} mb-4 min-h-[72px] resize-y`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this name for?"
              disabled={isBusy}
            />

            {/* Keywords */}
            <label className="mb-1 block text-sm font-medium">Keywords</label>
            <input
              className={inputCls}
              value={keywordsRaw}
              onChange={(e) => setKeywordsRaw(e.target.value)}
              placeholder="blog, web3, portfolio"
              disabled={isBusy}
            />
            <div className="mb-4 mt-1 flex items-center gap-1 text-xs">
              <Tag className="h-3 w-3 text-foreground/50" />
              <span
                className={keywordsValid ? 'text-foreground/50' : 'text-error'}
              >
                {keywords.length}/{MAX_KEYWORDS} keywords · separate with commas
              </span>
            </div>

            {/* Logo */}
            <label className="mb-1 block text-sm font-medium">
              Logo (Arweave TX ID)
            </label>
            <input
              className={`${inputCls} font-mono`}
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              placeholder="43-character transaction ID"
              spellCheck={false}
              disabled={isBusy}
            />
            {!logoValid && (
              <p className="mt-1 text-xs text-error">
                Enter a valid 43-character Arweave TX ID.
              </p>
            )}

            <div className="my-4 border-t border-border/20" />

            {/* Base @ target record */}
            <label className="mb-1 block text-sm font-medium">
              Target (base <span className="font-mono">@</span> record)
            </label>
            <p className="mb-2 text-xs text-foreground/60">
              The Arweave TX ID this name resolves to. Set this so{' '}
              {domain.displayName}.ar.io points at your content.
            </p>
            <input
              className={`${inputCls} font-mono`}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="43-character transaction ID"
              spellCheck={false}
              disabled={isBusy}
            />
            {!targetValid && (
              <p className="mt-1 text-xs text-error">
                Enter a valid 43-character Arweave TX ID.
              </p>
            )}

            <label className="mb-1 mt-3 block text-sm font-medium">
              TTL (seconds)
            </label>
            <input
              type="number"
              className={inputCls}
              value={ttl}
              onChange={(e) => setTtl(e.target.value)}
              min={MIN_TTL}
              max={MAX_TTL}
              disabled={isBusy}
            />
            {!ttlValid && (
              <p className="mt-1 text-xs text-error">
                TTL must be between {MIN_TTL} and {MAX_TTL} seconds.
              </p>
            )}

            {/* Progress / error */}
            {isBusy && (
              <div className="mt-4 flex items-center gap-2 text-sm text-foreground/70">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving {progress.label} — {Math.min(progress.done + 1, progress.total)}{' '}
                of {progress.total} (approve in your wallet)…
              </div>
            )}
            {phase === 'error' && error && (
              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error.message}</span>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={!canSave}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {changeCount > 0
                    ? `Save ${changeCount} ${changeCount === 1 ? 'change' : 'changes'}`
                    : 'No changes'}
                </>
              )}
            </button>
          </>
        )}
      </div>
    </BaseModal>
  );
}
