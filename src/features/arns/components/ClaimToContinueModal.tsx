import { useState } from 'react';
import { AlertTriangle, Loader2, ShieldCheck, Wallet } from 'lucide-react';

import BaseModal from '../../../components/modals/BaseModal';
import ModalHeader from '../../../components/modals/ModalHeader';
import { useTransferCustodialName } from '../hooks/useTransferCustodialName';

interface Props {
  /** The name being claimed, for copy. */
  name: string;
  /** The ANT Turbo holds on the owner's behalf. */
  antId: string;
  /** Where the name is going — the user's own Solana address. */
  targetAddress?: string;
  /** What the user was trying to do, in their words ("set controllers"). */
  actionLabel: string;
  onClose: () => void;
  /** Fired once the name is in the user's wallet, to run the original action. */
  onClaimed: () => void;
}

/**
 * The upgrade path behind an owner-only control on a Turbo-held name.
 *
 * These controls used to be hidden outright, so a custodial name simply had
 * fewer buttons than a self-owned one and nothing said why — the user's own
 * name looked like a lesser product with no way forward. Custody is a starting
 * state, not a tier, so every one of those controls now leads here instead of
 * nowhere, and the thing they clicked runs as soon as the name is theirs.
 *
 * The claim is genuinely cheap, which is the whole reason this works as a
 * prompt rather than a wall: Turbo performs the on-chain write, the user only
 * signs a short action-bound message, and no SOL is spent. Saying so up front
 * is what keeps this from reading like an upsell.
 */
export default function ClaimToContinueModal({
  name,
  antId,
  targetAddress,
  actionLabel,
  onClose,
  onClaimed,
}: Props) {
  const { transfer, phase, error, isBusy } = useTransferCustodialName();
  const [done, setDone] = useState(false);

  const canClaim = Boolean(antId && targetAddress);

  return (
    <BaseModal onClose={onClose} dismissible={!isBusy}>
      <div className="w-[92vw] max-w-md p-4 sm:p-5">
        <ModalHeader
          icon={ShieldCheck}
          title="Move this name to your wallet"
          description={`Needed before you can ${actionLabel}`}
        />

        <p className="mb-4 text-sm text-foreground/80">
          <span className="font-mono text-primary">{name}.ar.io</span> is held
          for you, which is why you didn&apos;t need any crypto to buy it.
          Moving it to your own wallet hands you the name itself — then{' '}
          {actionLabel} works like any other name.
        </p>

        {/* The cost is the objection; answer it before it is raised. */}
        <p className="mb-4 flex items-start gap-2 rounded-2xl border border-border/20 bg-card p-3 text-xs text-foreground/70">
          <Wallet className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>
            Free, and no SOL required — you approve a signature and Turbo does
            the rest. This can&apos;t be undone: the name becomes yours to
            manage.
          </span>
        </p>

        {!canClaim && (
          <p className="mb-4 flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning/10 p-3 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warning" />
            <span>
              {targetAddress
                ? 'This name has no ANT that can be moved yet. Try again in a few minutes.'
                : 'Connect a Solana wallet to hold this name, then try again.'}
            </span>
          </p>
        )}

        {error && (
          <p className="mb-4 flex items-start gap-2 rounded-2xl border border-error/20 bg-error/10 p-3 text-xs text-error">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{error.message}</span>
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canClaim || isBusy || done}
            onClick={() => {
              void transfer({ antId, target: targetAddress as string })
                .then(() => {
                  setDone(true);
                  onClaimed();
                })
                .catch(() => {
                  /* surfaced via `error` above */
                });
            }}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Moving…
              </>
            ) : phase === 'success' ? (
              'Moved'
            ) : (
              `Move & ${actionLabel}`
            )}
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            className="rounded-full border border-border/20 px-5 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
          >
            Not now
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
