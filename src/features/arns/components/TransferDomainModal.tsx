import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Send,
  XCircle,
} from 'lucide-react';

import { ArNSName } from '@/types';
import BaseModal from '../../../components/modals/BaseModal';
import SolanaGateButton from '../../../components/SolanaGateButton';
import { isValidSolanaAddress } from '../utils';
import { useTransferArNSName } from '../hooks/useTransferArNSName';

interface TransferDomainModalProps {
  domain: ArNSName;
  onClose: () => void;
  /** Called after a settled transfer so the caller can refresh its data. */
  onSuccess?: () => void;
}

/**
 * Transfer ownership of an ArNS name (its ANT) to another Solana wallet.
 * Irreversible from the sender's side, so it requires a valid recipient and an
 * explicit acknowledgement before the action is enabled.
 */
export default function TransferDomainModal({
  domain,
  onClose,
  onSuccess,
}: TransferDomainModalProps) {
  const [recipient, setRecipient] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const { transfer, phase, error, txId, isBusy } = useTransferArNSName();

  // Trim once and use the SAME value to validate and to write, so the gate can
  // never green-light one address while the transfer submits another.
  const trimmedRecipient = recipient.trim();
  const validRecipient = isValidSolanaAddress(trimmedRecipient);
  const canTransfer = validRecipient && acknowledged && !isBusy;

  const handleTransfer = async () => {
    try {
      await transfer(domain.processId, trimmedRecipient);
      onSuccess?.();
    } catch {
      // surfaced via `error`
    }
  };

  return (
    <BaseModal onClose={onClose} showCloseButton>
      <div className="max-h-[88vh] w-[92vw] max-w-md overflow-y-auto p-6">
        <div className="mb-5">
          <h3 className="font-heading text-xl font-extrabold text-foreground">
            Transfer{' '}
            <span className="break-all font-mono text-primary">
              {domain.displayName}.ar.io
            </span>
          </h3>
        </div>

        {phase === 'success' ? (
          <div className="rounded-2xl border border-primary/30 bg-card p-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-primary" />
            <p className="font-semibold text-foreground">
              Transferred &quot;{domain.displayName}.ar.io&quot;
            </p>
            <p className="mt-1 text-sm text-foreground/70">
              Ownership now belongs to the recipient wallet.
            </p>
            {txId && (
              <div className="mt-2 break-all font-mono text-xs text-foreground/50">
                tx: {txId}
              </div>
            )}
            <button
              onClick={onClose}
              className="mt-4 rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 rounded-2xl border border-error/30 bg-error/10 p-4 text-sm">
              <div className="mb-1 flex items-center gap-2 font-semibold text-error">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                Irreversible — transfer with care
              </div>
              <p className="text-foreground/80">
                This sends full ownership of {domain.displayName}.ar.io and its
                ANT to the wallet below. You&apos;ll permanently lose control of
                the name and every record on it, and it cannot be undone.{' '}
                <span className="font-medium text-foreground">
                  Double-check the address
                </span>{' '}
                — sending to a wrong or inaccessible wallet bricks the name for
                good.
              </p>
            </div>

            <label className="mb-2 block text-sm font-medium">
              Recipient Solana address
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Recipient wallet address"
              spellCheck={false}
              disabled={isBusy}
              className="mb-1 w-full rounded-2xl border border-border/20 bg-card p-3 font-mono text-sm text-foreground focus:border-primary disabled:opacity-50"
            />
            {recipient.trim() && !validRecipient && (
              <p className="mb-2 text-xs text-error">
                Enter a valid Solana wallet address.
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
              I&apos;ve verified the recipient address and understand this
              permanently transfers the name and cannot be undone.
            </label>

            {phase === 'error' && error && (
              <div className="mb-4 flex items-start gap-2 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error.message}</span>
              </div>
            )}

            <SolanaGateButton
              onAction={handleTransfer}
              disabled={!canTransfer}
              busy={isBusy}
              busyLabel={
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Transferring…
                </>
              }
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              actionVerb="transfer this name"
            >
              <Send className="h-4 w-4" /> Transfer name
            </SolanaGateButton>
          </>
        )}
      </div>
    </BaseModal>
  );
}
