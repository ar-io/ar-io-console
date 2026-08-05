import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
 *
 * The menu is rendered through a portal with fixed positioning so it is never
 * clipped by the owned-names table's `overflow-x-auto` wrapper (which would
 * otherwise hide the actions on lower rows).
 */
export default function RowActionsMenu({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    };
    place();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    // Capture phase so the table's own inner scroll repositions the menu too.
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
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
      {open &&
        pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              role="menu"
              style={{ top: pos.top, right: pos.right }}
              className="fixed z-50 min-w-[11rem] rounded-xl border border-border/20 bg-background p-1 shadow-lg"
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
          </>,
          document.body,
        )}
    </div>
  );
}
