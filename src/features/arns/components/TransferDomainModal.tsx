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
import ModalHeader from '../../../components/modals/ModalHeader';
import ActionCostNote from './ActionCostNote';
import TransactionReceipt from './TransactionReceipt';
import { buttonClass } from '@/components/button';

interface TransferDomainModalProps {
  domain: ArNSName;
  onClose: () => void;
  /** Called after a settled transfer so the caller can refresh its data. */
  /** Fired after the transfer lands, with the new owner. */
  onSuccess?: (newOwner?: string) => void;
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
  const {
    transfer,
    phase,
    error,
    paysNetworkDirectly,
    alternative,
    switchRail,
    pending,
    txId,
    isBusy,
  } = useTransferArNSName(domain.processId);

  // Trim once and use the SAME value to validate and to write, so the gate can
  // never green-light one address while the transfer submits another.
  const trimmedRecipient = recipient.trim();
  const validRecipient = isValidSolanaAddress(trimmedRecipient);
  const canTransfer = validRecipient && acknowledged && !isBusy;

  const handleTransfer = async () => {
    try {
      await transfer(domain.processId, trimmedRecipient);
      onSuccess?.(trimmedRecipient);
    } catch {
      // surfaced via `error`
    }
  };

  return (
    <BaseModal onClose={onClose} showCloseButton dismissible={!isBusy}>
      <div className="w-[92vw] max-w-md p-4 sm:p-5">
        <ModalHeader
          icon={Send}
          title={
            <>
              Transfer{' '}
              <span className="font-mono text-primary [overflow-wrap:anywhere]">
                {domain.displayName}.ar.io
              </span>
            </>
          }
          description="Send ownership to another wallet"
        />

        {phase === 'success' ? (
          <div className="rounded-2xl border border-primary/30 bg-card p-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-primary" />
            <p className="font-semibold text-foreground">
              Transferred &quot;{domain.displayName}.ar.io&quot;
            </p>
            <p className="mt-1 text-sm text-foreground/70">
              Ownership now belongs to the recipient wallet.
            </p>
            <TransactionReceipt txId={txId} className="mt-3" />
            <button
              onClick={onClose}
              className={`${buttonClass('secondary', 'md')} mt-4`}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 rounded-2xl border border-error/30 bg-error/10 p-4 text-sm">
              <div className="mb-1 flex items-center gap-2 font-semibold text-error">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                This can&apos;t be undone
              </div>
              <p className="text-foreground/80">
                {/* Say what goes, the name and everything on it, rather than
                    "its ANT", and keep it to the two facts that matter. */}
                This permanently gives {domain.displayName}.ar.io and all its
                records to the wallet below.{' '}
                <span className="font-medium text-foreground">
                  Check the address:
                </span>{' '}
                a wrong one loses the name for good.
              </p>
            </div>

            {/* Transfer is one of the priced actions; the warning above is
                about permanence, not cost, and both need saying. */}
            <ActionCostNote
              action="transfer"
              paysNetworkDirectly={paysNetworkDirectly}
              alternative={alternative}
              onSwitchRail={switchRail}
              pending={pending}
              disabled={isBusy}
              className="mb-4"
            />

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
              I&apos;ve checked the address. This transfer is permanent.
            </label>

            {phase === 'error' && error && (
              <div className="mb-4 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
                <div className="flex items-start gap-2">
                  <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error.message}</span>
                </div>
              </div>
            )}

            <SolanaGateButton
              onAction={handleTransfer}
              disabled={!canTransfer || pending}
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
