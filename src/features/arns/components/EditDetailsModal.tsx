import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Info,
  Loader2,
  Save,
  ShieldAlert,
  Tag,
  XCircle,
} from 'lucide-react';

import { ArNSName } from '@/types';
import BaseModal from '../../../components/modals/BaseModal';
import {
  DEFAULT_TTL,
  isArweaveTxId,
  isValidSolanaAddress,
  MAX_KEYWORDS,
  parseKeywords,
  TARGET_PROTOCOL,
} from '../utils';
import { useANTDetails } from '../hooks/useANTDetails';
import { useArNSTurboSigner } from '../hooks/useArNSTurboSigner';
import {
  ArNSMetadataChanges,
  useSetArNSMetadata,
} from '../hooks/useSetArNSMetadata';
import RecordFieldsEditor from './RecordFieldsEditor';
import LogoUploadField from './LogoUploadField';
import {
  RecordFieldsState,
  toRecordChange,
  validateRecordFields,
} from '../recordFields';

interface EditDetailsModalProps {
  domain: ArNSName;
  onClose: () => void;
  /** Called after at least one field is written, so the caller can refresh. */
  onSuccess?: () => void;
}

const arraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Edit an owned name's ANT metadata (nickname, ticker, description, keywords,
 * logo) and its base `@` target record. ANT-level fields are each a separate
 * write / wallet signature; the base record saves in ONE signature (all its
 * fields bundled); a record-ownership transfer is one more signature. The modal
 * saves only what changed and shows per-op progress.
 */
export default function EditDetailsModal({
  domain,
  onClose,
  onSuccess,
}: EditDetailsModalProps) {
  const details = useANTDetails(domain.processId, true);
  const signer = useArNSTurboSigner();
  const { apply, phase, progress, completed, error, isBusy } =
    useSetArNSMetadata();

  // ANT-level metadata fields.
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [description, setDescription] = useState('');
  const [keywordsRaw, setKeywordsRaw] = useState('');
  const [logo, setLogo] = useState('');
  // Base `@` record editor state + its original (for diffing).
  const [record, setRecord] = useState<RecordFieldsState>(() => ({
    target: '',
    protocol: TARGET_PROTOCOL.arweave,
    ttl: String(DEFAULT_TTL),
    priority: '',
    displayName: '',
    logo: '',
    description: '',
    keywordsRaw: '',
  }));
  const [origRecord, setOrigRecord] = useState<RecordFieldsState | null>(null);
  // Record ownership transfer.
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (details.data && !seeded) {
      const d = details.data;
      setName(d.name);
      setTicker(d.ticker);
      setDescription(d.description);
      setKeywordsRaw(d.keywords.join(', '));
      setLogo(d.logo);
      const seededRecord: RecordFieldsState = {
        target: d.target ?? '',
        protocol: d.targetProtocol ?? TARGET_PROTOCOL.arweave,
        ttl: String(d.ttlSeconds ?? DEFAULT_TTL),
        priority: d.priority !== undefined ? String(d.priority) : '',
        displayName: d.recordDisplayName ?? '',
        logo: d.recordLogo ?? '',
        description: d.recordDescription ?? '',
        keywordsRaw: (d.recordKeywords ?? []).join(', '),
      };
      setRecord(seededRecord);
      setOrigRecord(seededRecord);
      setSeeded(true);
    }
  }, [details.data, seeded]);

  const orig = details.data;
  const keywords = useMemo(() => parseKeywords(keywordsRaw), [keywordsRaw]);

  // ANT-level metadata validity. Validate the TRIMMED value so a pasted TX ID
  // with surrounding whitespace isn't rejected (the write path sends trimmed).
  const logoValid = logo.trim() === '' || isArweaveTxId(logo.trim());
  const keywordsValid = keywords.length <= MAX_KEYWORDS;

  // Base record validity + diff.
  const recordValidity = validateRecordFields(record);
  const recordChanged = useMemo(() => {
    if (!origRecord) return false;
    return (
      JSON.stringify(toRecordChange(record)) !==
      JSON.stringify(toRecordChange(origRecord))
    );
  }, [record, origRecord]);

  // Ownership: recipient must be a valid, changed Solana address.
  const currentRecordOwner =
    orig?.recordOwner ?? signer.address ?? undefined;
  const recipientTrimmed = recipient.trim();
  const recipientValid = isValidSolanaAddress(recipientTrimmed);
  const recipientIsSelf =
    recipientTrimmed !== '' &&
    (recipientTrimmed === currentRecordOwner ||
      recipientTrimmed === signer.address);
  const ownershipChanged =
    ownerOpen && recipientTrimmed !== '' && recipientValid && !recipientIsSelf;

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
    // Base record: whenever ANY record field changed, resend the FULL param
    // set (setBaseNameRecord requires transactionId + ttlSeconds every time).
    if (recordChanged && recordValidity.allValid) {
      c.baseRecord = toRecordChange(record);
    }
    // Ownership transfer is its own op.
    if (ownershipChanged) c.baseRecordOwner = recipientTrimmed;
    return c;
  }, [
    orig,
    name,
    ticker,
    description,
    keywords,
    logo,
    record,
    recordChanged,
    recordValidity.allValid,
    ownershipChanged,
    recipientTrimmed,
  ]);

  const changeCount = Object.keys(changes).length;
  // Block save if a touched-but-invalid field would silently drop.
  const antLevelValid = logoValid && keywordsValid;
  const recordBlocks = recordChanged && !recordValidity.allValid;
  const ownershipBlocks =
    ownerOpen &&
    recipientTrimmed !== '' &&
    (!recipientValid || recipientIsSelf);
  const canSave =
    seeded &&
    changeCount > 0 &&
    antLevelValid &&
    !recordBlocks &&
    !ownershipBlocks &&
    !isBusy;

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
              Each ANT-metadata field is a separate wallet approval; the record
              saves in one approval (all its fields together); a record-ownership
              transfer is one more. Free apart from a small SOL network fee.
            </div>

            {/* Nickname */}
            <label className="mb-1 block text-sm font-medium">Nickname</label>
            <input
              className={`${inputCls} mb-4`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Friendly name (e.g. My Project)"
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
            <LogoUploadField
              idPrefix="ant-logo"
              label="Logo"
              value={logo}
              onChange={setLogo}
              disabled={isBusy}
            />
            {!logoValid && (
              <p className="mt-1 text-xs text-error">
                Enter a valid 43-character Arweave TX ID.
              </p>
            )}

            <div className="my-4 border-t border-border/20" />

            {/* Base @ record */}
            <h4 className="mb-1 text-sm font-semibold text-foreground">
              Target (base <span className="font-mono">@</span> record)
            </h4>
            <p className="mb-3 text-xs text-foreground/60">
              Where {domain.displayName}.ar.io resolves. Choose the storage
              protocol, then enter the target.
            </p>
            <RecordFieldsEditor
              value={record}
              onChange={setRecord}
              disabled={isBusy}
              idPrefix="base-record"
            />

            {/* Record ownership */}
            <div className="mt-4 rounded-2xl border border-error/20 bg-error/10 p-3">
              <button
                type="button"
                onClick={() => setOwnerOpen((o) => !o)}
                className="flex w-full items-center gap-2 text-left text-sm font-semibold text-error"
              >
                <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                Transfer record ownership
              </button>
              {ownerOpen && (
                <div className="mt-3">
                  <p className="mb-2 text-xs text-error/90">
                    Hand this record&apos;s ownership to another Solana wallet.
                    This is a separate approval and cannot be undone by you.
                  </p>
                  <input
                    className={`${inputCls} font-mono`}
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="Recipient Solana address"
                    spellCheck={false}
                    disabled={isBusy}
                  />
                  {recipientTrimmed !== '' && !recipientValid && (
                    <p className="mt-1 text-xs text-error">
                      Enter a valid Solana address.
                    </p>
                  )}
                  {recipientIsSelf && (
                    <p className="mt-1 text-xs text-error">
                      This wallet already owns this record.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Progress / error */}
            {isBusy && (
              <div className="mt-4 flex items-center gap-2 text-sm text-foreground/70">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving {progress.label} —{' '}
                {Math.min(progress.done + 1, progress.total)} of {progress.total}{' '}
                (approve in your wallet)…
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
