import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Star } from 'lucide-react';

import type { ArNSName } from '@/types';
import {
  PrimaryNameModal,
  usePrimaryName,
  useArNSTurboSigner,
} from '@/features/arns';
import type { PrimaryNameModalMode } from '@/features/arns';

interface PrimaryNameCardProps {
  address: string;
  ownedNames: ArNSName[];
  /** Called after a successful primary-name write, to refresh owned names. */
  onChanged?: () => void;
}

/** Split a primary target (`label_base` or `base`) into its base name. */
function baseNameOf(fullName: string): string {
  const s = fullName.trim().toLowerCase();
  const idx = s.indexOf('_');
  return idx === -1 ? s : s.slice(idx + 1);
}

/**
 * Account-page card for the wallet's ArNS primary name (reverse resolution).
 * Shows the current primary, any pending request, and the write actions
 * (set / change / remove, and approve when the wallet owns a requested name).
 * Only exposes controls when a live Solana signer is available.
 */
export default function PrimaryNameCard({
  address,
  ownedNames,
  onChanged,
}: PrimaryNameCardProps) {
  const signer = useArNSTurboSigner();
  const queryClient = useQueryClient();
  const { data, isLoading } = usePrimaryName(address, true);
  const [modalMode, setModalMode] = useState<PrimaryNameModalMode | null>(null);

  const current = data?.current;
  const request = data?.request;

  // Prefer the owned name's decoded display; fall back to the registry form.
  const currentDisplay = useMemo(() => {
    if (!current) return undefined;
    const owned = ownedNames.find((n) => n.name === current.name);
    return owned?.displayName ?? current.name;
  }, [current, ownedNames]);

  // True when the wallet owns the ANT behind a pending request's base name.
  const canApproveRequest = useMemo(() => {
    if (!request) return false;
    const base = baseNameOf(request.name);
    return ownedNames.some((n) => n.name === base || n.displayName === base);
  }, [request, ownedNames]);

  const handleChanged = () => {
    queryClient.invalidateQueries({ queryKey: ['arns-primary-name', address] });
    onChanged?.();
  };

  const closeModal = () => setModalMode(null);

  return (
    <div className="rounded-2xl border border-border/20 bg-card p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-background">
          <Star className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-heading text-lg font-bold text-foreground">
            Primary name
          </h3>
          <p className="text-sm text-foreground/70">
            The name your wallet reverse-resolves to.
          </p>
        </div>
      </div>

      {!signer.isReady ? (
        <p className="text-sm text-foreground/60">
          Connect a Solana wallet to manage your primary name.
        </p>
      ) : isLoading ? (
        <div className="flex items-center gap-2 text-sm text-foreground/70">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading primary name…
        </div>
      ) : (
        <div className="space-y-3">
          {current ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-sm text-primary">
                {currentDisplay}.ar.io
              </span>
              <div className="flex items-center gap-3 text-sm">
                <button
                  onClick={() => setModalMode('change')}
                  className="text-foreground/70 hover:text-foreground hover:underline"
                >
                  Change
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-foreground/60">No primary name set.</p>
              <button
                onClick={() => setModalMode('set')}
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Set primary name
              </button>
            </div>
          )}

          {request && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-warning/30 bg-warning/10 p-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                Request pending: {request.name}.ar.io
              </span>
              {canApproveRequest && (
                <button
                  onClick={() => setModalMode('approve')}
                  className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Approve
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {modalMode && (
        <PrimaryNameModal
          mode={modalMode}
          ownedNames={ownedNames}
          currentPrimary={current?.name}
          presetProcessId={
            modalMode === 'approve' && request
              ? ownedNames.find(
                  (n) =>
                    n.name === baseNameOf(request.name) ||
                    n.displayName === baseNameOf(request.name),
                )?.processId
              : undefined
          }
          pendingRequest={
            request
              ? { name: request.name, initiator: request.initiator }
              : undefined
          }
          onClose={closeModal}
          onSuccess={() => {
            handleChanged();
          }}
        />
      )}
    </div>
  );
}
