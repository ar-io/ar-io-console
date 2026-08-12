import { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Shared modal shell. ~20 surfaces render through this, so behaviour added here
 * lands everywhere at once — which is exactly why the keyboard and focus
 * handling belongs in this file rather than in each consumer.
 *
 * Modals NEST: WalletSelectionModal renders BlockingMessageModal inside its own
 * BaseModal. A naive `keydown` listener per instance would mean one Escape
 * closes the whole stack, and the first unmount would release the body scroll
 * lock while an outer modal is still open. Hence the module-level stack — only
 * the topmost instance reacts to Escape and traps Tab, and the lock is released
 * only when the last modal closes.
 */
const modalStack: symbol[] = [];

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface BaseModalProps {
  onClose: () => void;
  children: ReactNode;
  /**
   * Defaults to TRUE. A dismiss affordance is opt-out, not opt-in — the old
   * default of `false` left the Upload / Deploy / Capture confirmations with no
   * visible way to close them.
   */
  showCloseButton?: boolean;
  /**
   * `false` disables Escape AND backdrop-click. For modals that must not be
   * dismissed mid-operation, e.g. the wallet-connection spinner.
   */
  dismissible?: boolean;
}

export default function BaseModal({
  onClose,
  children,
  showCloseButton = true,
  dismissible = true,
}: BaseModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<symbol>(Symbol('modal'));
  // Keep the latest onClose without re-binding the key listener every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  // Register in the stack, lock body scroll, move focus in, and restore the
  // previously-focused element on close.
  useEffect(() => {
    const id = idRef.current;
    modalStack.push(id);

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the panel itself rather than its first control, so a screen reader
    // announces the dialog before its contents.
    panelRef.current?.focus();

    return () => {
      const i = modalStack.indexOf(id);
      if (i > -1) modalStack.splice(i, 1);
      // Only the last modal out restores scrolling.
      if (modalStack.length === 0) document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  // Escape to close + Tab focus trap, topmost modal only.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== idRef.current) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (!dismissibleRef.current) {
          e.stopPropagation();
          return;
        }
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (e.key !== 'Tab') return;

      const root = panelRef.current;
      if (!root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (!root.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Portal the modal to document.body to escape all container constraints
  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 z-[9998]"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Panel — centred, capped at 90vh with its own scroll. overflow-x stays
          hidden so children can't spill past the rounded corners. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        // No focus:outline-none needed: the global :focus-visible rule scopes
        // itself to [tabindex]:not([tabindex="-1"]), so this panel — focused
        // programmatically on mount purely to move the screen reader in — never
        // draws a ring in the first place.
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] max-w-[90vw] max-h-[90vh] overflow-y-auto overflow-x-hidden bg-card border border-border/20 rounded-2xl shadow-xl"
      >
        {showCloseButton && dismissible && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 text-foreground/80 hover:text-foreground transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        {children}
      </div>
    </>
  );

  // Render to document.body to escape all container constraints
  return createPortal(modalContent, document.body);
}
