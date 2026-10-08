/**
 * The app's buttons, by role, following the ar.io brand kit's pill CTAs
 * (`components.pill_ctas` in https://ar.io/brand-kit/agents.json):
 *
 * - `primary` — purple fill, white text. The one main action on a screen:
 *   Pay, Upload, Deploy, Register, Sign in, Continue, a success screen's
 *   next step.
 * - `secondary` — outlined, transparent. Cancel, Try again, Close, Done,
 *   Download: anything beside or after the main action.
 * - `danger` — red fill, for the final confirm of something destructive
 *   (Remove, Revoke, Delete) inside its confirmation.
 * - `danger-outline` — red outline, for a destructive action that acts at
 *   once (Cancel an upload) or opens a confirmation.
 *
 * Text links (Back, "Pay with card instead") stay links. The small buttons
 * beside a section title use `actionButtonClass` instead.
 *
 * Pass layout (width, margin, flex) alongside: `${buttonClass('primary')} w-full mt-4`.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'danger-outline';

/**
 * - `xs` — compact, inside a callout or a list row.
 * - `sm` — inline beside text.
 * - `md` — the default.
 * - `lg` — a modal's or a form's main action.
 * - `xl` — the large checkout button at the foot of a panel.
 */
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// Hover is gated on `:not(:disabled)` rather than `enabled:`, which never
// matches, so a `<Link>` or `<a>` styled this way keeps its hover. Font weight
// lives in each size (so `xl` is really bold), and only the compact sizes
// refuse to wrap: a long or dynamic label must wrap on a phone, not overflow.
const BASE =
  'relative inline-flex items-center justify-center gap-2 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const SIZES: Record<ButtonSize, string> = {
  xs: 'whitespace-nowrap px-3 py-1.5 text-xs font-semibold',
  sm: 'whitespace-nowrap px-4 py-2 text-sm font-semibold',
  md: 'px-5 py-2.5 text-sm font-semibold',
  lg: 'px-6 py-3 text-base font-semibold',
  xl: 'px-6 py-4 text-lg font-bold',
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-primary bg-primary text-white [&:not(:disabled)]:hover:brightness-90',
  secondary: 'border-foreground bg-transparent text-foreground [&:not(:disabled)]:hover:bg-foreground/5',
  danger: 'border-error bg-error text-white [&:not(:disabled)]:hover:brightness-90',
  'danger-outline': 'border-error bg-transparent text-error [&:not(:disabled)]:hover:bg-error/10',
};

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]}`;
}
