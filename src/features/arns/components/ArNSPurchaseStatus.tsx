import { CheckCircle2, Loader2, AlertTriangle, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import type { ArNSSettlementResult } from '../services/TurboArNSClient';
import type { BuyPhase } from '../hooks/useBuyArNSName';

interface ArNSPurchaseStatusProps {
  phase: BuyPhase;
  statusMessage: string;
  result: ArNSSettlementResult | undefined;
  error: Error | undefined;
  insufficientCredits: boolean;
  name: string;
  onDone: () => void;
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
}: ArNSPurchaseStatusProps) {
  const navigate = useNavigate();

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
    return (
      <div className="mt-4 bg-card rounded-2xl border border-primary/30 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-foreground">
              Registered "{name}.ar.io"
            </p>
            <p className="text-sm text-foreground/70 mt-1">
              Your ArNS name is now yours and resolves across the AR.IO network.
            </p>
            <div className="mt-2 text-xs font-mono text-foreground/50 break-all">
              tx: {result.messageId}
            </div>
            <button onClick={onDone} className="btn-primary mt-4">
              Register another
            </button>
          </div>
        </div>
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
              You don't have enough credits to register this name. Top up and try
              again — your name selection is preserved.
            </p>
            <button
              onClick={() => navigate('/topup')}
              className="btn-primary mt-4 inline-flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" /> Buy Credits
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
          <button onClick={onDone} className="btn-primary mt-4">
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
