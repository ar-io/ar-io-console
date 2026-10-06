import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import RecordsTable from '@/features/arns/components/RecordsTable';
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  Layers,
  Loader2,
  Star,
  Tag,
  Users,
} from 'lucide-react';

import { useStore } from '@/store/useStore';
import CopyButton from '@/components/CopyButton';
import { daysUntil } from '@/utils/domainExpiry';
import type { ArNSName } from '@/types';
import { useLinkedSolanaWallet } from '@/hooks/useLinkedSolanaWallet';
import {
  ManageDomainModal,
  EditDetailsModal,
  ControllersModal,
  PrimaryNameModal,
  TransferDomainModal,
  ReassignDomainModal,
  ReleaseDomainModal,
  useANTDetails,
  useUndernameRecords,
  useControllersState,
  usePrimaryName,
} from '@/features/arns';
import { useArNSNameRecord } from '@/features/arns/hooks/useArNSNameRecord';
import { useAntSummaries } from '@/features/arns/hooks/useAntLogos';
import { deriveAntRoleStrict } from '@/features/arns/antRole';
import { isArweaveTxId, isValidArNSName } from '@/features/arns/utils';
import { toUnicodeName } from '@/utils/punycode';
import { actionButtonClass } from '@/components/actionButton';
import { arnsHostFor } from '@/features/pages/publish/renderCtx';

/** Which action modal is open, if any. */
type OpenModal =
  | 'manage'
  | 'edit'
  | 'controllers'
  | 'primary'
  | 'transfer'
  | 'reassign'
  | 'release'
  | null;

// Normalize timestamps that may arrive in seconds (Solana) or ms, then format.
const fmtDate = (ts?: number) => {
  if (!ts) return '—';
  // Values below 1e12 are seconds (epoch seconds top out at ~1.7e9 through 2024);
  // values above are already milliseconds.
  const ms = ts < 1e12 ? ts * 1000 : ts;
  return ms >= 946684800000
    ? new Date(ms).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : '—';
};

function shorten(id: string, head = 6, tail = 4) {
  return id.length > head + tail + 1 ? `${id.slice(0, head)}…${id.slice(-tail)}` : id;
}

function SectionCard({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: typeof Globe;
  /**
   * The section's own action, beside its title. Actions live with what they
   * change: they used to be one row of eight buttons at the foot of the page,
   * below a records table that can run long.
   */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/20 bg-card p-4">
      {/* Wraps so a card with several actions (Ownership) never crowds its title. */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 flex-shrink-0 text-primary" />
          <h2 className="truncate font-heading text-sm font-extrabold uppercase tracking-wide text-foreground/70">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/** A section's action, beside its title. See `actionButtonClass`. */
function SectionAction({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className={actionButtonClass(danger ? 'danger' : 'default')}>
      {label}
    </button>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/10 py-2.5 last:border-0">
      <span className="flex-shrink-0 text-sm text-foreground/60">{label}</span>
      <div className="min-w-0 text-right text-sm text-foreground">{children}</div>
    </div>
  );
}


/**
 * Name Detail (`/domains/:name`) — the single, deep-linkable page for one ArNS
 * name. Shows everything (resolved target, records/undernames, controllers,
 * owner + your role, primary-name status, on-chain details, registration/expiry)
 * and launches the existing action modals, role-gated. Works for any name — a
 * registered name renders its full detail; an unregistered one offers to register
 * it; a name you don't own is a read-only public view. Replaces the old
 * browse-side DomainDetailsModal and is the canonical home the manage table and
 * browse table link into.
 */

export default function NameDetailPage() {
  const { name: rawName } = useParams<{ name: string }>();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const backTo = from === '/my-domains' ? '/my-domains' : '/domains';
  const backLabel = backTo === '/my-domains' ? 'My domains' : 'All names';
  const navigate = useNavigate();
  const configMode = useStore((s) => s.configMode);
  const arioGatewayUrl = useStore((s) => s.getCurrentConfig().arioGatewayUrl);
  // The host that serves this network's names: ar.io on mainnet, the testnet
  // gateway on devnet, where ar.io would not resolve them.
  const arnsHost = arnsHostFor({ configMode, arioGatewayUrl });
  const { arnsAddress } = useLinkedSolanaWallet();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<OpenModal>(null);

  const name = (rawName ?? '').toLowerCase();
  const displayName = toUnicodeName(name);
  const validName = isValidArNSName(name);

  const {
    data: lookup,
    isLoading: recordLoading,
    error: recordError,
    refetch: refetchRecord,
  } = useArNSNameRecord(validName ? name : undefined);

  const record = lookup?.record ?? null;
  const processId = record?.processId;

  // Everything below keys off the ANT process id; disabled until we have one.
  const antEnabled = !!processId;
  const { data: ant } = useANTDetails(processId, antEnabled);
  const { data: undernames } = useUndernameRecords(processId, antEnabled);
  const { data: controllers } = useControllersState(processId, antEnabled);
  const summaries = useAntSummaries(processId ? [processId] : []);
  const summary = processId ? summaries.get(processId) : undefined;
  const owner = summary?.owner ?? controllers?.owner;
  const { data: primary, isFetched: primaryFetched } = usePrimaryName(owner, !!owner);

  // STRICT role — the name may be one you don't own or control (public view),
  // so there is NO optimistic "assume controller" fallback here.
  const role = deriveAntRoleStrict(summary, arnsAddress);
  /*
    Every name here is the user's, so an owner-only control either opens or is
    denied by the on-chain role check below. There is no third state: the
    detour that sent these through a "claim your name" step existed only while
    Turbo could hold a name, and Turbo now holds none.
  */
  const openOwnerAction = (modal: OpenModal) => setOpen(modal);

  const ownerOnly = role === 'owner';
  const canManage = role === 'owner' || role === 'controller';

  /**
   * Records follow the same rule as everything else: owners and controllers
   * edit them, nobody else does. Turbo performs the write and pays the Solana
   * fee, but authority is still read from the chain.
   */
  const canEditRecords = canManage;
  const isPrimary = !!primary?.current && primary.current.name === name;

  // A minimal ArNSName the action modals consume (they read name/displayName/
  // processId/type/endTimestamp).
  const arnsName: ArNSName | null = useMemo(() => {
    if (!record) return null;
    return {
      name: record.name,
      displayName,
      processId: record.processId,
      type: record.type,
      endTimestamp: record.endTimestamp,
    };
    // displayName is derived from `name` (a plain string), so including it just
    // recomputes when the route's name changes — without it the memo could pair
    // a new record with the previous name's unicode rendering.
  }, [record, displayName]);

  const logoTxId = ant?.logo && isArweaveTxId(ant.logo) ? ant.logo : undefined;
  const explorerUrl = processId
    ? `https://explorer.solana.com/address/${processId}${
        configMode === 'development' ? '?cluster=devnet' : ''
      }`
    : undefined;

  // After any write, refetch the record AND invalidate every query scoped to
  // this name's processId / name / owner (ANT details, undernames, controllers,
  // ANT summaries, primary-name) — otherwise the page shows a stale target,
  // records, ownership, or primary status after Edit/Primary/Transfer/Reassign/
  // Release (those modals only call onSuccess).
  const refresh = () => {
    refetchRecord();
    queryClient.invalidateQueries({
      predicate: (q) => {
        const key = JSON.stringify(q.queryKey);
        return (
          (!!processId && key.includes(processId)) ||
          (!!owner && key.includes(owner)) ||
          key.includes(name)
        );
      },
    });
  };

  return (
    <div className="px-4 sm:px-6">
      {/* Back goes where you came FROM. This page is reachable from My Domains,
          from Browse, and from a deep link, and a hardcoded "/domains" dumped
          portfolio users into the public browse-all table. Falls back to
          browse for a cold deep link, which has no origin to return to. */}
      <Link
        to={backTo}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </Link>

      {/* Invalid name */}
      {!validName ? (
        <div className="rounded-2xl border border-border/20 bg-card p-8 text-center">
          <Globe className="mx-auto mb-3 h-10 w-10 text-foreground/30" />
          <h1 className="mb-1 font-heading text-xl font-extrabold text-foreground">
            Not a valid name
          </h1>
          <p className="text-sm text-foreground/70">
            "{rawName}" isn't a valid ArNS name.
          </p>
        </div>
      ) : recordLoading ? (
        <div className="rounded-2xl border border-border/20 bg-card p-8 text-center">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-foreground/70">
            Loading{' '}
            <span className="font-mono text-foreground">{displayName}.ar.io</span>…
          </p>
        </div>
      ) : recordError ? (
        <div className="rounded-2xl border border-error/20 bg-error/10 p-8 text-center">
          <h1 className="mb-1 font-heading text-xl font-extrabold text-foreground">
            Couldn't load this name
          </h1>
          <p className="mb-4 text-sm text-foreground/70">
            The gateway didn't respond. This isn't a "name is available" result —
            just try again.
          </p>
          <button
            onClick={() => refetchRecord()}
            className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Retry
          </button>
        </div>
      ) : lookup?.available ? (
        // Unregistered → offer to register.
        <div className="rounded-2xl border border-primary/30 bg-card p-8 text-center">
          <Globe className="mx-auto mb-3 h-10 w-10 text-primary/60" />
          <h1 className="mb-1 font-heading text-2xl font-extrabold text-foreground">
            <span className="font-mono">{displayName}</span>
            <span className="text-foreground/50">.ar.io</span> is available
          </h1>
          <p className="mb-5 text-sm text-foreground/70">
            No one owns this name yet — you could be the first.
          </p>
          <button
            onClick={() => navigate(`/arns?q=${encodeURIComponent(name)}`)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Register {displayName}.ar.io
          </button>
        </div>
      ) : record && arnsName ? (
        <>
          {/* Header */}
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border/20 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/15">
                <Globe className="h-6 w-6 text-primary" />
                {logoTxId && (
                  <img
                    src={`https://arweave.net/${logoTxId}`}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="truncate font-heading text-2xl font-extrabold text-foreground">
                  {displayName}
                  <span className="font-normal text-foreground/50">.{arnsHost}</span>
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      record.type === 'permabuy'
                        ? 'bg-primary/15 text-primary'
                        : 'bg-foreground/10 text-foreground/80'
                    }`}
                  >
                    {record.type === 'permabuy' ? 'Permanent' : 'Lease'}
                  </span>
                  {isPrimary && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                      <Star className="h-3 w-3" /> Primary
                    </span>
                  )}
                  {canManage && (
                    <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-medium capitalize text-foreground/80">
                      You: {role}
                    </span>
                  )}
                  {/*
                    Beside the Primary badge it would earn. `isPrimary` is the
                    OWNER's primary name, so it hides this only for the owner; a
                    controller sets their own. Waits for the lookup so it never
                    flashes in on a name that is already primary.
                  */}
                  {canManage && primaryFetched && (role === 'controller' || !isPrimary) && (
                    <button
                      type="button"
                      onClick={() => openOwnerAction('primary')}
                      className={actionButtonClass()}
                    >
                      <Star className="h-3.5 w-3.5" /> Set as primary
                    </button>
                  )}
                </div>
              </div>
            </div>
            <a
              href={`https://${name}.${arnsHost}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Visit <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Overview */}
            {/* Renewing and upgrading are registry payments, settled through
                the payment picker; the same modal adds undername slots. */}
            <SectionCard
              title="Overview"
              icon={Globe}
              action={
                canManage && (
                  <SectionAction
                    label={record.type === 'lease' ? 'Renew or upgrade' : 'Add undername slots'}
                    onClick={() => setOpen('manage')}
                  />
                )
              }
            >
              <InfoRow label="Registered">{fmtDate(record.startTimestamp)}</InfoRow>
              <InfoRow label="Expires">
                {record.type === 'permabuy' ? (
                  'Never'
                ) : record.endTimestamp ? (
                  <div>
                    {fmtDate(record.endTimestamp)}
                    <div className="text-xs text-foreground/50">
                      in {daysUntil(record.endTimestamp, Date.now())} days
                    </div>
                  </div>
                ) : (
                  '—'
                )}
              </InfoRow>
              <InfoRow label="Undername slots">
                {record.undernameLimit != null
                  ? record.undernameLimit.toLocaleString()
                  : '—'}
              </InfoRow>
            </SectionCard>

            {/* Details (ANT metadata) */}
            <SectionCard
              title="Details"
              icon={Tag}
              action={
                canManage && (
                  <SectionAction label="Edit" onClick={() => openOwnerAction('edit')} />
                )
              }
            >
              {ant &&
              (ant.name ||
                ant.ticker ||
                ant.description ||
                (ant.keywords?.length ?? 0) > 0) ? (
                <>
                  {ant.name && (
                    <InfoRow label="Nickname">
                      <span className="break-words">{ant.name}</span>
                    </InfoRow>
                  )}
                  {ant.ticker && <InfoRow label="Ticker">{ant.ticker}</InfoRow>}
                  {ant.description && (
                    <div className="py-2.5">
                      <div className="text-sm text-foreground/60">Description</div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                        {ant.description}
                      </p>
                    </div>
                  )}
                  {ant.keywords && ant.keywords.length > 0 && (
                    <div className="py-2.5">
                      <div className="text-sm text-foreground/60">Keywords</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {ant.keywords.map((k) => (
                          <span
                            key={k}
                            className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs text-foreground/80"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="py-2 text-xs text-foreground/50">No details set.</p>
              )}
            </SectionCard>

            {/* Ownership: who holds the name, and the owner's actions that
                change that. Set apart in red because none of them is undone
                by the same button. */}
            <SectionCard
              title="Ownership"
              icon={Layers}
              action={
                ownerOnly && (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <SectionAction danger label="Transfer" onClick={() => setOpen('transfer')} />
                    <SectionAction danger label="Reassign" onClick={() => openOwnerAction('reassign')} />
                    {record.type === 'permabuy' && (
                      <SectionAction danger label="Release" onClick={() => openOwnerAction('release')} />
                    )}
                  </div>
                )
              }
            >
              <InfoRow label="Name token (ANT)">
                <div className="flex min-w-0 items-center justify-end gap-1">
                  <span className="truncate font-mono text-xs">
                    {shorten(record.processId, 8, 6)}
                  </span>
                  <CopyButton textToCopy={record.processId} />
                </div>
              </InfoRow>
              {owner && (
                <InfoRow label="Owner">
                  <div className="flex min-w-0 items-center justify-end gap-1">
                    <span className="truncate font-mono text-xs">
                      {shorten(owner, 6, 4)}
                    </span>
                    <CopyButton textToCopy={owner} />
                  </div>
                </InfoRow>
              )}
              {explorerUrl && (
                <InfoRow label="Explorer">
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                </InfoRow>
              )}
            </SectionCard>

            {/* Controllers */}
            <SectionCard
              title="Controllers"
              icon={Users}
              action={
                ownerOnly && (
                  <SectionAction label="Manage" onClick={() => openOwnerAction('controllers')} />
                )
              }
            >
              {controllers ? (
                controllers.controllers.length > 0 ? (
                  controllers.controllers.map((c) => (
                    <InfoRow key={c} label="Controller">
                      <div className="flex min-w-0 items-center justify-end gap-1">
                        <span className="truncate font-mono text-xs">
                          {shorten(c, 6, 4)}
                        </span>
                        <CopyButton textToCopy={c} />
                      </div>
                    </InfoRow>
                  ))
                ) : (
                  <p className="py-2 text-xs text-foreground/50">
                    No additional controllers.
                  </p>
                )
              ) : (
                <p className="py-2 text-xs text-foreground/50">Loading…</p>
              )}
            </SectionCard>
          </div>

          {/* Records — the name's whole zone (`@` + every undername) in one
              editable table, DNS-style. Replaces the old split where the root
              lived in "Edit details" and everything else in an "Undernames"
              modal. */}
          <RecordsTable
            processId={record.processId}
            name={name ?? undefined}
            ant={ant}
            undernames={undernames}
            canManage={canEditRecords}
            undernameLimit={record.undernameLimit}
            arnsHost={arnsHost}
            onSuccess={refresh}
          />

          {/* Action modals — each reuses the existing component, refetches on success */}
          {open === 'manage' && (
            <ManageDomainModal domain={arnsName} onClose={() => setOpen(null)} onSuccess={refresh} />
          )}
          {open === 'edit' && (
            <EditDetailsModal domain={arnsName} onClose={() => setOpen(null)} onSuccess={refresh} />
          )}
          {open === 'controllers' && (
            <ControllersModal domain={arnsName} onClose={() => setOpen(null)} onSuccess={refresh} />
          )}
          {open === 'primary' && (
            <PrimaryNameModal
              mode={primary?.current ? 'change' : 'set'}
              ownedNames={[arnsName]}
              presetName={arnsName.displayName}
              presetProcessId={arnsName.processId}
              currentPrimary={primary?.current?.name}
              pendingRequest={
                primary?.request
                  ? { name: primary.request.name, initiator: primary.request.initiator }
                  : undefined
              }
              onClose={() => setOpen(null)}
              onSuccess={refresh}
            />
          )}
          {open === 'transfer' && (
            <TransferDomainModal domain={arnsName} onClose={() => setOpen(null)} onSuccess={refresh} />
          )}
          {open === 'reassign' && (
            <ReassignDomainModal domain={arnsName} onClose={() => setOpen(null)} onSuccess={refresh} />
          )}
          {open === 'release' && (
            <ReleaseDomainModal domain={arnsName} onClose={() => setOpen(null)} onSuccess={refresh} />
          )}
        </>
      ) : null}
    </div>
  );
}
