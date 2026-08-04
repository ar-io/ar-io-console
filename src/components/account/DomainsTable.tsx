import { useMemo, useState } from 'react';
import { Globe, ExternalLink, AlertTriangle } from 'lucide-react';
import { ARIO_LOGO_TX_ID } from '@ar.io/sdk/solana';
import { ArNSName } from '@/types';
import { daysUntil, isExpiringSoon } from '@/utils/domainExpiry';
import {
  ManageDomainModal,
  TransferDomainModal,
  ReassignDomainModal,
  ReleaseDomainModal,
  EditDetailsModal,
  UndernamesModal,
  ControllersModal,
  PrimaryNameModal,
} from '@/features/arns';
import { useAntSummaries } from '@/features/arns/hooks/useAntLogos';
import { deriveAntRole, isOwnerOnlyAllowed } from '@/features/arns/antRole';
import { useStore } from '@/store/useStore';
import RowActionsMenu from './RowActionsMenu';

const visitUrl = (name: string) => `https://${name}.ar.io`;

/**
 * A name's ANT logo thumbnail, falling back to the Globe icon when there's no
 * logo, on load error, or when the logo is still the default AR.IO placeholder
 * (so real, user-set logos stand out from un-configured names).
 */
function NameLogo({ logo, gatewayUrl }: { logo?: string; gatewayUrl: string }) {
  const [failed, setFailed] = useState(false);
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
  walletAddress,
}: {
  domains: ArNSName[];
  /** Called after an in-app lifecycle change settles, so the caller can refetch. */
  onChanged?: () => void;
  /** Connected/linked Solana address — used to derive owner vs controller role. */
  walletAddress?: string | null;
}) {
  const [managing, setManaging] = useState<ArNSName | null>(null);
  const [transferring, setTransferring] = useState<ArNSName | null>(null);
  const [reassigning, setReassigning] = useState<ArNSName | null>(null);
  const [releasing, setReleasing] = useState<ArNSName | null>(null);
  const [editing, setEditing] = useState<ArNSName | null>(null);
  const [undernaming, setUndernaming] = useState<ArNSName | null>(null);
  const [controlling, setControlling] = useState<ArNSName | null>(null);
  const [settingPrimary, setSettingPrimary] = useState<ArNSName | null>(null);

  const arioGatewayUrl = useStore((s) => s.getCurrentConfig().arioGatewayUrl);
  const processIds = useMemo(
    () => domains.map((d) => d.processId).filter(Boolean),
    [domains],
  );
  const summaries = useAntSummaries(processIds);

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
            const role = deriveAntRole(
              summaries.get(domain.processId),
              walletAddress,
            );
            const ownerActions = isOwnerOnlyAllowed(role);
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
                    <span className="truncate font-medium text-foreground" title={`${domain.displayName}.ar.io`}>
                      {domain.displayName}.ar.io
                    </span>
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
                    <RowActionsMenu
                      actions={[
                        {
                          label: 'Edit details',
                          onClick: () => setEditing(domain),
                        },
                        {
                          label: 'Undernames',
                          onClick: () => setUndernaming(domain),
                        },
                        // Managing the controller set is owner-only.
                        ...(ownerActions
                          ? [
                              {
                                label: 'Controllers',
                                onClick: () => setControlling(domain),
                              },
                            ]
                          : []),
                        {
                          label: 'Set as primary name',
                          onClick: () => setSettingPrimary(domain),
                        },
                        // Transfer / Reassign / Release change ownership or the
                        // name→ANT mapping — owner-only; hidden for controllers.
                        ...(ownerActions
                          ? [
                              {
                                label: 'Transfer…',
                                onClick: () => setTransferring(domain),
                                danger: true,
                              },
                              {
                                label: 'Reassign…',
                                onClick: () => setReassigning(domain),
                                danger: true,
                              },
                            ]
                          : []),
                        // Release only applies to permabuy names you own; leases
                        // expire on their own, so there is nothing to release.
                        ...(ownerActions && domain.type === 'permabuy'
                          ? [
                              {
                                label: 'Release…',
                                onClick: () => setReleasing(domain),
                                danger: true,
                              },
                            ]
                          : []),
                      ]}
                    />
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
    {releasing && (
      <ReleaseDomainModal
        domain={releasing}
        onClose={() => setReleasing(null)}
        onSuccess={onChanged}
      />
    )}
    {editing && (
      <EditDetailsModal
        domain={editing}
        onClose={() => setEditing(null)}
        onSuccess={onChanged}
      />
    )}
    {undernaming && (
      <UndernamesModal
        domain={undernaming}
        onClose={() => setUndernaming(null)}
        onSuccess={onChanged}
      />
    )}
    {controlling && (
      <ControllersModal
        domain={controlling}
        onClose={() => setControlling(null)}
        onSuccess={onChanged}
      />
    )}
    {settingPrimary && (
      <PrimaryNameModal
        mode="set"
        ownedNames={domains}
        presetName={settingPrimary.displayName}
        presetProcessId={settingPrimary.processId}
        onClose={() => setSettingPrimary(null)}
        onSuccess={onChanged}
      />
    )}
    </>
  );
}
