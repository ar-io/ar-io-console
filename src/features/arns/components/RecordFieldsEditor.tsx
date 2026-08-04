import { ChevronDown, ChevronRight, Tag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DEFAULT_ANT_TRANSACTION_ID } from '@ar.io/sdk/solana';

import { MAX_KEYWORDS, MAX_TTL, MIN_TTL, parseKeywords, TARGET_PROTOCOL } from '../utils';
import {
  RecordFieldsState,
  validateRecordFields,
} from '../recordFields';
import LogoUploadField from './LogoUploadField';

const inputCls =
  'w-full rounded-2xl border border-border/20 bg-card p-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-50';

interface RecordFieldsEditorProps {
  value: RecordFieldsState;
  onChange: (next: RecordFieldsState) => void;
  disabled?: boolean;
  /** Prefix for label `htmlFor`/`id` uniqueness across multiple rows. */
  idPrefix: string;
  /**
   * When true, surface Nickname (displayName) + Description as first-class
   * fields (default-visible) and move them out of Advanced — used for
   * undernames, which read as mini-identities. Base `@` keeps them in Advanced.
   */
  promoteIdentity?: boolean;
}

/**
 * Shared, controlled editor for a single ANT record: a protocol toggle
 * (Arweave/IPFS), a target input validated per protocol, a TTL input, and a
 * collapsible "Advanced" area (priority, display name, record logo, record
 * description, record keywords). Purely presentational — no signer/writes.
 * Reused by the base `@` section (EditDetailsModal) and each undername
 * (UndernamesModal) so both render identical controls.
 */
export default function RecordFieldsEditor({
  value,
  onChange,
  disabled,
  idPrefix,
  promoteIdentity = false,
}: RecordFieldsEditorProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const v = validateRecordFields(value);
  const set = (patch: Partial<RecordFieldsState>) =>
    onChange({ ...value, ...patch });

  // The Advanced fields (priority / logo / keywords) feed `allValid`, so an
  // invalid one silently blocks save while the section is collapsed. Auto-open
  // it so the error is visible and actionable.
  const advancedInvalid =
    !v.priorityValid || !v.logoValid || !v.keywordsValid;
  useEffect(() => {
    if (advancedInvalid) setAdvancedOpen(true);
  }, [advancedInvalid]);

  const keywordCount = parseKeywords(value.keywordsRaw).length;
  const isIpfs = value.protocol === TARGET_PROTOCOL.ipfs;

  return (
    <div>
      {/* Protocol toggle */}
      <span className="mb-1 block text-sm font-medium">Protocol</span>
      <div className="mb-3 inline-flex rounded-full border border-border/20 bg-card p-1">
        {[
          { label: 'Arweave', p: TARGET_PROTOCOL.arweave },
          { label: 'IPFS', p: TARGET_PROTOCOL.ipfs },
        ].map(({ label, p }) => (
          <button
            key={label}
            type="button"
            onClick={() => set({ protocol: p })}
            disabled={disabled}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
              value.protocol === p
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground/70 hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Target */}
      <label
        htmlFor={`${idPrefix}-target`}
        className="mb-1 block text-sm font-medium"
      >
        Target ({isIpfs ? 'IPFS CID' : 'Arweave TX ID'})
      </label>
      <input
        id={`${idPrefix}-target`}
        className={`${inputCls} font-mono`}
        value={value.target}
        onChange={(e) => set({ target: e.target.value })}
        placeholder={
          isIpfs ? 'IPFS CID (Qm… or b…)' : '43-character transaction ID'
        }
        spellCheck={false}
        disabled={disabled}
      />
      {value.target.trim() !== '' && !v.targetValid && (
        <p className="mt-1 text-xs text-error">
          {isIpfs
            ? 'Enter a valid IPFS CID.'
            : 'Enter a valid 43-character Arweave TX ID.'}
        </p>
      )}
      {value.target.trim() === DEFAULT_ANT_TRANSACTION_ID && (
        <p className="mt-1 text-xs text-foreground/60">
          Currently resolves to the default AR.IO placeholder — set a target to
          point this name at your content.
        </p>
      )}

      {/* TTL */}
      <label
        htmlFor={`${idPrefix}-ttl`}
        className="mb-1 mt-3 block text-sm font-medium"
      >
        Cache time (TTL, seconds)
      </label>
      <input
        id={`${idPrefix}-ttl`}
        type="number"
        className={inputCls}
        value={value.ttl}
        onChange={(e) => set({ ttl: e.target.value })}
        min={MIN_TTL}
        max={MAX_TTL}
        disabled={disabled}
      />
      <p className="mt-1 text-xs text-foreground/50">
        How long ar.io gateways cache this record before re-checking. Lower =
        updates show sooner; higher = faster repeat loads.
      </p>
      {!v.ttlValid && (
        <p className="mt-1 text-xs text-error">
          Cache time must be between {MIN_TTL} and {MAX_TTL} seconds.
        </p>
      )}

      {/* Identity fields (Nickname + Description) — first-class for undernames. */}
      {promoteIdentity && (
        <>
          <label
            htmlFor={`${idPrefix}-display`}
            className="mb-1 mt-3 block text-sm font-medium"
          >
            Nickname
          </label>
          <input
            id={`${idPrefix}-display`}
            className={inputCls}
            value={value.displayName}
            onChange={(e) => set({ displayName: e.target.value })}
            placeholder="Optional — a friendly name for this undername"
            disabled={disabled}
          />

          <label
            htmlFor={`${idPrefix}-desc`}
            className="mb-1 mt-3 block text-sm font-medium"
          >
            Description
          </label>
          <textarea
            id={`${idPrefix}-desc`}
            className={`${inputCls} min-h-[60px] resize-y`}
            value={value.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="Optional — what this undername is for"
            disabled={disabled}
          />
        </>
      )}

      {/* Advanced disclosure */}
      <button
        type="button"
        onClick={() => setAdvancedOpen((o) => !o)}
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-foreground/70 hover:text-foreground"
      >
        {advancedOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        Advanced
      </button>

      {advancedOpen && (
        <div className="mt-2 space-y-3 rounded-2xl border border-border/20 bg-card p-3">
          <p className="text-xs text-foreground/60">
            Optional extra fields for{' '}
            <span className="font-semibold">this record</span> (distinct from the
            name&apos;s own metadata).
          </p>

          {/* Priority */}
          <div>
            <label
              htmlFor={`${idPrefix}-priority`}
              className="mb-1 block text-sm font-medium"
            >
              Priority
            </label>
            <input
              id={`${idPrefix}-priority`}
              type="number"
              className={inputCls}
              value={value.priority}
              onChange={(e) => set({ priority: e.target.value })}
              placeholder="Optional (e.g. 0)"
              min={0}
              disabled={disabled}
            />
            {!v.priorityValid && (
              <p className="mt-1 text-xs text-error">
                Priority must be a non-negative whole number.
              </p>
            )}
          </div>

          {/* Display name — only here when not promoted to a first-class field. */}
          {!promoteIdentity && (
            <div>
              <label
                htmlFor={`${idPrefix}-display`}
                className="mb-1 block text-sm font-medium"
              >
                Record display name
              </label>
              <input
                id={`${idPrefix}-display`}
                className={inputCls}
                value={value.displayName}
                onChange={(e) => set({ displayName: e.target.value })}
                placeholder="Optional label for this record"
                disabled={disabled}
              />
            </div>
          )}

          {/* Record logo */}
          <div>
            <LogoUploadField
              idPrefix={`${idPrefix}-logo`}
              label="Record logo"
              value={value.logo}
              onChange={(txid) => set({ logo: txid })}
              disabled={disabled}
            />
            {!v.logoValid && (
              <p className="mt-1 text-xs text-error">
                Enter a valid 43-character Arweave TX ID.
              </p>
            )}
          </div>

          {/* Record description — only here when not promoted. */}
          {!promoteIdentity && (
            <div>
              <label
                htmlFor={`${idPrefix}-desc`}
                className="mb-1 block text-sm font-medium"
              >
                Record description
              </label>
              <textarea
                id={`${idPrefix}-desc`}
                className={`${inputCls} min-h-[60px] resize-y`}
                value={value.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="What does this record point to?"
                disabled={disabled}
              />
            </div>
          )}

          {/* Record keywords */}
          <div>
            <label
              htmlFor={`${idPrefix}-keywords`}
              className="mb-1 block text-sm font-medium"
            >
              Record keywords
            </label>
            <input
              id={`${idPrefix}-keywords`}
              className={inputCls}
              value={value.keywordsRaw}
              onChange={(e) => set({ keywordsRaw: e.target.value })}
              placeholder="blog, web3, portfolio"
              disabled={disabled}
            />
            <div className="mt-1 flex items-center gap-1 text-xs">
              <Tag className="h-3 w-3 text-foreground/50" />
              <span className={v.keywordsValid ? 'text-foreground/50' : 'text-error'}>
                {keywordCount}/{MAX_KEYWORDS} keywords · separate with commas
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
