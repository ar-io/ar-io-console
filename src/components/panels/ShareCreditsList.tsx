import { useState } from 'react';
import { formatWalletAddress } from '../../utils';
import { formatCreditsFloor, type ShareRow } from '../../utils/shareableCredits';
import { buttonClass } from '@/components/button';

// Rows a phone shows before "Show all"; desktop scrolls the whole list inside
// a card locked to the form's height.
const PHONE_ROWS = 3;

const fmt = formatCreditsFloor;

const expiryLabel = (row: ShareRow) => {
  if (!row.soonestExpiry) return 'Never expires';
  const date = new Date(row.soonestExpiry).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return row.count > 1 ? `Next expiry ${date}` : `Expires ${date}`;
};

type Tab = 'given' | 'received';

/**
 * The right-hand card on Share Credits: the shares this wallet has made, and
 * the ones made to it, as two tabs. Given rows are already grouped by
 * recipient (`toShareRows`), so Revoke acts on exactly what its row shows.
 */
export default function ShareCreditsList({
  given,
  received,
  sharedOutWinc,
  receivedWinc,
  onRevoke,
}: {
  given: ShareRow[];
  received: ShareRow[];
  sharedOutWinc: bigint;
  receivedWinc: bigint;
  onRevoke: (address: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>(given.length === 0 && received.length > 0 ? 'received' : 'given');
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState('');

  const rows = tab === 'given' ? given : received;
  const pick = (next: Tab) => {
    setTab(next);
    setExpanded(false);
    setConfirming(null);
    setRevokeError('');
  };

  const revoke = async (address: string) => {
    setRevoking(address);
    setRevokeError('');
    try {
      await onRevoke(address);
      setConfirming(null);
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : 'Failed to revoke');
    } finally {
      setRevoking(null);
    }
  };

  const tabClass = (active: boolean) =>
    `rounded-xl text-sm transition-colors ${active ? 'bg-lavender font-semibold text-foreground' : 'font-medium text-foreground/80 hover:text-foreground'}`;

  return (
    <section
      aria-label="Shares"
      className="flex flex-col gap-3 rounded-2xl border border-border/20 bg-card p-4 sm:p-6 lg:absolute lg:inset-0"
    >
      <div role="tablist" aria-label="Shares" className="grid h-12 flex-shrink-0 grid-cols-2 gap-1 rounded-2xl border border-border/20 bg-background p-1">
        <button type="button" role="tab" id="tab-given" aria-controls="panel-shares" aria-selected={tab === 'given'} onClick={() => pick('given')} className={tabClass(tab === 'given')}>
          Your shares · {given.length}
        </button>
        <button type="button" role="tab" id="tab-received" aria-controls="panel-shares" aria-selected={tab === 'received'} onClick={() => pick('received')} className={tabClass(tab === 'received')}>
          Shared with you · {received.length}
        </button>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-shrink-0 flex-wrap justify-between gap-x-2 text-sm text-foreground/70">
          <span>{tab === 'given' ? `${fmt(sharedOutWinc)} unspent` : `${fmt(receivedWinc)} left to spend`}</span>
          <span>{tab === 'given' ? 'Revoke returns the unspent part' : 'Spend only, can’t be re-shared'}</span>
        </div>
      )}

      {revokeError && <div className="flex-shrink-0 rounded-xl bg-error/10 p-3 text-sm text-error">{revokeError}</div>}

      <div
        id="panel-shares"
        role="tabpanel"
        aria-labelledby={tab === 'given' ? 'tab-given' : 'tab-received'}
        tabIndex={0}
        className="flex flex-col gap-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1"
      >
        {rows.length === 0 && (
          <p className="py-6 text-center text-sm text-foreground/70">
            {tab === 'given'
              ? 'You haven’t shared any credits yet. Shares you make show up here, with how much has been spent.'
              : 'No wallet has shared credits with you.'}
          </p>
        )}
        {rows.map((row, i) => {
          const pct = row.approvedWinc > 0n ? Number((row.usedWinc * 100n) / row.approvedWinc) : 0;
          return (
            <div
              key={row.address}
              className={`flex-shrink-0 flex-col gap-2 rounded-2xl bg-background px-3.5 py-3 ${i >= PHONE_ROWS && !expanded ? 'hidden lg:flex' : 'flex'}`}
            >
              <div className="flex min-h-[2.75rem] items-center justify-between gap-2 lg:min-h-8">
                <span className="font-mono text-sm" title={row.address}>
                  {formatWalletAddress(row.address, 4)}
                  {row.count > 1 && <span className="ml-1.5 font-body text-xs text-foreground/60">{row.count} shares</span>}
                </span>
                {tab === 'given' && confirming !== row.address && (
                  <button type="button" onClick={() => setConfirming(row.address)} className={`${buttonClass('secondary', 'xs')} min-h-[2.75rem] lg:min-h-0`}>
                    Revoke
                  </button>
                )}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-subtle-border" aria-hidden="true">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between gap-2 text-xs text-foreground/70">
                <span>
                  {fmt(row.usedWinc)} of {fmt(row.approvedWinc)} {tab === 'given' ? 'spent' : 'used'}
                </span>
                <span>{expiryLabel(row)}</span>
              </div>
              {confirming === row.address && (
                <div className="mt-1 flex flex-col gap-2 border-t border-border/20 pt-3">
                  <p className="text-sm text-foreground/80">
                    Revoke the unspent {fmt(row.remainingWinc)} credits
                    {row.count > 1 ? ` across all ${row.count} shares` : ''}? This wallet can’t spend them after this.
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => revoke(row.address)} disabled={revoking !== null} className={buttonClass('danger', 'xs')}>
                      {revoking === row.address ? 'Revoking…' : 'Revoke'}
                    </button>
                    <button type="button" onClick={() => setConfirming(null)} disabled={revoking !== null} className={buttonClass('secondary', 'xs')}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {rows.length > PHONE_ROWS && !expanded && (
        <button type="button" onClick={() => setExpanded(true)} className={`${buttonClass('secondary', 'md')} w-full lg:hidden`}>
          Show all {rows.length}
        </button>
      )}
    </section>
  );
}
