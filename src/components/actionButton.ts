/**
 * The app's small action buttons: the ones beside a section or list title
 * ("Export CSV", "Check Status", "Edit", "Manage", "Add record") and the small
 * primary action that sits with them ("Create page", "Link wallet").
 *
 * One style everywhere, so the same kind of action looks the same on every
 * screen. It is the style guide's outlined secondary button (and dark primary)
 * at a small size: a visible outline, so it reads as a button on touch
 * screens, where there is no hover. Icons inside are `h-3.5 w-3.5`.
 *
 * - `default` — outlined, for most actions.
 * - `danger` — outlined in red from the start, for actions that delete or give
 *   something away (Clear History, Transfer, Release). Each still confirms.
 * - `primary` — filled dark, for the one main action in a header.
 *
 * Page-level calls to action keep the full-size buttons in docs/STYLE_GUIDE.md.
 */
export type ActionButtonVariant = 'default' | 'danger' | 'primary';

const BASE =
  'inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTS: Record<ActionButtonVariant, string> = {
  default: 'border-foreground text-foreground enabled:hover:bg-foreground/5',
  danger: 'border-error text-error enabled:hover:bg-error/10',
  primary: 'border-foreground bg-foreground text-white enabled:hover:opacity-90',
};

export function actionButtonClass(variant: ActionButtonVariant = 'default'): string {
  return `${BASE} ${VARIANTS[variant]}`;
}
