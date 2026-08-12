import { Globe, Search } from 'lucide-react';

/**
 * The "get a name" call to action, shared by both name pickers.
 *
 * It lives in one place deliberately: the pre-flight picker
 * (ArNSAssociationPanel) and the post-hoc one (AssignDomainModal) had each
 * grown their own version, which is how they ended up with different copy,
 * different button labels and different destinations for the same action.
 *
 * Two behaviours worth keeping:
 *
 *  - **New tab, always.** The caller is mid-flow — a deploy with files staged, a
 *    capture with a URL typed, an unsaved Pages draft. Navigating in-place would
 *    discard that. Register in the new tab, come back, hit Refresh.
 *  - **`?q=` prefill.** `/arns` reads `q` from the query string, so passing the
 *    thing the user is already naming (site name, page title) lands them on a
 *    live availability check instead of an empty search box.
 */

/** ArNS names are lowercase alphanumeric + hyphen; mirror the register page. */
function toNameQuery(raw?: string): string | undefined {
  if (!raw) return undefined;
  const q = raw.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return q.length > 0 ? q : undefined;
}

function buildRegisterUrl(suggestedName?: string): string {
  const q = toNameQuery(suggestedName);
  return q ? `/arns?q=${encodeURIComponent(q)}` : '/arns';
}

interface ArNSGetNameLinksProps {
  /**
   * Context to prefill the search with — the site name being deployed, the page
   * title being published. Sanitised to ArNS charset; ignored if nothing
   * survives.
   */
  suggestedName?: string;
  /**
   * `empty` — the user owns no names; this is the primary action, so it gets a
   * filled button.
   * `inline` — the user already owns names and is picking one; this is a quiet
   * secondary escape hatch, so it must not compete with the picker.
   */
  variant?: 'empty' | 'inline';
}

export function ArNSGetNameLinks({
  suggestedName,
  variant = 'empty',
}: ArNSGetNameLinksProps) {
  const registerUrl = buildRegisterUrl(suggestedName);
  const open = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

  if (variant === 'inline') {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/70">
        <span>Need another name?</span>
        <button
          type="button"
          onClick={() => open(registerUrl)}
          className="inline-flex items-center gap-1 font-semibold text-primary transition-opacity hover:opacity-80"
        >
          <Search className="h-3 w-3" />
          {suggestedName ? `Check "${toNameQuery(suggestedName)}"` : 'Find a name'}
        </button>
        <span aria-hidden="true" className="text-foreground/30">·</span>
        <button
          type="button"
          onClick={() => open('/domains')}
          className="font-medium transition-colors hover:text-foreground"
        >
          Browse all names
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <button
        type="button"
        onClick={() => open(registerUrl)}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
      >
        <Globe className="h-4 w-4" />
        {suggestedName ? `Check "${toNameQuery(suggestedName)}"` : 'Find a name'}
      </button>
      <button
        type="button"
        onClick={() => open('/domains')}
        className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
      >
        Browse all names
      </button>
    </div>
  );
}

export default ArNSGetNameLinks;
