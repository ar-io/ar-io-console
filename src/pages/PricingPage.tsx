import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calculator, HardDrive, Tag } from 'lucide-react';

import PricingCalculatorPanel from '@/components/panels/PricingCalculatorPanel';
import { ArNSPriceTable } from '@/features/arns';

type PricingMode = 'storage' | 'domains';

const pill = (active: boolean) =>
  `flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
    active
      ? 'bg-primary text-primary-foreground'
      : 'text-foreground/70 hover:text-foreground'
  }`;

/**
 * Unified Pricing page — one place to answer "what will this cost?" for the two
 * things the console offers: permanent storage and ArNS domain names. Replaces
 * the separate `/calculator` (storage) and `/name-prices` (domains) pages, which
 * now redirect here; the operator-facing services calculator was removed.
 *
 * `?type=domains` seeds the initial mode (read once on mount, like the top-up
 * deep link) so old `/name-prices` links land on the right tab. The toggle is
 * plain local state after that — it does not write back to the URL.
 */
export default function PricingPage() {
  const [searchParams] = useSearchParams();
  const initial: PricingMode =
    searchParams.get('type') === 'domains' ? 'domains' : 'storage';
  const [mode, setMode] = useState<PricingMode>(initial);

  return (
    <div className="py-6">
      <div className="px-4 sm:px-6">
        {/* Header row — title/description on the left, mode selector top-right */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-card">
              <Calculator className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h3 className="font-heading text-2xl font-extrabold text-foreground mb-1">
                Pricing
              </h3>
              <p className="text-sm text-foreground/80">
                See what storage and domain names cost on the permanent cloud.
              </p>
            </div>
          </div>

          {/* Mode selector */}
          <div className="inline-flex flex-shrink-0 gap-1 self-start rounded-full border border-border/20 bg-card p-1 sm:self-auto">
            <button onClick={() => setMode('storage')} className={pill(mode === 'storage')}>
              <HardDrive className="h-4 w-4" />
              Storage
            </button>
            <button onClick={() => setMode('domains')} className={pill(mode === 'domains')}>
              <Tag className="h-4 w-4" />
              Domain Names
            </button>
          </div>
        </div>
      </div>

      {mode === 'storage' ? <PricingCalculatorPanel /> : <ArNSPriceTable />}
    </div>
  );
}
