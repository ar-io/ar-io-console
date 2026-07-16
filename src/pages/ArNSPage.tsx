import { ArNSBuyPanel } from '../features/arns';

/**
 * ArNS page — buy an ArNS name with Turbo Credits, fully in-console.
 * Replaces the previous external `arns.ar.io/#/register/...` deep-link with the
 * `src/features/arns` flow (search → price → buy → receipt).
 */
export function ArNSPage() {
  return (
    <div className="py-6">
      <ArNSBuyPanel />
    </div>
  );
}

export default ArNSPage;
