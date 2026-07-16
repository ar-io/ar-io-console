import { ArNSBuyPanel } from '../features/arns';

/**
 * Domains page — the "Search Domains" nav entry. Now hosts the in-console ArNS
 * buy flow (was the external-deep-link `ArNSPanel`).
 */
export default function DomainsPage() {
  return (
    <div className="py-6">
      <ArNSBuyPanel />
    </div>
  );
}
