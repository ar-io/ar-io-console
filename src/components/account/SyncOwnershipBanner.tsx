import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

import { useAclDrift } from '@/features/arns/hooks/useAclDrift';
import { useSyncOwnership } from '@/features/arns/hooks/useSyncOwnership';

interface SyncOwnershipBannerProps {
  /** Connected/linked Solana address to check for ACL drift. */
  address: string | null | undefined;
  /** Called after a successful sync so the caller can refetch owned names. */
  onSynced?: () => void;
}

/**
 * Surfaces ArNS names the wallet owns on-chain but that are missing from its
 * ACL — the result of an ANT (NFT) received outside this app (a direct transfer
 * or a Solana NFT marketplace). Such names don't show under "your names" until
 * reconciled, so this banner offers a one-click `syncAcl` for exactly those
 * drifted names (never a blind sync, which the program rejects when nothing has
 * drifted). Renders nothing when there's no drift.
 */
export default function SyncOwnershipBanner({
  address,
  onSynced,
}: SyncOwnershipBannerProps) {
  const queryClient = useQueryClient();
  const { data: drift } = useAclDrift(address);
  const { syncNames, phase, progress, failed, isBusy } = useSyncOwnership();

  const driftRecords = drift ?? [];
  if (driftRecords.length === 0 && phase !== 'success') return null;

  const handleSync = async () => {
    try {
      await syncNames(
        driftRecords.map((d) => ({ name: d.name, processId: d.processId })),
      );
    } catch {
      /* surfaced via phase/failed */
    } finally {
      queryClient.invalidateQueries({ queryKey: ['arns-acl-drift'] });
      onSynced?.();
    }
  };

  if (phase === 'success') {
    const okCount = progress.total - failed.length;
    return (
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
        <div className="text-sm">
          <p className="font-medium text-foreground">
            Synced {okCount} {okCount === 1 ? 'name' : 'names'}
          </p>
          {failed.length > 0 && (
            <p className="mt-0.5 text-foreground/70">
              {failed.length} couldn&apos;t be synced ({failed.join(', ')}).
              They may already be up to date — refresh to check.
            </p>
          )}
        </div>
      </div>
    );
  }

  const n = driftRecords.length;
  return (
    <div className="mb-4 rounded-2xl border border-warning/30 bg-warning/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <RefreshCw className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
          <div className="text-sm">
            <p className="font-medium text-foreground">
              {n} {n === 1 ? 'name you own isn’t' : 'names you own aren’t'}{' '}
              showing here yet
            </p>
            <p className="mt-0.5 text-foreground/70">
              {n === 1 ? 'It was' : 'They were'} transferred to your wallet
              outside this app. Sync ownership to reconcile{' '}
              {n === 1 ? 'it' : 'them'} with the network.
            </p>
            <p className="mt-1 truncate font-mono text-xs text-foreground/50">
              {driftRecords.map((d) => `${d.name}.ar.io`).join(', ')}
            </p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={isBusy}
          className="inline-flex flex-shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isBusy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Syncing {progress.done + 1}/{progress.total}…
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" /> Sync ownership
            </>
          )}
        </button>
      </div>
    </div>
  );
}
