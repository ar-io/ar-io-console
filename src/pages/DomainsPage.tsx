import { BrowseDomainsPanel } from '../features/arns';

/**
 * Domains page (`/domains`) — browse & search every ArNS name registered on the
 * network. Registration lives at `/arns` (Register a Name) and auctions at
 * `/returned-names`; each is its own flat, linkable route rather than a tab here.
 */
export default function DomainsPage() {
  return (
    <div className="py-6">
      <BrowseDomainsPanel />
    </div>
  );
}
