import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ChevronLeft, Globe, type LucideIcon } from 'lucide-react';

export interface DomainNavItem {
  name: string;
  page: string;
  icon: LucideIcon;
}

const FLYOUT_WIDTH = 208; // px — matches w-52
const ROW_HEIGHT = 40; // px per item, for a rough height estimate when clamping

/**
 * The "Domains" group in the waffle mega-menu, collapsed into a single row that
 * opens a second-level flyout of the ArNS actions — the flat list had grown long
 * enough to dominate the panel. Opens on hover (with a small close grace period)
 * and toggles on click for touch.
 *
 * Rendered through a portal with fixed positioning because the parent
 * `PopoverPanel` is `overflow-auto` and would otherwise clip a side flyout. The
 * position prefers opening to the LEFT of the row (the panel hugs the right edge
 * of the viewport) and clamps into the viewport on narrow screens.
 */
export default function DomainsNavFlyout({
  items,
  currentPath,
  onNavigate,
}: {
  items: DomainNavItem[];
  currentPath: string;
  /** Close the parent waffle popover after navigating. */
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const anyActive = items.some((s) => currentPath === `/${s.page}`);

  const place = () => {
    const r = rowRef.current?.getBoundingClientRect();
    if (!r) return;
    // Prefer opening to the left of the row; if that would run off the left
    // edge, fall back to the right, then clamp so it always stays on screen.
    let left = r.left - FLYOUT_WIDTH - 6;
    if (left < 8) left = Math.min(r.right + 6, window.innerWidth - FLYOUT_WIDTH - 8);
    left = Math.max(8, left);
    const estHeight = items.length * ROW_HEIGHT + 8;
    const top = Math.max(8, Math.min(r.top, window.innerHeight - estHeight - 8));
    setPos({ left, top });
  };

  const openNow = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    place();
    setOpen(true);
  };
  const closeSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    // Capture phase so scrolling the menu's own overflow container repositions.
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Clear any pending close timer on unmount (e.g. the parent popover closes).
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  return (
    <div onMouseEnter={openNow} onMouseLeave={closeSoon}>
      <button
        ref={rowRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openNow())}
        className={`flex w-full items-center gap-3 py-2 px-4 text-sm transition-colors ${
          anyActive || open
            ? 'bg-primary/15 text-foreground font-medium'
            : 'text-foreground/80 hover:bg-primary/10 hover:text-foreground'
        }`}
      >
        <Globe
          className={`w-4 h-4 ${anyActive ? 'text-primary' : 'text-foreground/60'}`}
        />
        <span className="flex-1 text-left">Domains</span>
        <ChevronLeft className="w-4 h-4 text-foreground/40" />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            role="menu"
            aria-label="Domains"
            onMouseEnter={openNow}
            onMouseLeave={closeSoon}
            style={{ left: pos.left, top: pos.top, width: FLYOUT_WIDTH }}
            className="fixed z-[60] rounded-2xl border border-border/20 bg-background py-1 shadow-lg"
          >
            {items.map((service) => {
              const isActive = currentPath === `/${service.page}`;
              return (
                <Link
                  key={service.page}
                  to={`/${service.page}`}
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onNavigate();
                  }}
                  className={`flex items-center gap-3 py-2 px-4 text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/15 text-foreground font-medium'
                      : 'text-foreground/80 hover:bg-primary/10 hover:text-foreground'
                  }`}
                >
                  <service.icon
                    className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-foreground/60'}`}
                  />
                  {service.name}
                </Link>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
