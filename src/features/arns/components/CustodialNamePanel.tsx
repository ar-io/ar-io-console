import { useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';

import { useTransferCustodialName } from '../hooks/useTransferCustodialName';

interface Props {
  name: string;
  /** The ANT Turbo holds. Empty when no receipt ever carried one. */
  antId: string;
  /** Where the name should end up — the connected wallet. */
  targetAddress: string | undefined;
  onTransferred?: () => void;
}

/**
 * The manage surface for a name Turbo holds.
 *
 * `canManage` on the detail page is an on-chain owner/controller check, so a
 * custodial name fails it and gets no actions at all — the name is bought,
 * paid for, and apparently inert. This panel is what stands in its place: it
 * says who holds the name, what that allows, and offers the one action that
 * changes it.
 *
 * Transferring is deliberately the prominent control rather than a footnote.
 * Custody is a convenience for buyers with no SOL, not a destination, and every
 * operation Turbo cannot perform becomes available the moment the ANT is
 * theirs.
 */
export default function CustodialNamePanel({
  name,
  antId,
  targetAddress,
  onTransferred,
}: Props) {
  const { transfer, phase, error, isBusy } = useTransferCustodialName();
  const [confirming, setConfirming] = useState(false);

  if (phase === 'success') {
    return (
      <div className="mt-3 rounded-2xl border border-success/20 bg-success/10 p-4">
        <div className="flex items-start gap-2 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
          <span>
            <span className="font-medium text-foreground">
              {name} is now in your wallet.
            </span>{' '}
            Every management action is available — you may need to refresh for
            it to appear.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-border/20 bg-card p-4">
      <h2 className="mb-2 flex items-center gap-1.5 font-heading text-sm font-extrabold uppercase tracking-wide text-foreground/70">
        <ShieldCheck className="h-4 w-4" /> Held by Turbo
      </h2>
      <p className="mb-3 text-sm text-foreground/80">
        You own this name, but Turbo holds its ANT so you didn&apos;t need SOL to
        buy it. You can set its records and renew it as normal.{' '}
        {/* State the limit plainly rather than letting them find it by
            clicking something that isn't there. */}
        To change controllers, edit details, set it as primary, or release it,
        move the name to your wallet first.
      </p>

      {targetAddress && !confirming && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={!antId}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Transfer to my wallet
        </button>
      )}

      {!antId && (
        <p className="text-xs text-foreground/60">
          Turbo has no ANT on record for this name, so there is nothing to
          transfer.
        </p>
      )}

      {targetAddress && confirming && (
        <div className="rounded-xl border border-border/20 bg-background p-3">
          <p className="mb-2 text-sm text-foreground/80">
            Move {name} to{' '}
            <span className="break-all font-mono text-xs">{targetAddress}</span>?
            {/* One-way and irreversible by us — say so before, not after. */}{' '}
            Turbo will no longer be able to manage it for you.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                void transfer({ antId, target: targetAddress })
                  .then(() => onTransferred?.())
                  .catch(() => {
                    /* surfaced via `error` below */
                  });
              }}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Transferring…
                </>
              ) : (
                'Confirm transfer'
              )}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setConfirming(false)}
              className="rounded-full border border-border/20 px-5 py-2.5 text-sm font-semibold text-foreground hover:border-primary/40 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!targetAddress && (
        <p className="text-xs text-foreground/60">
          Connect the wallet that bought this name to transfer it.
        </p>
      )}

      {phase === 'error' && error && (
        <p className="mt-2 flex items-start gap-2 text-xs text-error">
          <XCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
          <span>{error.message}</span>
        </p>
      )}
    </div>
  );
}
