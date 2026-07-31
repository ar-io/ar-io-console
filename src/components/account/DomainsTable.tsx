import { useState } from 'react';
import { Globe, ExternalLink, AlertTriangle } from 'lucide-react';
import { ArNSName } from '@/types';
import { daysUntil, isExpiringSoon } from '@/utils/domainExpiry';
import {
  ManageDomainModal,
  TransferDomainModal,
  ReassignDomainModal,
} from '@/features/arns';

const visitUrl = (name: string) => `https://${name}.ar.io`;

function StatusCell({ domain }: { domain: ArNSName }) {
  if (domain.type === 'permabuy') {
    return <span className="text-foreground/70">Permanent</span>;
  }
  if (typeof domain.endTimestamp !== 'number') {
    return <span className="text-foreground/60">Leased</span>;
  }
  const days = daysUntil(domain.endTimestamp, Date.now());
  if (!isExpiringSoon(domain, Date.now())) {
    return <span className="text-foreground/70">Expires in {days} days</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
      <AlertTriangle className="h-3 w-3" />
      {days < 0 ? 'Expired' : days === 0 ? 'Expires today' : `Expires in ${days}d`}
    </span>
  );
}

export default function DomainsTable({
  domains,
  onChanged,
}: {
  domains: ArNSName[];
  /** Called after an in-app lifecycle change settles, so the caller can refetch. */
  onChanged?: () => void;
}) {
  const [managing, setManaging] = useState<ArNSName | null>(null);
  const [transferring, setTransferring] = useState<ArNSName | null>(null);
  const [reassigning, setReassigning] = useState<ArNSName | null>(null);

  return (
    <>
    <div className="overflow-x-auto rounded-2xl border border-border/20 bg-card">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="border-b border-border/20 text-left text-xs uppercase tracking-wider text-foreground/60">
            <th className="px-4 py-3 font-medium">Domain</th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">Registered</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {domains.map((domain) => {
            const expiringSoon = isExpiringSoon(domain, Date.now());
            return (
              <tr
                key={domain.name}
                className={`border-b border-border/10 last:border-0 ${expiringSoon ? 'bg-warning/5' : ''}`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 flex-shrink-0 text-primary" />
                    <span className="truncate font-medium text-foreground" title={`${domain.displayName}.ar.io`}>
                      {domain.displayName}.ar.io
                    </span>
                  </div>
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-foreground/70 md:table-cell">
                  {domain.lastUpdated ? domain.lastUpdated.toLocaleDateString() : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusCell domain={domain} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                    {expiringSoon && (
                      <button
                        onClick={() => setManaging(domain)}
                        className="font-medium text-warning hover:underline"
                      >
                        Renew
                      </button>
                    )}
                    <a
                      href={visitUrl(domain.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Visit
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <button
                      onClick={() => setManaging(domain)}
                      className="text-foreground/70 hover:text-foreground hover:underline"
                    >
                      Manage
                    </button>
                    <button
                      onClick={() => setTransferring(domain)}
                      className="text-foreground/70 hover:text-foreground hover:underline"
                    >
                      Transfer
                    </button>
                    <button
                      onClick={() => setReassigning(domain)}
                      className="text-foreground/70 hover:text-foreground hover:underline"
                    >
                      Reassign
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {managing && (
      <ManageDomainModal
        domain={managing}
        onClose={() => setManaging(null)}
        onSuccess={onChanged}
      />
    )}
    {transferring && (
      <TransferDomainModal
        domain={transferring}
        onClose={() => setTransferring(null)}
        onSuccess={onChanged}
      />
    )}
    {reassigning && (
      <ReassignDomainModal
        domain={reassigning}
        onClose={() => setReassigning(null)}
        onSuccess={onChanged}
      />
    )}
    </>
  );
}
