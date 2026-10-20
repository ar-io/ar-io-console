import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';

/**
 * The one way to link to documentation (see "Docs links" in
 * docs/STYLE_GUIDE.md).
 *
 * It sits beside what it explains, under a page's description or at the end
 * of the relevant sentence, never in a "Learn more" block at the bottom of a
 * page. Name the topic ("How ArNS works", "What are credits?") rather than
 * "Learn more". Standalone, pass `text-xs`; inside a sentence it takes the
 * sentence's size.
 *
 * Primary purple reaches only ~1.9:1 on the dark washes, so this is for light
 * surfaces; a docs link on a dark one needs the `on-dark` accent instead.
 */
export default function DocsLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 whitespace-nowrap font-medium text-primary hover:underline ${className}`}
    >
      {children}
      <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
