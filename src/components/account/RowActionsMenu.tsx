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
// Rough menu height budget (px) used to decide flip-up vs. flip-down; the menu
// also caps its own height and scrolls, so this only needs to be approximate.
const MENU_MAX_HEIGHT = 260;

export default function RowActionsMenu({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{
    top?: number;
    bottom?: number;
    right: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const right = window.innerWidth - r.right;
      const spaceBelow = window.innerHeight - r.bottom;
      // Flip above the trigger when a lower row wouldn't leave room below — so
      // the menu's actions never fall off the bottom of the viewport.
      if (spaceBelow < MENU_MAX_HEIGHT && r.top > spaceBelow) {
        setPos({ bottom: window.innerHeight - r.top + 4, right });
      } else {
        setPos({ top: r.bottom + 4, right });
      }
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
              style={{ top: pos.top, bottom: pos.bottom, right: pos.right }}
              className="fixed z-50 max-h-[260px] min-w-[11rem] overflow-y-auto rounded-xl border border-border/20 bg-background p-1 shadow-lg"
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
