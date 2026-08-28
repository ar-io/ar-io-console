import { FC, ReactNode } from 'react';

/**
 * Labelled form row.
 *
 * CONTRACT: the child control MUST set `id={name}` — the label below renders
 * `htmlFor={name}`, so without a matching id the association silently dangles.
 * It still *looks* correct, which is why it went unnoticed: the label reads fine
 * to a sighted user, but screen readers announce an unlabelled field and
 * clicking the label doesn't focus the input.
 *
 * The one accepted exception is Stripe's `<CardElement>`, which renders a
 * cross-origin iframe that cannot receive an id.
 */
interface FormEntryProps {
  /** Also used as the child control's `id`. Keep them in sync. */
  name: string;
  label: string;
  children: ReactNode;
  errorText?: string;
}

const FormEntry: FC<FormEntryProps> = ({ name, label, children, errorText }) => {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-foreground/80" htmlFor={name}>
        {label}
      </label>
      {/*
        Layout only — no border, no radius. This used to paint its own
        `rounded` (4px) border around controls that already carry `rounded-2xl`
        (20px here) and a border of their own, so every field rendered as a
        near-square box with a rounded box inside it. The control owns its
        surface; this owns the label, the gap and the error.
      */}
      <div className="w-full">{children}</div>
      {errorText && <div className="text-xs text-error">{errorText}</div>}
    </div>
  );
};

export default FormEntry;