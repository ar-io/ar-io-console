import { useMemo, useState } from 'react';
import { Globe, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

import CopyButton from '@/components/CopyButton';
import SolanaGateButton from '@/components/SolanaGateButton';
import RecordFieldsEditor from './RecordFieldsEditor';
import {
  blankRecordFields,
  RecordFieldsState,
  toRecordChange,
  withoutClears,
  validateRecordFields,
} from '../recordFields';
import { DEFAULT_TTL, isValidUndername } from '../utils';
import { useUndernameWrites, type UndernameRecord } from '../hooks/useUndernames';
import { useSetArNSMetadata } from '../hooks/useSetArNSMetadata';
import type { ANTDetails } from '../hooks/useANTDetails';

/** Local mirror of the page's id shortener — keeps this component self-contained. */
function shorten(id: string, head = 6, tail = 4) {
  return id.length <= head + tail + 1 ? id : `${id.slice(0, head)}…${id.slice(-tail)}`;
}

const PAGE = 10;
const APEX = '@';

/**
 * Every record for one name — the `@` root and each undername — in ONE editable
 * table, the way a DNS provider presents a zone.
 *
 * This replaces a split that had no basis in the data: changing the root target
 * lived in "Edit details" (a modal mostly about ANT identity) while every other
 * pointer lived in an "Undernames" modal, even though both edit the SAME record
 * shape through the SAME `RecordFieldsEditor`. The mapping to DNS is near exact
 * (apex `@`, subdomain, value, TTL), so borrowing the records-table convention
 * costs nothing to learn.
 *
 * `@` is row one rather than a pinned header: it IS a record, and giving it its
 * own region would rebuild the split this table exists to remove. It is only
 * marked (a `root` badge) and made non-removable, since a name cannot exist
 * without its apex.
 *
 * Writes differ per row type and are deliberately kept behind one Save:
 *   - `@`        -> setBaseNameRecord, a single bundled write
 *   - undername  -> saveUndername for that key
 */
interface RecordsTableProps {
  processId: string;
  /** The ArNS name — seeds the custody lookup that picks a record writer. */
  name?: string;
  ant: ANTDetails | undefined;
  undernames: UndernameRecord[] | undefined;
  /** Owner or controller — both may edit records. */
  canManage: boolean;
  /** Undernames allowed by the current limit (excludes `@`). */
  undernameLimit?: number | null;
  onSuccess: () => void;
}

type RowKind = 'apex' | 'undername';
interface Row {
  key: string;
  label: string;
  kind: RowKind;
  target: string | null | undefined;
  ttl?: number;
  seed: () => RecordFieldsState;
}

function TargetValue({ target }: { target: string | null | undefined }) {
  if (!target) return <span className="text-xs text-foreground/40">Not set</span>;
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="truncate font-mono text-xs">{shorten(target, 8, 6)}</span>
      <CopyButton textToCopy={target} />
    </div>
  );
}

export default function RecordsTable({
  processId,
  name,
  ant,
  undernames,
  canManage,
  undernameLimit,
  onSuccess,
}: RecordsTableProps) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  /** Row key currently expanded for editing, or '__new__' for the add form. */
  const [editKey, setEditKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<RecordFieldsState>(() => blankRecordFields(DEFAULT_TTL));
  /*
    The record as loaded, kept alongside the draft.

    Metadata fields are tri-state on the wire — omitted means "leave alone",
    null means "clear" — and only a diff against this can tell those apart. A
    blank box with no original is a field the user never filled in; a blank box
    that HAD a value is a deliberate clear.
  */
  const [original, setOriginal] = useState<RecordFieldsState | undefined>();
  const [newName, setNewName] = useState('');
  const [rowError, setRowError] = useState<string | null>(null);

  const undernameWrites = useUndernameWrites(name, processId);
  const metadata = useSetArNSMetadata();

  const rows = useMemo<Row[]>(() => {
    const apex: Row = {
      key: APEX,
      label: APEX,
      kind: 'apex',
      target: ant?.target,
      ttl: ant?.ttlSeconds,
      seed: () => ({
        target: ant?.target ?? '',
        protocol: ant?.targetProtocol ?? 0,
        ttl: String(ant?.ttlSeconds ?? DEFAULT_TTL),
        priority: ant?.priority != null ? String(ant.priority) : '',
        displayName: ant?.recordDisplayName ?? '',
        logo: ant?.recordLogo ?? '',
        description: ant?.recordDescription ?? '',
        keywordsRaw: (ant?.recordKeywords ?? []).join(', '),
      }),
    };
    const rest: Row[] = (undernames ?? []).map((u) => ({
      key: u.undername,
      label: u.undername,
      kind: 'undername',
      target: u.transactionId,
      ttl: u.ttlSeconds,
      seed: () => ({
        target: u.transactionId ?? '',
        protocol: u.targetProtocol ?? 0,
        ttl: String(u.ttlSeconds ?? DEFAULT_TTL),
        priority: u.priority != null ? String(u.priority) : '',
        displayName: u.displayName ?? '',
        logo: u.logo ?? '',
        description: u.description ?? '',
        keywordsRaw: (u.keywords ?? []).join(', '),
      }),
    }));
    const all = [apex, ...rest];
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(
      (r) =>
        r.label.toLowerCase().includes(needle) ||
        (r.target ?? '').toLowerCase().includes(needle),
    );
  }, [ant, undernames, q]);

  const used = undernames?.length ?? 0;
  const atLimit = undernameLimit != null && used >= undernameLimit;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE));
  const cur = Math.min(page, pageCount - 1);
  const shown = rows.slice(cur * PAGE, cur * PAGE + PAGE);

  const validation = validateRecordFields(draft);
  const isAdding = editKey === '__new__';
  const nameValid = !isAdding || (isValidUndername(newName) && !rows.some((r) => r.key === newName));
  const canSave = validation.allValid && nameValid;
  const busyKey = undernameWrites.busyKey;
  const busy = undernameWrites.isBusy || metadata.isBusy;

  const openEdit = (r: Row) => {
    setRowError(null);
    const seeded = r.seed();
    setDraft(seeded);
    setOriginal(seeded);
    setEditKey(r.key);
  };
  const openAdd = () => {
    setRowError(null);
    setNewName('');
    setDraft(blankRecordFields(DEFAULT_TTL));
    // A new record has nothing on chain, so every blank field is simply absent
    // rather than cleared.
    setOriginal(undefined);
    setEditKey('__new__');
  };
  const close = () => {
    setEditKey(null);
    setRowError(null);
  };

  const save = async (r: Row | null) => {
    setRowError(null);
    try {
      if (r?.kind === 'apex') {
        // One bundled setBaseNameRecord write.
        // `withoutClears` until the sponsored record actions land — the ANT
        // write has no way to clear a field, only to overwrite one.
        await metadata.apply(processId, {
          baseRecord: withoutClears(toRecordChange(draft, original)),
        });
      } else {
        const key = r ? r.key : newName;
        await undernameWrites.saveUndername(
          processId,
          key,
          withoutClears(toRecordChange(draft, original)),
        );
      }
      close();
      onSuccess();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const remove = async (r: Row) => {
    setRowError(null);
    try {
      await undernameWrites.removeUndername(processId, r.key);
      onSuccess();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Remove failed');
    }
  };

  const editor = (r: Row | null) => (
    // A nested card, per the style guide's rounded-xl convention. Previously a
    // flat border-t strip, which squared off inside the rounded records card and
    // read as a seam rather than a panel.
    <div className="mb-3 rounded-xl border border-border/20 bg-background p-4">
      {r === null && (
        <div className="mb-3">
          <label htmlFor="new-undername" className="mb-1 block text-sm font-medium">
            Undername
          </label>
          <div className="flex items-center gap-2">
            <input
              id="new-undername"
              value={newName}
              onChange={(e) => setNewName(e.target.value.toLowerCase().trim())}
              placeholder="blog"
              className="w-48 rounded-2xl border border-border/20 bg-card p-2 text-sm focus:border-primary"
            />
            <span className="text-sm text-foreground/60">_{'{name}'}.ar.io</span>
          </div>
          {newName && !nameValid && (
            <p className="mt-1 text-xs text-error">
              {rows.some((x) => x.key === newName)
                ? 'That record already exists.'
                : 'Use lowercase letters, numbers and hyphens.'}
            </p>
          )}
        </div>
      )}

      <RecordFieldsEditor
        value={draft}
        onChange={setDraft}
        disabled={busy}
        idPrefix={`rec-${r?.key ?? 'new'}`}
        promoteIdentity={r?.kind !== 'apex'}
      />

      {rowError && <p className="mt-2 text-sm text-error">{rowError}</p>}

      <div className="mt-3 flex items-center gap-2">
        <div className="w-40">
          <SolanaGateButton
            onAction={() => void save(r)}
            disabled={!canSave || busy}
            busy={busy}
            actionVerb="save this record"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save record
          </SolanaGateButton>
        </div>
        <button
          onClick={close}
          disabled={busy}
          className="rounded-full px-4 py-2 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="mt-3 rounded-2xl border border-border/20 bg-card p-4">
      {/*
        Said once, above the table, and true for THIS wallet.

        An owner's edits are sponsored and free; a controller's are not, because
        Turbo verifies the owner proof against the on-chain owner. Showing the
        owner's promise to a controller would be a claim they discover is false
        at the wallet prompt — the exact failure this copy exists to prevent.
      */}
      {canManage && undernameWrites.costNote && (
        <p className="mb-3 text-xs text-foreground/60">
          {undernameWrites.costNote}
        </p>
      )}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <h2 className="font-heading text-sm font-extrabold uppercase tracking-wide text-foreground/70">
            Records{' '}
            <span className="text-foreground/40">
              ({1 + used}
              {undernameLimit != null ? ` · ${used}/${undernameLimit} undernames` : ''})
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/40" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Search records"
              aria-label="Search records"
              className="w-full rounded-full border border-border/20 bg-background py-1.5 pl-8 pr-3 text-sm focus:border-primary sm:w-52"
            />
          </div>
          {canManage && (
            <button
              onClick={openAdd}
              disabled={atLimit || isAdding}
              title={atLimit ? 'Undername limit reached. Increase it under Renew / upgrade.' : undefined}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          )}
        </div>
      </div>

      {isAdding && (
        <div className="ring-1 ring-primary/20 rounded-xl mb-3">{editor(null)}</div>
      )}

      {shown.length === 0 ? (
        <p className="py-2 text-xs text-foreground/50">No matching records.</p>
      ) : (
        <div className="divide-y divide-border/10">
          {shown.map((r) => {
            const rowBusy = busyKey === r.key;
            const isOpen = editKey === r.key;
            return (
              <div key={r.key}>
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-mono text-sm text-foreground">{r.label}</span>
                    {r.kind === 'apex' && (
                      <span className="flex-shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        root
                      </span>
                    )}
                  </span>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <TargetValue target={r.target} />
                    {r.ttl != null && (
                      <span className="hidden font-mono text-xs text-foreground/40 sm:inline">
                        {r.ttl}s
                      </span>
                    )}
                    {canManage && (
                      <span className="flex items-center gap-1">
                        <button
                          onClick={() => (isOpen ? close() : openEdit(r))}
                          disabled={busy && !isOpen}
                          aria-label={`Edit record ${r.label}`}
                          className="inline-flex items-center gap-1 text-foreground/70 transition-colors hover:text-foreground disabled:opacity-50"
                        >
                          {isOpen ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                        </button>
                        {/* The apex cannot be removed: a name without `@` does not resolve. */}
                        {r.kind === 'undername' && (
                          <SolanaGateButton
                            variant="inline"
                            onAction={() => void remove(r)}
                            disabled={busy}
                            ariaLabel={`Remove record ${r.label}`}
                            actionVerb="remove this record"
                            className="inline-flex items-center gap-1 text-error transition-opacity hover:opacity-80 disabled:opacity-50"
                          >
                            {rowBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </SolanaGateButton>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                {isOpen && editor(r)}
              </div>
            );
          })}
        </div>
      )}

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <button
            onClick={() => setPage(cur - 1)}
            disabled={cur === 0}
            className="rounded-full border border-border/20 px-3 py-1 font-medium text-foreground/70 transition-colors hover:border-primary/40 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-foreground/50">
            Page {cur + 1} of {pageCount}
          </span>
          <button
            onClick={() => setPage(cur + 1)}
            disabled={cur >= pageCount - 1}
            className="rounded-full border border-border/20 px-3 py-1 font-medium text-foreground/70 transition-colors hover:border-primary/40 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
