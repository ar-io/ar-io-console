import type { WriterChoice } from '../records/writerChoice';

/**
 * "Pay with credits instead" / "Pay with SOL instead", under a cost line.
 *
 * Shown only when the other rail would also work for this owner
 * (`chooseWriter`'s `alternative`), so the default is never presented as the
 * only option. The choice is held in the store for the session, so every
 * editor on the page follows it.
 */
export default function RailSwitch({
  alternative,
  onSwitch,
  disabled,
  className = '',
}: {
  alternative: WriterChoice['alternative'];
  onSwitch: () => void;
  disabled?: boolean;
  className?: string;
}) {
  if (!alternative) return null;
  return (
    <button
      type="button"
      onClick={onSwitch}
      disabled={disabled}
      className={`text-xs font-medium text-primary hover:underline disabled:opacity-50 ${className}`}
    >
      {alternative === 'sponsored'
        ? 'Pay with credits instead'
        : 'Pay with SOL instead'}
    </button>
  );
}
