import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Flame,
  Loader2,
  XCircle,
} from 'lucide-react';

import { ArNSName } from '@/types';
import BaseModal from '../../../components/modals/BaseModal';
import SolanaGateButton from '../../../components/SolanaGateButton';
import { lowerCaseDomain } from '../utils';
import { useReleaseName } from '../hooks/useReleaseName';
import ModalHeader from '../../../components/modals/ModalHeader';
import NeedsSolNote from './NeedsSolNote';
import TransactionReceipt from './TransactionReceipt';
import { buttonClass } from '@/components/button';

interface ReleaseDomainModalProps {
  domain: ArNSName;
  onClose: () => void;
  /** Called after a settled release so the caller can refresh its data. */
  onSuccess?: () => void;
}

/**
 * Release a permanently-owned (permabuy) ArNS name back to the protocol,
 * starting a 14-day returned-name auction. The caller gets nothing back and the
 * name resolves to no one until someone buys it, so it is gated behind typing
 * the name: one deliberate confirmation, as on the other modals. Only offered for
 * permabuy names (leases expire on their own — there is nothing to release).
 */
export default function ReleaseDomainModal({
  domain,
  onClose,
  onSuccess,
}: ReleaseDomainModalProps) {
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState('');
  const { release, phase, error, txId, isBusy } = useReleaseName();

  // Type the name to arm (case-insensitive). Match the released identifier
  // `domain.name` — and also accept `displayName` (its Unicode form for IDNs)
  // since that's what the user sees — so the confirmation can never green-light
  // releasing a different name than the one typed.
  const typedName = lowerCaseDomain(confirmText);
  const nameMatches =
    typedName === lowerCaseDomain(domain.name) ||
    typedName === lowerCaseDomain(domain.displayName);
  const canRelease = nameMatches && !isBusy;

  const handleRelease = async () => {
    try {
      await release(domain.name);
      onSuccess?.();
    } catch {
      // surfaced via `error`
    }
  };

  return (
    <BaseModal onClose={onClose} showCloseButton dismissible={!isBusy}>
      <div className="w-[92vw] max-w-md p-4 sm:p-5">
        <ModalHeader
          icon={Flame}
          title={
            <>
              Release{' '}
              <span className="inline-block max-w-full font-mono text-primary [overflow-wrap:anywhere]">
                {domain.displayName}
              </span>
            </>
          }
          description="Give up the name to a 14-day auction"
        />

        {phase === 'success' ? (
          <div className="rounded-2xl border border-primary/30 bg-card p-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-primary" />
            <p className="font-semibold text-foreground">
              Released &quot;{domain.displayName}&quot;
            </p>
            <p className="mt-1 text-sm text-foreground/70">
              It&apos;s now in a 14-day returned-name auction, where anyone can
              buy it. You no longer own it.
            </p>
            <TransactionReceipt txId={txId} className="mt-3" />
            <div className="mt-4 flex flex-col items-center gap-2">
              <button
                onClick={() => {
                  onClose();
                  navigate('/returned-names');
                }}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                View returned-name auctions
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onClose}
                className={buttonClass('secondary', 'md')}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 rounded-2xl border border-error/30 bg-error/10 p-4 text-sm">
              <div className="mb-1 flex items-center gap-2 font-semibold text-error">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                This can&apos;t be undone
              </div>
              <p className="text-foreground/80">
                This gives up {domain.displayName} to a 14-day public
                auction, with no refund. Its records stop resolving, and if it is
                your primary name, that link breaks too.
              </p>
            </div>

            <NeedsSolNote action="Releasing a name" variant="line" className="mb-4" />

            <label
              htmlFor="release-confirm-name"
              className="mb-2 block text-sm font-medium"
            >
              Type{' '}
              <span className="inline-block max-w-full font-mono text-primary [overflow-wrap:anywhere]">
                {domain.displayName}
              </span>{' '}
              to confirm
            </label>
            <input
              id="release-confirm-name"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={domain.displayName}
              spellCheck={false}
              autoComplete="off"
              disabled={isBusy}
              className="mb-1 w-full rounded-2xl border border-border/20 bg-card p-3 font-mono text-sm text-foreground focus:border-primary disabled:opacity-50"
            />
            {confirmText.trim() && !nameMatches && (
              <p className="mb-2 text-xs text-error">
                That doesn&apos;t match the name.
              </p>
            )}

            {phase === 'error' && error && (
              <div className="mb-4 flex items-start gap-2 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error.message}</span>
              </div>
            )}

            <SolanaGateButton
              onAction={handleRelease}
              disabled={!canRelease}
              busy={isBusy}
              busyLabel={
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Releasing…
                </>
              }
              className={`${buttonClass('danger', 'lg')} mt-3 w-full`}
              actionVerb="release this name"
            >
              <Flame className="h-4 w-4" /> Release name to auction
            </SolanaGateButton>
          </>
        )}
      </div>
    </BaseModal>
  );
}
