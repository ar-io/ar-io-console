import { useCallback, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { Globe, RefreshCw, AlertTriangle, Download, Plus, Search, X } from 'lucide-react';
import { getExpiringDomains, expiryLabel } from '@/utils/domainExpiry';
import { downloadDomainsCsv } from '@/utils/domainCsv';
import { useOwnedArNSNames } from '@/hooks/useOwnedArNSNames';
import { useLinkedSolanaWallet } from '@/hooks/useLinkedSolanaWallet';
import DomainsTable from '@/components/account/DomainsTable';
import SyncOwnershipBanner from '@/components/account/SyncOwnershipBanner';
import IncompletePurchaseBanner from '@/features/arns/components/IncompletePurchaseBanner';
import LinkSolanaWalletModal from '@/components/modals/LinkSolanaWalletModal';
import ManageDomainModal from '@/features/arns/components/ManageDomainModal';
import { actionButtonClass } from '@/components/actionButton';
import { buttonClass } from '@/components/button';

const DOMAINS_SHOWN = 10;

/**
 * Domain Manager (`/my-domains`) — the dedicated home for everything you do with
 * the ArNS names you OWN: renew/extend, upgrade, transfer/reassign, records &
 * undernames, controllers, primary name, ownership sync, and CSV export. Split
 * out of the account/billing page so each has one job. Reachable from the waffle
 * "Manage Domains" entry.
 */
export default function MyDomainsPage() {
  const [nameFilter, setNameFilter] = useState('');
  const { address } = useStore();
  const navigate = useNavigate();
  const { hasArNSAccess, arnsAddress } = useLinkedSolanaWallet();
  /*
    Custodial names are merged inside useOwnedArNSNames now, so every consumer
    gets them. This page used to do it here — the merge is idempotent, so the
    duplicate was harmless, but two copies of the same rule is how they drift.
  */
  const {
    names: ownedNames,
    loading: loadingDomains,
    fetchOwnedNames,
  } = useOwnedArNSNames();
  // Stable, so the banner reports a completed purchase once.
  const refreshAfterPurchase = useCallback(() => {
    void fetchOwnedNames(true);
  }, [fetchOwnedNames]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showAllDomains, setShowAllDomains] = useState(false);
  /*
    Renew happens HERE, not behind a navigation.

    The button used to push to `/domains/<name>`, where the user still had to
    find "Renew / upgrade" — a button labelled Renew that did not renew. It
    opens the manage modal in place instead, already on the Renew action, so
    clearing the warning is one click and several expiring names can be dealt
    with in a row without leaving the banner that listed them.
  */
  const [renewing, setRenewing] = useState<string | undefined>();

  // Redirect to home if not logged in (declarative — never navigate during render)
  if (!address) {
    return <Navigate to="/" replace />;
  }

  const now = Date.now();
  // Filter your own names. Browse (/domains) has had search since launch while
  // this page — the one you actually live in — did not, so a large portfolio
  // could only be scrolled. Matches on the name and its unicode display form so
  // punycode names are findable by what the user sees.
  const needle = nameFilter.trim().toLowerCase();
  const expiringDomains = getExpiringDomains(ownedNames, now);
  const renewingDomain = renewing
    ? ownedNames.find((n) => n.name === renewing)
    : undefined;
  // Soonest-expiring first across ALL leases; permabuy (never expires) last.
  const sortedDomains = [...ownedNames].sort((a, b) => {
    const ka =
      a.type === 'permabuy' || typeof a.endTimestamp !== 'number'
        ? Infinity
        : a.endTimestamp;
    const kb =
      b.type === 'permabuy' || typeof b.endTimestamp !== 'number'
        ? Infinity
        : b.endTimestamp;
    return ka - kb;
  });
  const visibleDomains = needle
    ? sortedDomains.filter(
        (d) =>
          d.name.toLowerCase().includes(needle) ||
          (d.displayName ?? '').toLowerCase().includes(needle),
      )
    : sortedDomains;

  return (
    <div className="px-4 sm:px-6">
      {/* Header: title + (when signed in with ArNS access) the actions, on the
          same row at every width. On a phone they are icons, so they fit
          beside the title instead of sitting alone on a line below it. */}
      <div className="mb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/20">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="mb-1 font-heading text-2xl font-extrabold text-foreground sm:text-3xl">
              Manage Domains
            </h1>
            <p className="hidden text-sm text-foreground/80 sm:block">
              Renew, transfer, and configure the ArNS names you own.
            </p>
          </div>
        </div>

        {hasArNSAccess && (
          <div className="mt-1 flex flex-shrink-0 items-center gap-2">
            {ownedNames.length > 0 && (
              <button
                // Export what is on screen. With a search active, exporting the
                // full list instead of the visible matches would quietly hand
                // back a different set than the one being looked at.
                onClick={() => downloadDomainsCsv(visibleDomains)}
                className={actionButtonClass('default')}
                title={needle ? 'Export the matching names to CSV' : 'Export domains to CSV'}
              >
                <Download className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only">
                  Export CSV{needle ? ` (${visibleDomains.length})` : ''}
                </span>
              </button>
            )}
            <button
              onClick={() => fetchOwnedNames(true)}
              disabled={loadingDomains}
              className={actionButtonClass('default')}
              title="Refresh domains"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingDomains ? 'animate-spin' : ''}`} />
              <span className="sr-only sm:not-sr-only">Refresh</span>
            </button>
            {/* With names listed, the empty state's "Register a name" is gone;
                this keeps buying another one a click away. */}
            {ownedNames.length > 0 && (
              <button
                onClick={() => navigate('/arns')}
                className={actionButtonClass('primary')}
                title="Register a name"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only">Register a name</span>
              </button>
            )}
          </div>
        )}
      </div>
      {/* On a phone the actions share the title's row, so the description
          takes the full width below it rather than a squeezed column. */}
      <p className="mt-1 text-sm text-foreground/80 sm:hidden">
        Renew, transfer, and configure the ArNS names you own.
      </p>
      </div>

      {hasArNSAccess ? (
        <div className="mb-8">
          {/* Expiry warning — spans the owned leases we've loaded (the 100 most recent
              from the batch), so it surfaces at-risk names beyond the shown page. */}
          {expiringDomains.length > 0 && (
            <div className="mb-4 rounded-2xl border border-warning/40 bg-warning/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-warning" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {expiringDomains.length === 1
                      ? '1 domain is expiring soon'
                      : `${expiringDomains.length} domains are expiring soon`}
                  </p>
                  <p className="mt-0.5 text-xs text-foreground/80">
                    Renew before the lease ends to keep {expiringDomains.length === 1 ? 'it' : 'them'} — an expired domain can be registered by someone else.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {/*
                      Each name is its own way in. The single button below can
                      only act on one of them, so listing six as plain text next
                      to it left five with nothing to click.
                    */}
                    {expiringDomains.slice(0, 6).map((d) => (
                      <button
                        key={d.name}
                        type="button"
                        onClick={() => setRenewing(d.name)}
                        className="rounded text-xs text-foreground/80 underline-offset-2 hover:underline"
                      >
                        <span className="font-medium text-foreground">{d.displayName}</span>{' '}
                        <span className={d.daysRemaining < 0 ? 'text-error' : 'text-warning'}>
                          ({expiryLabel(d.daysRemaining)})
                        </span>
                      </button>
                    ))}
                    {expiringDomains.length > 6 && (
                      <span className="text-xs text-foreground/60">+{expiringDomains.length - 6} more</span>
                    )}
                  </div>
                </div>
                {/*
                  "soonest" rather than the name itself. `expiringDomains` is
                  sorted soonest-first so [0] is the most urgent, but a bare
                  "Renew" beside a list of six read as though it would address
                  all of them and then acted on one.

                  The name is deliberately NOT in the label. It is already in
                  the list above — where every entry is now its own button — so
                  repeating it duplicates what is on screen, and a 51-character
                  ArNS name inside a `flex-shrink-0` pill would push the banner
                  wider than the page on a phone.
                */}
                <button
                  type="button"
                  onClick={() => setRenewing(expiringDomains[0].name)}
                  className="flex-shrink-0 self-center whitespace-nowrap rounded-full bg-warning px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  {expiringDomains.length === 1 ? 'Renew' : 'Renew soonest'}
                </button>
              </div>
            </div>
          )}

          {/* Names owned on-chain but missing from the ACL index (out-of-band
              ANT transfers) — shown regardless of the owned-names state. */}
          <SyncOwnershipBanner
            address={arnsAddress}
            onSynced={() => fetchOwnedNames(true)}
          />

          {/* A purchase started here that did not finish: what happened to
              it, and to its credits, read live from the payment service. */}
          <IncompletePurchaseBanner
            address={arnsAddress ?? undefined}
            ownedNames={ownedNames}
            onCompleted={refreshAfterPurchase}
          />

          {loadingDomains ? (
            <div className="rounded-2xl border border-border/20 bg-card p-4 text-center sm:p-6">
              <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-foreground/80">Loading your domains…</p>
            </div>
          ) : ownedNames.length === 0 ? (
            <div className="rounded-2xl border border-border/20 bg-card p-6 text-center sm:p-8">
              <Globe className="mx-auto mb-4 h-12 w-12 text-primary/50" />
              <h3 className="mb-2 font-heading font-extrabold text-foreground">No domains yet</h3>
              <p className="mb-4 text-sm text-foreground/80">
                Register an ArNS name to give your sites and apps a friendly address.
              </p>
              <button
                onClick={() => navigate('/arns')}
                className={buttonClass('primary', 'sm')}
              >
                Register a name
              </button>
            </div>
          ) : (
            <>
              {/* Search sits above the table, mirroring BrowseDomainsPanel so the
                  two name lists behave identically. */}
              <div className="field mb-3 flex min-w-[180px] items-center rounded-2xl border border-border/20 bg-card transition-colors focus-within:border-primary">
                <Search className="ml-3 h-4 w-4 flex-shrink-0 text-foreground/50" />
                <input
                  type="text"
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value.toLowerCase())}
                  placeholder="Search your names"
                  aria-label="Search your names"
                  className="min-w-0 flex-1 bg-transparent p-2.5 font-mono text-sm text-foreground"
                />
                {nameFilter && (
                  <button
                    onClick={() => setNameFilter('')}
                    aria-label="Clear search"
                    className="mr-2 rounded-full p-1 text-foreground/50 transition-colors hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {visibleDomains.length === 0 ? (
                <p className="rounded-2xl border border-border/20 bg-card px-4 py-6 text-center text-sm text-foreground/60">
                  No names match &ldquo;{nameFilter}&rdquo;.
                </p>
              ) : (
                <DomainsTable
                  domains={
                    // A search should show every match; the show-more cap only
                    // applies to the unfiltered list.
                    needle || showAllDomains
                      ? visibleDomains
                      : visibleDomains.slice(0, DOMAINS_SHOWN)
                  }
                  walletAddress={arnsAddress}
                />
              )}

              {!needle && ownedNames.length > DOMAINS_SHOWN && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setShowAllDomains((v) => !v)}
                    className="inline-flex items-center justify-center gap-2 py-2 font-medium text-primary hover:underline"
                  >
                    {showAllDomains
                      ? 'Show fewer'
                      : `Show all ${ownedNames.length} names`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        // Signed in, but no Solana/ArNS access — prompt to link a Solana wallet.
        <div className="mb-8 rounded-2xl border border-border/20 bg-card p-6 text-center">
          <Globe className="mx-auto mb-3 h-8 w-8 text-primary" />
          <p className="font-semibold text-foreground">Manage your ArNS names</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-foreground/70">
            ArNS names live on Solana. Link a Solana wallet to view, renew, and
            manage the names you own — your other wallet stays your primary
            sign-in.
          </p>
          <button
            onClick={() => setShowLinkModal(true)}
            className={`${buttonClass('primary', 'md')} mt-4`}
          >
            <Globe className="h-4 w-4" />
            Link a Solana wallet
          </button>
        </div>
      )}

      {showLinkModal && (
        <LinkSolanaWalletModal onClose={() => setShowLinkModal(false)} />
      )}

      {/*
        Opens on Renew because that is what the user pressed. Refreshing on
        success is what makes the banner honest: the renewed name drops out of
        the warning, so the list they came to clear visibly shrinks.
      */}
      {renewingDomain && (
        <ManageDomainModal
          domain={renewingDomain}
          initialAction="Extend-Lease"
          onClose={() => setRenewing(undefined)}
          onSuccess={() => fetchOwnedNames(true)}
        />
      )}
    </div>
  );
}
