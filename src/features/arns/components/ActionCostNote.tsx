import type { ArNSAction } from '@ardrive/turbo-sdk/web';

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
/** Format one price, keeping "unknown" and "zero" distinguishable. */
function amountText(credits: number | undefined): string {
  if (credits === undefined) return 'a small amount of credits';
  if (credits === 0) return 'nothing on this network';
  return `about ${credits.toLocaleString(undefined, {
    maximumFractionDigits: 4,
  })} credits`;
}

export default function ActionCostNote({
  action,
  secondaryAction,
  secondaryVerb,
  primaryVerb,
  className = '',
}: {
  /** The sponsored action, typed against the SDK so a typo cannot compile. */
  action: ArNSAction;
  /**
   * A second action performed from the same screen, priced separately.
   *
   * Controllers are the case this exists for: adding and removing are distinct
   * actions and genuinely differ — on testnet one is roughly ten times the
   * other, while production happens to charge the same for both. Quoting one
   * figure for both buttons is therefore right on production and wrong exactly
   * where the app is tested.
   */
  secondaryAction?: ArNSAction;
  /** Verb for the primary action, e.g. "Adding a controller". */
  primaryVerb?: string;
  /** Verb for the secondary, e.g. "removing one". */
  secondaryVerb?: string;
  className?: string;
}) {
  const primary = useArNSActionPrice(action);
  // Called unconditionally — hooks cannot be conditional, and the query is
  // disabled when there is no second action to price.
  const secondary = useArNSActionPrice(secondaryAction);

  const solLine = "Turbo covers the Solana fee, so you don't need SOL.";

  if (!secondaryAction) {
    return (
      <p className={`text-xs text-foreground/60 ${className}`}>
        This costs {amountText(primary.credits)}. {solLine}
      </p>
    );
  }

  /*
    Collapse to one figure when the two agree, which is production today.
    Naming the same number twice reads as an oversight rather than precision.
  */
  const same = primary.credits === secondary.credits;

  return (
    <p className={`text-xs text-foreground/60 ${className}`}>
      {same
        ? `${primaryVerb ?? 'This'} or ${secondaryVerb ?? 'undoing it'} costs ${amountText(primary.credits)}.`
        : `${primaryVerb ?? 'This'} costs ${amountText(primary.credits)}; ${secondaryVerb ?? 'undoing it'} costs ${amountText(secondary.credits)}.`}{' '}
      {solLine}
    </p>
  );
}
