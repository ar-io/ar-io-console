import { FC, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * The single modal header treatment.
 *
 * Upload and Deploy converged on one shape — a 40px primary-tinted icon tile,
 * an 18px extrabold title and a 12px muted description — while the ArNS family
 * grew its own: no tile, a 20px title, a 14px description. Both were internally
 * consistent, which is exactly why the split survived; nothing looked broken
 * inside either group. This is that treatment as one component, so the next
 * modal inherits it instead of copying whichever neighbour it was written next
 * to.
 *
 * `title` is a node, not a string: the domain modals set the name in mono
 * primary inside the heading ("Transfer `name`.ar.io"), which is a real part of
 * the pattern and worth keeping.
 *
 * The tile is `rounded-xl` (12px), not the `rounded-lg` Upload and Deploy
 * used: the style guide assigns `rounded-lg` to buttons and small interactive
 * elements, and `rounded-xl` to nested cards, which is what this is. Both
 * CLAUDE.md and STYLE_GUIDE.md specify `rounded-xl` for the header tile.
 *
 * No `font-heading` here — globals.css already sets Besley 800 on h1–h6, and
 * `font-extrabold` holds that 800. Adding `font-bold` would silently drop it
 * to 700, which is the usual way this drifts.
 */
interface ModalHeaderProps {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
}

const ModalHeader: FC<ModalHeaderProps> = ({ icon: Icon, title, description }) => (
  <div className="mb-4 flex items-center gap-3">
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/20">
      <Icon className="h-5 w-5 text-primary" />
    </div>
    <div className="text-left">
      <h3 className="text-lg font-extrabold text-foreground">{title}</h3>
      {description && (
        <p className="text-xs text-foreground/80">{description}</p>
      )}
    </div>
  </div>
);

export default ModalHeader;
