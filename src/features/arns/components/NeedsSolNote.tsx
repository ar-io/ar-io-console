/**
 * The disclosure for the four actions Turbo does not sponsor.
 *
 * Shown inside the modal that performs the action, not as a list somewhere
 * else. A paragraph naming three or four controls under a heading is read once
 * and forgotten by the time anyone clicks one of them — and it reads as
 * clutter next to controls that mostly don't need it. Said here, it lands at
 * the moment it applies.
 *
 * Verified against both bundlers: `primary-name`, `release-name`, `reassign`
 * and ANT-level metadata all answer `Unknown ArNS action`, so these genuinely
 * run through the owner's own wallet and cost them SOL.
 */
export default function NeedsSolNote({
  action,
  variant = 'box',
  className = '',
}: {
  /** What the user is about to do, e.g. "Setting a primary name". */
  action: string;
  /**
   * `line` is the plain cost line the confirm modals share with Transfer's
   * `ActionCostNote`, placed under the warning. `box` stands alone at the top
   * of a modal that has no warning of its own.
   */
  variant?: 'box' | 'line';
  className?: string;
}) {
  if (variant === 'line') {
    return (
      <p className={`text-xs text-foreground/60 ${className}`}>
        Your wallet pays a small Solana network fee.
      </p>
    );
  }
  return (
    <p
      className={`rounded-2xl border border-warning/30 bg-warning/10 p-3 text-xs leading-snug text-foreground/80 ${className}`}
    >
      {action} isn&apos;t paid by Turbo, so your wallet pays a small Solana fee
      for it, unlike buying, renewing and editing records.
    </p>
  );
}
