import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, Info, X } from 'lucide-react';

import { useTurboArNSClient } from '../hooks/useTurboArNSClient';
import {
  clearPendingArNSPurchase,
  getPendingArNSPurchase,
} from '../services/arnsPurchaseResume';
import {
  clearHeldAttempt,
  heldStorage,
  readHeldAttempt,
} from '../purchase/actionFailure';
import { incompletePurchase } from '../purchase/incompletePurchase';
import { toUnicodeName } from '@/utils/punycode';
import { buttonClass } from '@/components/button';

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
    // Keyed on the payment service too: a nonce belongs to one network.
    queryKey: ['arns-action-status', client.paymentUrl, nonce],
    /*
      A failed read throws rather than resolving empty, so the last good
      status stays on screen and polling carries on. Resolving empty replaced
      it, hid the banner, and stopped the re-reads.
    */
    queryFn: async () => {
      const s = await client.getActionStatus(nonce!);
      if (!s) throw new Error('Purchase status unavailable');
      return s;
    },
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
    status,
    now: Date.now(),
    displayName: (n) => toUnicodeName(n),
    held: readHeldAttempt(heldStorage(), Date.now()),
  });

  /*
    Forget this purchase. Only if the shared slot still holds it: another tab
    may since have saved a returned-name auction there, whose spawned ANT a
    retry needs to reuse. Once expired its credits are back, so the hold it
    recorded goes too; left behind, it could explain a genuine shortfall on
    the next attempt as "wait for your credits".
  */
  const viewKind = view.kind;
  const forget = useCallback(() => {
    if (getPendingArNSPurchase()?.nonce === pending?.nonce) clearPendingArNSPurchase();
    const held = readHeldAttempt(heldStorage(), Date.now());
    if (viewKind !== 'waiting' && held && held.nonce === pending?.nonce) {
      clearHeldAttempt(heldStorage());
    }
    setPending(undefined);
  }, [pending, viewKind]);
  const dismiss = forget;

  // Once its credits are back (or it landed), the balance shown should agree.
  const refreshedRef = useRef(false);
  useEffect(() => {
    if ((view.kind === 'expired' || view.kind === 'completed') && !refreshedRef.current) {
      refreshedRef.current = true;
      window.dispatchEvent(new CustomEvent('refresh-balance'));
    }
  }, [view.kind]);

  // Completed: nothing left to report, and the list should show the name.
  const reportedRef = useRef(false);
  useEffect(() => {
    if (view.kind !== 'completed' || reportedRef.current) return;
    reportedRef.current = true;
    forget();
    onCompleted();
  }, [view.kind, onCompleted, forget]);

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
            {/* One title for both: nothing is pending in the wallet by now. */}
            Purchase not finished
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
              className={`${buttonClass('secondary', 'xs')} mt-2`}
            >
              Try again
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss purchase notice"
          className="-mr-1 -mt-1 flex-shrink-0 rounded-full p-1 text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
