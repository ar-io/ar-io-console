import { useState } from 'react';
import {
  Info,
  Loader2,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';

import { ArNSName } from '@/types';
import BaseModal from '../../../components/modals/BaseModal';
import { isArweaveTxId, isValidUndername } from '../utils';
import {
  UndernameRecord,
  useUndernameRecords,
  useUndernameWrites,
} from '../hooks/useUndernames';

interface UndernamesModalProps {
  domain: ArNSName;
  onClose: () => void;
  /** Called after any undername write settles, so the caller can refresh. */
  onSuccess?: () => void;
}

const DEFAULT_TTL = 3600;
const MIN_TTL = 60;
const MAX_TTL = 2_592_000;

const ttlValid = (v: string) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= MIN_TTL && n <= MAX_TTL;
};

const inputCls =
  'w-full rounded-2xl border border-border/20 bg-card p-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-50';

/**
 * Add, edit, and remove undername records for an owned name. Undernames resolve
 * as `label_name.ar.io`. Each change is a separate ANT write / wallet signature.
 * Adding beyond the name's undername limit fails on-chain — the error points the
 * user to "Add undernames" (raise the limit) in Manage.
 */
export default function UndernamesModal({
  domain,
  onClose,
  onSuccess,
}: UndernamesModalProps) {
  const records = useUndernameRecords(domain.processId, true);
  const { saveUndername, removeUndername, busyKey, error, isBusy } =
    useUndernameWrites();

  const existing = records.data ?? [];

  // Add form.
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newTtl, setNewTtl] = useState(String(DEFAULT_TTL));

  // Inline edit of an existing row.
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState('');
  const [editTtl, setEditTtl] = useState(String(DEFAULT_TTL));

  const afterWrite = async () => {
    await records.refetch();
    onSuccess?.();
  };

  const labelTaken = existing.some(
    (r) => r.undername.toLowerCase() === newLabel.trim().toLowerCase(),
  );
  const canAdd =
    isValidUndername(newLabel) &&
    !labelTaken &&
    isArweaveTxId(newTarget) &&
    ttlValid(newTtl) &&
    !isBusy;

  const handleAdd = async () => {
    try {
      await saveUndername(domain.processId, newLabel.trim(), {
        transactionId: newTarget.trim(),
        ttlSeconds: Number(newTtl),
      });
      setNewLabel('');
      setNewTarget('');
      setNewTtl(String(DEFAULT_TTL));
      setAddOpen(false);
      await afterWrite();
    } catch {
      /* surfaced via error */
    }
  };

  const startEdit = (r: UndernameRecord) => {
    setEditKey(r.undername);
    setEditTarget(r.transactionId);
    setEditTtl(String(r.ttlSeconds || DEFAULT_TTL));
  };

  const canSaveEdit = isArweaveTxId(editTarget) && ttlValid(editTtl) && !isBusy;

  const handleSaveEdit = async (undername: string) => {
    try {
      await saveUndername(domain.processId, undername, {
        transactionId: editTarget.trim(),
        ttlSeconds: Number(editTtl),
      });
      setEditKey(null);
      await afterWrite();
    } catch {
      /* surfaced via error */
    }
  };

  const handleRemove = async (undername: string) => {
    try {
      await removeUndername(domain.processId, undername);
      await afterWrite();
    } catch {
      /* surfaced via error */
    }
  };

  return (
    <BaseModal onClose={onClose} showCloseButton>
      <div className="max-h-[88vh] w-[92vw] max-w-lg overflow-y-auto p-6">
        <div className="mb-4">
          <h3 className="font-heading text-xl font-bold text-foreground">
            Undernames for{' '}
            <span className="font-mono text-primary">
              {domain.displayName}.ar.io
            </span>
          </h3>
        </div>

        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-border/20 bg-card p-3 text-xs text-foreground/70">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
          Undernames resolve as{' '}
          <span className="whitespace-nowrap font-mono text-foreground">
            label_{domain.displayName}.ar.io
          </span>
          . Each change is its own transaction, so expect a wallet approval per
          change.
        </div>

        {/* Existing undernames */}
        {records.isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-foreground/70">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading undernames…
          </div>
        ) : records.isError ? (
          <div className="flex items-start gap-2 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
            <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>Couldn&apos;t load undernames for this name.</span>
          </div>
        ) : existing.length === 0 ? (
          <p className="py-4 text-sm text-foreground/60">
            No undernames yet. Add one below.
          </p>
        ) : (
          <ul className="mb-2 space-y-2">
            {existing.map((r) => {
              const rowBusy = busyKey === r.undername;
              const isEditing = editKey === r.undername;
              return (
                <li
                  key={r.undername}
                  className="rounded-2xl border border-border/20 bg-card p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-sm text-foreground">
                      {r.undername}_{domain.displayName}.ar.io
                    </span>
                    <div className="flex flex-shrink-0 items-center gap-3 text-sm">
                      {rowBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin text-foreground/50" />
                      ) : isEditing ? (
                        <button
                          onClick={() => setEditKey(null)}
                          className="text-foreground/60 hover:underline"
                        >
                          Cancel
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(r)}
                            disabled={isBusy}
                            className="text-foreground/70 hover:text-foreground hover:underline disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleRemove(r.undername)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1 text-error hover:underline disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="mt-3 space-y-2">
                      <input
                        className={`${inputCls} font-mono`}
                        value={editTarget}
                        onChange={(e) => setEditTarget(e.target.value)}
                        placeholder="Target Arweave TX ID"
                        spellCheck={false}
                        disabled={rowBusy}
                      />
                      {editTarget.trim() && !isArweaveTxId(editTarget) && (
                        <p className="text-xs text-error">
                          Enter a valid 43-character Arweave TX ID.
                        </p>
                      )}
                      <input
                        type="number"
                        className={inputCls}
                        value={editTtl}
                        onChange={(e) => setEditTtl(e.target.value)}
                        min={MIN_TTL}
                        max={MAX_TTL}
                        disabled={rowBusy}
                      />
                      <button
                        onClick={() => handleSaveEdit(r.undername)}
                        disabled={!canSaveEdit}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 truncate font-mono text-xs text-foreground/50">
                      → {r.transactionId || '—'} · TTL {r.ttlSeconds}s
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Add undername */}
        {addOpen ? (
          <div className="mt-3 rounded-2xl border border-primary/30 bg-card p-4">
            <label className="mb-1 block text-sm font-medium">Undername</label>
            <input
              className={inputCls}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="blog"
              spellCheck={false}
              disabled={isBusy}
            />
            {newLabel.trim() && (
              <p className="mt-1 text-xs text-foreground/50">
                {isValidUndername(newLabel) ? (
                  labelTaken ? (
                    <span className="text-error">
                      That undername already exists.
                    </span>
                  ) : (
                    <span className="font-mono">
                      {newLabel.trim()}_{domain.displayName}.ar.io
                    </span>
                  )
                ) : (
                  <span className="text-error">
                    Use letters/numbers, then optional - or _.
                  </span>
                )}
              </p>
            )}

            <label className="mb-1 mt-3 block text-sm font-medium">
              Target (Arweave TX ID)
            </label>
            <input
              className={`${inputCls} font-mono`}
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              placeholder="43-character transaction ID"
              spellCheck={false}
              disabled={isBusy}
            />
            {newTarget.trim() && !isArweaveTxId(newTarget) && (
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
              value={newTtl}
              onChange={(e) => setNewTtl(e.target.value)}
              min={MIN_TTL}
              max={MAX_TTL}
              disabled={isBusy}
            />

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={handleAdd}
                disabled={!canAdd}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyKey === newLabel.trim() ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Adding…
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Add undername
                  </>
                )}
              </button>
              <button
                onClick={() => setAddOpen(false)}
                disabled={isBusy}
                className="text-sm text-foreground/60 hover:underline disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddOpen(true)}
            disabled={isBusy}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/10 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add undername
          </button>
        )}

        {/* Errors */}
        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
            <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error.message}</span>
          </div>
        )}
      </div>
    </BaseModal>
  );
}
