import { useState } from 'react';
import { Globe, Search } from 'lucide-react';

import { ArNSBuyPanel, BrowseDomainsPanel } from '../features/arns';

type DomainsTab = 'buy' | 'browse';

/**
 * Domains page — the "Search Domains" nav entry. Hosts the in-console ArNS buy
 * flow, plus a browser for every name registered on the network.
 */
export default function DomainsPage() {
  const [tab, setTab] = useState<DomainsTab>('buy');

  return (
    <div className="py-6">
      <div className="px-4 sm:px-6 mb-4">
        <div className="inline-flex gap-1 p-1 rounded-full bg-card border border-border/20">
          <button
            onClick={() => setTab('buy')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              tab === 'buy'
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground/70 hover:text-foreground'
            }`}
          >
            <Search className="w-4 h-4" />
            Search &amp; Buy
          </button>
          <button
            onClick={() => setTab('browse')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              tab === 'browse'
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground/70 hover:text-foreground'
            }`}
          >
            <Globe className="w-4 h-4" />
            Browse All
          </button>
        </div>
      </div>

      {tab === 'buy' ? <ArNSBuyPanel /> : <BrowseDomainsPanel />}
    </div>
  );
}
