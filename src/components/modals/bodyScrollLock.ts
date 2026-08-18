/**
 * Reference-counted body scroll lock shared by every BaseModal instance.
 *
 * Modals nest (WalletSelectionModal renders BlockingMessageModal inside its own
 * BaseModal), so the lock has to survive an inner modal opening and closing
 * while an outer one stays up.
 *
 * The subtle part is WHERE the pre-lock value is stored. Saving it per instance
 * looks equivalent but isn't: a modal that mounts while another is already open
 * observes `overflow: hidden` and saves *that*. If it is then the last one to
 * unmount — which is exactly what happens when a parent modal and the child it
 * renders unmount together, since React cleans the parent up first — it restores
 * `hidden` and the page can never scroll again. So the value is captured once,
 * on the 0 -> 1 transition, and restored once, on the 1 -> 0 transition.
 */

/** Just the bits of `document.body.style` this needs, so it can be tested. */
export interface ScrollLockTarget {
  style: { overflow: string };
}

const stack: symbol[] = [];
let savedOverflow: string | null = null;

/** Take a lock for `id`. Safe to call for any number of nested modals. */
export function lockBodyScroll(id: symbol, target: ScrollLockTarget): void {
  if (stack.length === 0) savedOverflow = target.style.overflow;
  stack.push(id);
  target.style.overflow = 'hidden';
}

/**
 * Release `id`'s lock, restoring scrolling only once every modal has released.
 * Unknown or already-released ids are ignored, so a double cleanup is harmless.
 */
export function releaseBodyScroll(id: symbol, target: ScrollLockTarget): void {
  const i = stack.indexOf(id);
  if (i === -1) return;
  stack.splice(i, 1);
  if (stack.length === 0) {
    target.style.overflow = savedOverflow ?? '';
    savedOverflow = null;
  }
}

/** Test seam. */
export function __resetBodyScrollLock(): void {
  stack.length = 0;
  savedOverflow = null;
}

/** How many modals currently hold the lock. */
export function bodyScrollLockDepth(): number {
  return stack.length;
}
