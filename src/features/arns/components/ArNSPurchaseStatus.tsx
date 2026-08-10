import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  Pencil,
  Rocket,
  Settings2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import type { ArNSName } from '@/types';
import type { ArNSSettlementResult } from '../services/TurboArNSClient';
import { toUnicodeName } from '../../../utils/punycode';
import type { BuyPhase } from '../hooks/useBuyArNSName';
import EditDetailsModal from './EditDetailsModal';

interface ArNSPurchaseStatusProps {
  phase: BuyPhase;
  statusMessage: string;
  result: ArNSSettlementResult | undefined;
  error: Error | undefined;
  insufficientCredits: boolean;
  name: string;
  /** Reset the whole flow (clears the selected name). Used by "Register another". */
  onDone: () => void;
  /** Retry the same name — resets buy state but keeps the selection. */
  onRetry?: () => void;
}

/**
 * In-flight / terminal state for a credit-paid ArNS purchase: progress spinner,
 * success receipt, or an error. The insufficient-credits case routes to
 * console's existing Top-Up flow (`/topup`) rather than showing a dead error.
 */
export function ArNSPurchaseStatus({
  phase,
  statusMessage,
  result,
  error,
  insufficientCredits,
  name,
  onDone,
  onRetry,
}: ArNSPurchaseStatusProps) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  if (phase === 'idle') return null;

  const busy = phase === 'submitting';

  if (busy) {
    return (
      <div className="mt-4 bg-card rounded-2xl border border-primary/30 p-5">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
          <div>
            <p className="font-medium text-foreground">{statusMessage}</p>
            <p className="text-xs text-foreground/60 mt-0.5">
              Keep this tab open. Your credits are only charged once the purchase
              is confirmed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'success' && result) {
    // buyRecord returns the freshly minted ANT id — lets the user set where the
    // name points (its base @ target) right away instead of the default logo.
    const newProcessId = (
      result.receipt as { processId?: string | null } | undefined
    )?.processId;
    const newDomain: ArNSName | undefined = newProcessId
      ? { name, displayName: toUnicodeName(name), processId: newProcessId }
      : undefined;

    return (
      <div className="mt-4 bg-card rounded-2xl border border-primary/30 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-foreground">
              Registered "{toUnicodeName(name)}.ar.io"
            </p>
            <p className="text-sm text-foreground/70 mt-1">
              The name is now yours and resolves across the ar.io network.
            </p>
            <div className="mt-2 text-xs font-mono text-foreground/50 break-all">
              tx: {result.messageId}
            </div>

            <p className="mt-4 text-sm font-medium text-foreground">
              What&apos;s next?
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => navigate('/deploy')}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Rocket className="h-4 w-4" /> Deploy a site
              </button>
              {newDomain && (
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-primary/10 transition-colors"
                >
                  <Pencil className="h-4 w-4" /> Edit details
                </button>
              )}
              <button
                onClick={() => navigate('/my-domains')}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-primary/10 transition-colors"
              >
                <Settings2 className="h-4 w-4" /> Manage domains
              </button>
              <a
                href={`https://${name}.ar.io`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-primary/10 transition-colors"
              >
                Visit <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <button
              onClick={onDone}
              className="mt-3 text-sm font-medium text-primary hover:underline"
            >
              Register another name
            </button>
          </div>
        </div>
        {editing && newDomain && (
          <EditDetailsModal
            domain={newDomain}
            onClose={() => setEditing(false)}
          />
        )}
      </div>
    );
  }

  // phase === 'error'
  if (insufficientCredits) {
    return (
      <div className="mt-4 bg-warning/10 rounded-2xl border border-warning/30 p-5">
        <div className="flex items-start gap-3">
          <CreditCard className="w-6 h-6 text-warning flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-foreground">
              Not enough Turbo Credits
            </p>
            <p className="text-sm text-foreground/70 mt-1">
              You don't have enough credits to register this name. Add Turbo
              Credits, then search for "{name}" again to finish registering.
            </p>
            <button
              onClick={() => navigate('/topup')}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <CreditCard className="w-4 h-4" /> Buy Turbo Credits
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 bg-error/10 rounded-2xl border border-error/20 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-6 h-6 text-error flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-error">Purchase didn't complete</p>
          <p className="text-sm text-foreground/70 mt-1">
            {error?.message ?? 'Something went wrong. Please try again.'}
          </p>
          <button
            onClick={onRetry ?? onDone}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
