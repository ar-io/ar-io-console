import { ReturnedNamesPanel } from '../features/arns';

/**
 * Returned Names page — a standalone, deep-linkable home for returned-name
 * (recently-expired) auctions. Renders the same ReturnedNamesPanel that the
 * DomainsPage "Auctions" tab uses, so there is a single source of truth.
 */
export function ReturnedNamesPage() {
  return (
    <div>
      <ReturnedNamesPanel />
    </div>
  );
}

export default ReturnedNamesPage;
