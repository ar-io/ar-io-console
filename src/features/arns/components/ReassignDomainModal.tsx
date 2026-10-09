import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Shuffle,
  XCircle,
} from 'lucide-react';

import { ArNSName } from '@/types';
import BaseModal from '../../../components/modals/BaseModal';
import SolanaGateButton from '../../../components/SolanaGateButton';
import { isValidSolanaAddress } from '../utils';
import { useReassignArNSName } from '../hooks/useReassignArNSName';
import ModalHeader from '../../../components/modals/ModalHeader';
import NeedsSolNote from './NeedsSolNote';
import TransactionReceipt from './TransactionReceipt';
import { buttonClass } from '@/components/button';

interface ReassignDomainModalProps {
  domain: ArNSName;
  onClose: () => void;
  /** Called after a settled reassignment so the caller can refresh its data. */
  onSuccess?: () => void;
}

/**
 * Reassign an ArNS name to a different ANT. Advanced + brick-prone: pointing the
 * name at a wrong/uncontrolled ANT breaks its resolution, so it requires a valid
 * ANT address and an explicit acknowledgement.
 */
export default function ReassignDomainModal({
  domain,
  onClose,
  onSuccess,
}: ReassignDomainModalProps) {
  const [targetAnt, setTargetAnt] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const { reassign, phase, error, txId, isBusy } = useReassignArNSName();

  const trimmed = targetAnt.trim();
  const validTarget =
    isValidSolanaAddress(trimmed) && trimmed !== domain.processId;
  const canReassign = validTarget && acknowledged && !isBusy;

  const handleReassign = async () => {
    try {
      await reassign(domain.name, targetAnt);
      onSuccess?.();
    } catch {
      // surfaced via `error`
    }
  };

  return (
    <BaseModal onClose={onClose} showCloseButton dismissible={!isBusy}>
      <div className="w-[92vw] max-w-md p-4 sm:p-5">
        <ModalHeader
          icon={Shuffle}
          title={
            <>
              Reassign{' '}
              <span className="break-all font-mono text-primary">
                {domain.displayName}.ar.io
              </span>
            </>
          }
          description="Point this name at a different name token"
        />

        {phase === 'success' ? (
          <div className="rounded-2xl border border-primary/30 bg-card p-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-primary" />
            <p className="font-semibold text-foreground">
              Reassigned &quot;{domain.displayName}.ar.io&quot;
            </p>
            <p className="mt-1 text-sm text-foreground/70">
              The name now points at the new ANT.
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
            {/* Same order as Transfer: warning, cost line, input, one
                confirmation, the red button. */}
            <div className="mb-4 rounded-2xl border border-error/30 bg-error/10 p-4 text-sm">
              <div className="mb-1 flex items-center gap-2 font-semibold text-error">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                Check the token address
              </div>
              <p className="text-foreground/80">
                This points {domain.displayName}.ar.io at a different name token,
                which then holds its records. A wrong or inaccessible token breaks
                the name and can lock you out of it.
              </p>
            </div>

            <NeedsSolNote action="Reassigning a name" variant="line" className="mb-4" />

            <label className="mb-2 block text-sm font-medium">
              Target name token (ANT) address
            </label>
            <input
              type="text"
              value={targetAnt}
              onChange={(e) => setTargetAnt(e.target.value)}
              placeholder="Address of a name token you own"
              spellCheck={false}
              disabled={isBusy}
              className="mb-1 w-full rounded-2xl border border-border/20 bg-card p-3 font-mono text-sm text-foreground focus:border-primary disabled:opacity-50"
            />
            {trimmed && !isValidSolanaAddress(trimmed) && (
              <p className="mb-2 text-xs text-error">
                Enter a valid ANT address.
              </p>
            )}
            {trimmed && trimmed === domain.processId && (
              <p className="mb-2 text-xs text-error">
                That&apos;s the name&apos;s current token. Pick a different one.
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
              I own this name token and have checked the address.
            </label>

            {phase === 'error' && error && (
              <div className="mb-4 flex items-start gap-2 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error.message}</span>
              </div>
            )}

            <SolanaGateButton
              onAction={handleReassign}
              disabled={!canReassign}
              busy={isBusy}
              busyLabel={
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Reassigning…
                </>
              }
              className={`${buttonClass('danger', 'lg')} w-full`}
              actionVerb="reassign this name"
            >
              <Shuffle className="h-4 w-4" /> Reassign name
            </SolanaGateButton>
          </>
        )}
      </div>
    </BaseModal>
  );
}
