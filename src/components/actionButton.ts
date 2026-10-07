/**
 * The app's small action buttons: the ones beside a section or list title
 * ("Export CSV", "Check Status", "Edit", "Manage", "Add record") and the small
 * primary action that sits with them ("Create page", "Link wallet").
 *
 * One style everywhere, so the same kind of action looks the same on every
 * screen. It is the style guide's outlined secondary button (and the purple primary)
 * at a small size: a visible outline, so it reads as a button on touch
 * screens, where there is no hover. Icons inside are `h-3.5 w-3.5`.
 *
 * - `default` — outlined, for most actions.
 * - `danger` — outlined in red from the start, for actions that delete or give
 *   something away (Clear History, Transfer, Release). Each still confirms.
 * - `primary` — purple fill, for the one main action in a header, matching
 *   `buttonClass('primary')`.
 *
 * Page-level calls to action keep the full-size buttons in docs/STYLE_GUIDE.md.
 */
export type ActionButtonVariant = 'default' | 'danger' | 'primary';

// `relative` anchors an sr-only label; `whitespace-nowrap` keeps a label on
// one line in a squeezed header. Hover is gated on `:not(:disabled)` rather
// than `enabled:`, which never matches, so a `<Link>` styled this way keeps it.
const BASE =
  'relative inline-flex flex-shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTS: Record<ActionButtonVariant, string> = {
  default: 'border-foreground text-foreground [&:not(:disabled)]:hover:bg-foreground/5',
  danger: 'border-error text-error [&:not(:disabled)]:hover:bg-error/10',
  primary: 'border-primary bg-primary text-white [&:not(:disabled)]:hover:brightness-90',
};

export function actionButtonClass(variant: ActionButtonVariant = 'default'): string {
  return `${BASE} ${VARIANTS[variant]}`;
}
