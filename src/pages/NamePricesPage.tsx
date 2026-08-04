import { ArNSPriceTable } from '../features/arns';

/**
 * Name Prices page — a standalone, deep-linkable home for the ArNS
 * fee-schedule table (registration price by name character length). Renders the
 * shared ArNSPriceTable so there is a single source of truth.
 */
export function NamePricesPage() {
  return (
    <div className="py-6">
      <ArNSPriceTable />
    </div>
  );
}

export default NamePricesPage;
