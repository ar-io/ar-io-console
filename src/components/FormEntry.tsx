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
      <div className="w-full rounded border border-border/20">{children}</div>
      {errorText && <div className="text-xs text-error">{errorText}</div>}
    </div>
  );
};

export default FormEntry;