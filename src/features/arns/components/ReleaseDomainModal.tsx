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

interface ReleaseDomainModalProps {
  domain: ArNSName;
  onClose: () => void;
  /** Called after a settled release so the caller can refresh its data. */
  onSuccess?: () => void;
}

/**
 * Release a permanently-owned (permabuy) ArNS name back to the protocol,
 * starting a 14-day returned-name auction. The caller gets nothing back and the
 * name resolves to no one until someone buys it, so this is gated behind BOTH a
 * typed-name confirmation and an explicit acknowledgement. Only offered for
 * permabuy names (leases expire on their own — there is nothing to release).
 */
export default function ReleaseDomainModal({
  domain,
  onClose,
  onSuccess,
}: ReleaseDomainModalProps) {
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const { release, phase, error, txId, isBusy } = useReleaseName();

  // Type the name to arm (case-insensitive). Match the released identifier
  // `domain.name` — and also accept `displayName` (its Unicode form for IDNs)
  // since that's what the user sees — so the confirmation can never green-light
  // releasing a different name than the one typed.
  const typedName = lowerCaseDomain(confirmText);
  const nameMatches =
    typedName === lowerCaseDomain(domain.name) ||
    typedName === lowerCaseDomain(domain.displayName);
  const canRelease = nameMatches && acknowledged && !isBusy;

  const handleRelease = async () => {
    try {
      await release(domain.name);
      onSuccess?.();
    } catch {
      // surfaced via `error`
    }
  };

  return (
    <BaseModal onClose={onClose} showCloseButton>
      <div className="w-[92vw] max-w-md p-4 sm:p-5">
        <ModalHeader
          icon={Flame}
          title={
            <>
              Release{' '}
              <span className="break-all font-mono text-primary">
                {domain.displayName}.ar.io
              </span>
            </>
          }
          description="Give up the name to a 14-day auction"
        />

        {phase === 'success' ? (
          <div className="rounded-2xl border border-primary/30 bg-card p-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-primary" />
            <p className="font-semibold text-foreground">
              Released &quot;{domain.displayName}.ar.io&quot;
            </p>
            <p className="mt-1 text-sm text-foreground/70">
              It&apos;s now in a 14-day returned-name auction, where anyone can
              buy it. You no longer own it.
            </p>
            {txId && (
              <div className="mt-2 break-all font-mono text-xs text-foreground/50">
                tx: {txId}
              </div>
            )}
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
                className="rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
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
                Irreversible — you give up this name for nothing
              </div>
              <p className="text-foreground/80">
                Releasing gives up your permanent ownership of{' '}
                {domain.displayName}.ar.io and puts it into a{' '}
                <span className="font-medium text-foreground">
                  14-day declining-price auction
                </span>{' '}
                that anyone can buy from. You receive no refund, everything the
                name points at (its records and undernames) stops resolving, and
                if it&apos;s your primary name that link breaks too. This cannot
                be undone.
              </p>
            </div>

            <label
              htmlFor="release-confirm-name"
              className="mb-2 block text-sm font-medium"
            >
              Type{' '}
              <span className="break-all font-mono text-primary">
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

            <label className="mb-4 mt-3 flex items-start gap-2 text-sm text-foreground/80">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                disabled={isBusy}
                className="mt-0.5"
              />
              I understand this permanently gives up the name to a public auction
              and cannot be undone.
            </label>

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
              className="flex w-full items-center justify-center gap-2 rounded-full bg-error px-6 py-3 font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
