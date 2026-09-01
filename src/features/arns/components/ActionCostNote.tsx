import { useArNSActionPrice } from '../hooks/useArNSActionPrice';

/**
 * One line naming what an action costs, above the button that performs it.
 *
 * Every ArNS action carries a credits charge now — the eight non-purchase ones
 * gained a margin after launch, and the SDK's docs still call them free. This
 * fetches the live figure rather than stating one, because the amounts differ
 * per network: removing a controller is 0 on testnet and 0.05 credits on
 * production.
 *
 * While the price is loading it says "a small amount of credits" rather than
 * nothing and rather than "free". Silence in front of a charge is the failure
 * this component exists to prevent, and a wrong "free" is worse than silence.
 */
export default function ActionCostNote({
  action,
  className = '',
}: {
  /** The sponsored action name, e.g. `add-controller`, `transfer`. */
  action: string;
  className?: string;
}) {
  const { credits } = useArNSActionPrice(action);

  const amount =
    credits === undefined
      ? 'a small amount of credits'
      : credits === 0
        ? 'nothing on this network'
        : `about ${credits.toLocaleString(undefined, {
            maximumFractionDigits: 4,
          })} credits`;

  return (
    <p className={`text-xs text-foreground/60 ${className}`}>
      This costs {amount}. Turbo covers the Solana fee, so you don&apos;t need
      SOL.
    </p>
  );
}
