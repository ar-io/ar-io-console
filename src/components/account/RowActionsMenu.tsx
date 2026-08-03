import { useEffect, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface RowAction {
  label: string;
  onClick: () => void;
  /** Renders in the error color to flag destructive actions. */
  danger?: boolean;
}

/**
 * Compact "More" popover for a domain row's secondary actions, keeping the
 * primary actions (Visit / Manage) inline while grouping the advanced ANT
 * actions (edit details, transfer, reassign) out of the way. Closes on
 * selection or on a click of the transparent backdrop behind the menu.
 */
export default function RowActionsMenu({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-foreground/70 hover:text-foreground hover:underline"
      >
        More
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-1 min-w-[11rem] rounded-xl border border-border/20 bg-background p-1 shadow-lg"
          >
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  a.onClick();
                }}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-card ${
                  a.danger ? 'text-error' : 'text-foreground/80'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
