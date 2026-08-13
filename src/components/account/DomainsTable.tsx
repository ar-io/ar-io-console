import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, ExternalLink, AlertTriangle, ArrowRight } from 'lucide-react';
import { ARIO_LOGO_TX_ID } from '@ar.io/sdk/solana';
import { ArNSName } from '@/types';
import { daysUntil, domainStatus, isExpiringSoon, type DomainStatus } from '@/utils/domainExpiry';
import { useAntSummaries } from '@/features/arns/hooks/useAntLogos';
import { deriveAntRole } from '@/features/arns/antRole';
import { useStore } from '@/store/useStore';

const visitUrl = (name: string) => `https://${name}.ar.io`;

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { dateStyle: 'medium' });

/**
 * A name's ANT logo thumbnail, falling back to the Globe icon when there's no
 * logo, on load error, or when the logo is still the default AR.IO placeholder
 * (so real, user-set logos stand out from un-configured names).
 */
function NameLogo({ logo, gatewayUrl }: { logo?: string; gatewayUrl: string }) {
  const [failed, setFailed] = useState(false);
  // Clear a prior load error when the source changes (logo edit / gateway switch),
  // so a fixed/updated logo stops falling back to the Globe icon.
  useEffect(() => setFailed(false), [logo, gatewayUrl]);
  if (!logo || logo === ARIO_LOGO_TX_ID || failed) {
    return <Globe className="h-4 w-4 flex-shrink-0 text-primary" />;
  }
  return (
    <img
      src={`${gatewayUrl}/${logo}`}
      alt=""
      className="h-6 w-6 flex-shrink-0 rounded object-contain"
      onError={() => setFailed(true)}
    />
  );
}

/**
 * Explicit expiry: the actual end DATE, plus a days-remaining hint and — when a
 * lease is within the warning window — a colored notifier so at-risk names read
 * at a glance (they're also sorted to the top by the caller).
 */
function ExpiresCell({ domain }: { domain: ArNSName }) {
  if (domain.type === 'permabuy') {
    return <span className="text-foreground/60">Permanent</span>;
  }
  if (typeof domain.endTimestamp !== 'number') {
    return <span className="text-foreground/50">—</span>;
  }
  const days = daysUntil(domain.endTimestamp, Date.now());
  const date = fmtDate(domain.endTimestamp);
  if (isExpiringSoon(domain, Date.now())) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
          <AlertTriangle className="h-3 w-3" />
          {days < 0 ? 'Expired' : days === 0 ? 'Today' : `${days}d`}
        </span>
        <span className="text-foreground/70">{date}</span>
      </span>
    );
  }
  return (
    <span className="text-foreground/70">
      {date} <span className="text-foreground/40">· {days}d left</span>
    </span>
  );
}

/**
 * At-a-glance lifecycle pill, the column every registrar leads with. Uses the
 * semantic status tokens (not raw palette colours) per the style guide, and
 * derives from `domainStatus` so it can never contradict the expiry banner.
 */
const STATUS_STYLE: Record<DomainStatus, { label: string; cls: string }> = {
  permanent: { label: 'Permanent', cls: 'bg-primary/10 text-primary' },
  active: { label: 'Active', cls: 'bg-success/10 text-success' },
  expiring: { label: 'Expiring', cls: 'bg-warning/15 text-warning' },
  expired: { label: 'Expired', cls: 'bg-error/10 text-error' },
};

function StatusPill({ status }: { status: DomainStatus }) {
  const { label, cls } = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

/**
 * A scannable list of the ArNS names you own/control. Each row links into the
 * canonical Name Detail page (`/domains/:name`) where all management happens —
 * the table itself stays slim (name, explicit expiry, quick links). Rows the
 * caller passes are expected sorted with soonest-expiring first.
 */
export default function DomainsTable({
  domains,
  walletAddress,
}: {
  domains: ArNSName[];
  /** Connected/linked Solana address — used to label owner vs controller. */
  walletAddress?: string | null;
}) {
  const arioGatewayUrl = useStore((s) => s.getCurrentConfig().arioGatewayUrl);
  const processIds = useMemo(
    () => domains.map((d) => d.processId).filter(Boolean),
    [domains],
  );
  const summaries = useAntSummaries(processIds);

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/20 bg-card">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="border-b border-border/20 text-left text-xs uppercase tracking-wider text-foreground/60">
            <th className="px-4 py-3 font-medium">Domain</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Expires</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {domains.map((domain) => {
            const now = Date.now();
            const expiringSoon = isExpiringSoon(domain, now);
            const status = domainStatus(domain, now);
            const role = deriveAntRole(
              summaries.get(domain.processId),
              walletAddress,
            );
            return (
              <tr
                key={domain.name}
                className={`border-b border-border/10 last:border-0 ${expiringSoon ? 'bg-warning/5' : ''}`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <NameLogo
                      logo={summaries.get(domain.processId)?.logo}
                      gatewayUrl={arioGatewayUrl}
                    />
                    <Link
                      to={`/domains/${domain.name}`}
                      className="truncate font-medium text-foreground hover:text-primary hover:underline"
                      title={`View ${domain.displayName}.ar.io`}
                    >
                      {domain.displayName}.ar.io
                    </Link>
                    {role === 'controller' && (
                      <span
                        className="flex-shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                        title="You control this name but don't own it — you can edit its records, but can't transfer, reassign, or release it."
                      >
                        Controller
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <ExpiresCell domain={domain} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                    <a
                      href={visitUrl(domain.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 py-1 text-primary hover:underline"
                    >
                      Visit
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <Link
                      to={`/domains/${domain.name}`}
                      className="inline-flex items-center gap-1 py-1 font-medium text-foreground/70 hover:text-foreground hover:underline"
                    >
                      Manage
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
