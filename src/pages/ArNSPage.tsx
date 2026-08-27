import { useSearchParams } from 'react-router-dom';
import { ArNSBuyPanel } from '../features/arns';

/**
 * ArNS page — buy an ArNS name with Turbo Credits, fully in-console.
 * Replaces the previous external `arns.ar.io/#/register/...` deep-link with the
 * `src/features/arns` flow (search → price → buy → receipt).
 */
export function ArNSPage() {
  const [searchParams] = useSearchParams();
  const initialSearch =
    (searchParams.get('q') ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '') || undefined;

  return (
    <div>
      <ArNSBuyPanel initialSearch={initialSearch} />
    </div>
  );
}

export default ArNSPage;
