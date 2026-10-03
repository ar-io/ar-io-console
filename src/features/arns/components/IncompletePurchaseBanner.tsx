import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, Info, X } from 'lucide-react';

import { useTurboArNSClient } from '../hooks/useTurboArNSClient';
import {
  clearPendingArNSPurchase,
  getPendingArNSPurchase,
} from '../services/arnsPurchaseResume';
import { incompletePurchase } from '../purchase/incompletePurchase';
import { toUnicodeName } from '@/utils/punycode';

/**
 * A purchase that was started in this browser and not seen to finish, read
 * live from the payment service: still waiting on the wallet (credits held
 * until a refund), or expired and refunded. See `purchase/incompletePurchase`.
 *
 * It exists for the buyer who closed the tab or the wallet prompt mid-purchase
 * and came back to "No domains yet", with nothing to say what happened to the
 * credits. A purchase that turns out to have completed is cleared and the
 * list refreshed instead.
 */
export default function IncompletePurchaseBanner({
  address,
  ownedNames,
  onCompleted,
}: {
  /** The wallet whose names are shown. */
  address: string | undefined;
  ownedNames: readonly { name: string }[];
  /** A pending purchase turned out to have gone through: refresh the list. */
  onCompleted: () => void;
}) {
  const navigate = useNavigate();
  const client = useTurboArNSClient();
  const [pending, setPending] = useState(() => getPendingArNSPurchase());

  const nonce =
    pending?.intent === 'Buy-Name' && pending.owner === address
      ? pending.nonce
      : undefined;

  const { data: status } = useQuery({
    queryKey: ['arns-action-status', nonce],
    // TanStack Query v5 forbids resolving `undefined`; a failed read is `null`.
    queryFn: async () => (await client.getActionStatus(nonce!)) ?? null,
    enabled: !!nonce,
    staleTime: 10_000,
    // Re-read while it waits on the wallet, so it moves on by itself.
    refetchInterval: (query) =>
      query.state.data?.status === 'awaiting-signature' ? 30_000 : false,
  });

  const view = incompletePurchase({
    pending,
    address,
    ownedNames,
    status: status ?? undefined,
    now: Date.now(),
    displayName: (n) => `${toUnicodeName(n)}.ar.io`,
  });

  const dismiss = () => {
    clearPendingArNSPurchase();
    setPending(undefined);
  };

  // Completed: nothing left to report, and the list should show the name.
  const reportedRef = useRef(false);
  useEffect(() => {
    if (view.kind !== 'completed' || reportedRef.current) return;
    reportedRef.current = true;
    clearPendingArNSPurchase();
    setPending(undefined);
    onCompleted();
  }, [view.kind, onCompleted]);

  if (view.kind !== 'waiting' && view.kind !== 'expired') return null;

  const Icon = view.kind === 'waiting' ? Clock : Info;

  return (
    <div
      role="status"
      className="mb-4 rounded-2xl border border-border/20 bg-card p-4"
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          {/* Short, so it holds one line on a phone; the name, which can be
              long, is in the sentence below. */}
          <p className="text-sm font-semibold text-foreground">
            {view.kind === 'waiting' ? 'Purchase waiting on your wallet' : 'Purchase not finished'}
          </p>
          <p className="mt-0.5 text-xs text-foreground/80 [overflow-wrap:anywhere]">
            {view.message}
          </p>
          {/*
            Only once it has expired. While it waits on the wallet its credits
            are still held, so a second attempt would be refused as unaffordable.
          */}
          {view.kind === 'expired' && (
            <button
              type="button"
              onClick={() => {
                dismiss();
                navigate(`/arns?q=${encodeURIComponent(view.name)}`);
              }}
              className="mt-2 rounded-full bg-foreground px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              Try again
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 flex-shrink-0 rounded-full p-1 text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
