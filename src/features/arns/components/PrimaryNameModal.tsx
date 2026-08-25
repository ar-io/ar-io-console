import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  Search,
  Star,
  XCircle,
} from 'lucide-react';

import { ArNSName } from '@/types';
import BaseModal from '../../../components/modals/BaseModal';
import { usePrimaryNameActions } from '../hooks/usePrimaryNameActions';
import { parsePrimaryName } from '../utils';

export type PrimaryNameModalMode = 'set' | 'change' | 'approve';

interface PrimaryNameModalProps {
  mode: PrimaryNameModalMode;
  /** All names owned by the connected wallet (for the set/change picker). */
  ownedNames: ArNSName[];
  /** Preselect a specific owned name (e.g. from a domain row). */
  presetName?: string;
  presetProcessId?: string;
  /** The wallet's current primary name (registry form), if any. */
  currentPrimary?: string;
  /** A pending request the wallet may approve (approve mode). */
  pendingRequest?: { name: string; initiator: string };
  onClose: () => void;
  /** Called after any successful write, so the caller can refetch/invalidate. */
  onSuccess?: () => void;
}

const TITLES: Record<PrimaryNameModalMode, string> = {
  set: 'Set primary name',
  change: 'Change primary name',
  approve: 'Approve primary name request',
};

const inputCls =
  'w-full rounded-2xl border border-border/20 bg-card p-3 text-sm text-foreground focus:border-primary disabled:opacity-50';

/**
 * Manage the connected wallet's ArNS primary name (reverse resolution). Setting
 * a name you own is a single wallet approval (request + self-approve); a name
 * owned by someone else creates a pending request its owner must approve. Remove
 * and owner-side approve are the ANT-owner paths.
 */
export default function PrimaryNameModal({
  mode,
  ownedNames,
  presetName,
  presetProcessId,
  currentPrimary,
  pendingRequest,
  onClose,
  onSuccess,
}: PrimaryNameModalProps) {
  const navigate = useNavigate();
  const {
    setPrimaryName,
    approveRequest,
    phase,
    statusMessage,
    error,
    insufficientCredits,
    isBusy,
  } = usePrimaryNameActions();

  // --- set / change: pick an owned name ---
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ArNSName | null>(() => {
    if (!presetName && !presetProcessId) return null;
    return (
      ownedNames.find(
        (n) =>
          (presetProcessId && n.processId === presetProcessId) ||
          n.name === presetName ||
          n.displayName === presetName,
      ) ?? null
    );
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ownedNames;
    return ownedNames.filter(
      (n) =>
        n.displayName.toLowerCase().includes(q) ||
        n.name.toLowerCase().includes(q),
    );
  }, [ownedNames, query]);

  const isPickMode = mode === 'set' || mode === 'change';

  const afterWrite = () => {
    onSuccess?.();
  };

  const handleSet = async () => {
    if (!selected) return;
    try {
      // Insufficient-credits failures resolve to `undefined` (the write did NOT
      // land) while surfacing the error via state — mirror ManageDomainModal and
      // only fire onSuccess when we actually got a tx id back.
      const id = await setPrimaryName({ name: selected.name });
      if (id) afterWrite();
    } catch {
      /* surfaced via error */
    }
  };

  const handleApprove = async () => {
    if (!pendingRequest) return;
    try {
      const id = await approveRequest({
        name: pendingRequest.name,
        address: pendingRequest.initiator,
      });
      if (id) afterWrite();
    } catch {
      /* surfaced via error */
    }
  };

  // Approve gate: we must own the request's base name to approve it. Gate purely
  // on actually owning that base name — a bare presetProcessId doesn't prove
  // ownership of pendingRequest.name, so it must not enable approval on its own
  // (the on-chain write would reject a non-owner anyway).
  const approveBaseOwned = useMemo(() => {
    if (!pendingRequest) return false;
    const { baseName } = parsePrimaryName(pendingRequest.name);
    return ownedNames.some(
      (n) => n.name === baseName || n.displayName === baseName,
    );
  }, [pendingRequest, ownedNames]);

  return (
    <BaseModal onClose={onClose} showCloseButton>
      <div className="w-[92vw] max-w-lg p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-card">
            <Star className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-heading text-xl font-extrabold text-foreground">
              {TITLES[mode]}
            </h3>
            <p className="text-sm text-foreground/70">
              The one name that stands for your wallet across ar.io apps.
            </p>
          </div>
        </div>

        {phase === 'success' ? (
          <div className="rounded-2xl border border-primary/30 bg-card p-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-primary" />
            <p className="font-semibold text-foreground">{statusMessage}</p>
            <button
              onClick={onClose}
              className="mt-4 rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Info banner */}
            <div className="mb-4 flex items-start gap-2 rounded-2xl border border-border/20 bg-card p-3 text-xs text-foreground/70">
              <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
              {mode === 'approve' ? (
                <span>
                  This finishes a pending primary-name request for a name you
                  own — the wallet that made the request is linked to the name
                  for reverse resolution. One wallet approval as the name&apos;s
                  owner.
                </span>
              ) : (
                <span>
                  Setting a name you own is a single wallet approval. A name
                  owned by someone else instead creates a pending request the
                  owner must approve.{' '}
                  <a
                    href="https://docs.ar.io/learn/arns"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-primary hover:underline"
                  >
                    Learn about primary names
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </span>
              )}
            </div>

            {/* set / change body */}
            {isPickMode && (
              <div>
                {currentPrimary && (
                  <div className="mb-3">
                    <p className="mb-1 text-xs font-medium text-foreground/60">
                      Current primary
                    </p>
                    <div className="rounded-2xl border border-border/20 bg-card p-3 font-mono text-sm text-foreground">
                      {currentPrimary}.ar.io
                    </div>
                    <div className="my-2 flex justify-center">
                      <ArrowDown className="h-4 w-4 text-foreground/40" />
                    </div>
                  </div>
                )}

                <label className="mb-1 block text-sm font-medium">
                  {currentPrimary ? 'New primary name' : 'Choose a name you own'}
                </label>

                {selected ? (
                  <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-success/40 bg-success/10 p-3">
                    <span className="truncate font-mono text-sm text-foreground">
                      {selected.displayName}.ar.io
                    </span>
                    <button
                      onClick={() => setSelected(null)}
                      disabled={isBusy}
                      className="flex-shrink-0 text-xs text-foreground/60 hover:underline disabled:opacity-50"
                    >
                      Change
                    </button>
                  </div>
                ) : ownedNames.length === 0 ? (
                  <p className="py-4 text-sm text-foreground/60">
                    You don&apos;t own any names yet.
                  </p>
                ) : (
                  <>
                    <div className="relative mb-2">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
                      <input
                        className={`${inputCls} pl-9`}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search your names…"
                        spellCheck={false}
                        disabled={isBusy}
                      />
                    </div>
                    <ul className="mb-3 max-h-56 space-y-1 overflow-y-auto">
                      {filtered.map((n) => (
                        <li key={n.processId}>
                          <button
                            onClick={() => setSelected(n)}
                            disabled={isBusy}
                            className="block w-full truncate rounded-xl border border-border/20 bg-card px-3 py-2 text-left font-mono text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                          >
                            {n.displayName}.ar.io
                          </button>
                        </li>
                      ))}
                      {filtered.length === 0 && (
                        <li className="px-1 py-2 text-sm text-foreground/60">
                          No matching names.
                        </li>
                      )}
                    </ul>
                  </>
                )}

                <button
                  onClick={handleSet}
                  disabled={!selected || isBusy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {statusMessage || 'Working…'}
                    </>
                  ) : mode === 'change' ? (
                    'Change primary name'
                  ) : (
                    'Set primary name'
                  )}
                </button>
              </div>
            )}

            {/* approve body */}
            {mode === 'approve' && (
              <div>
                {pendingRequest ? (
                  <div className="mb-3 rounded-2xl border border-border/20 bg-card p-3">
                    <p className="mb-1 text-xs font-medium text-foreground/60">
                      Requested name
                    </p>
                    <p className="mb-3 break-all font-mono text-sm text-foreground">
                      {pendingRequest.name}.ar.io
                    </p>
                    <p className="mb-1 text-xs font-medium text-foreground/60">
                      Requester
                    </p>
                    <p className="break-all font-mono text-xs text-foreground/80">
                      {pendingRequest.initiator}
                    </p>
                  </div>
                ) : (
                  <p className="py-4 text-sm text-foreground/60">
                    No pending request to approve.
                  </p>
                )}
                {pendingRequest && !approveBaseOwned && (
                  <p className="mb-3 text-xs text-error">
                    You must control this name to approve the request.
                  </p>
                )}
                <button
                  onClick={handleApprove}
                  disabled={!pendingRequest || !approveBaseOwned || isBusy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {statusMessage || 'Working…'}
                    </>
                  ) : (
                    'Approve request'
                  )}
                </button>
              </div>
            )}

            {/* Errors */}
            {phase === 'error' && error && (
              <div className="mt-4 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
                <div className="flex items-start gap-2">
                  <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error.message}</span>
                </div>
                {insufficientCredits && (
                  <button
                    onClick={() => {
                      onClose();
                      navigate('/topup');
                    }}
                    className="mt-2 font-semibold text-primary hover:underline"
                  >
                    Top up credits →
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </BaseModal>
  );
}
