import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  Infinity as InfinityIcon,
  Layers,
  Loader2,
  Wallet,
  XCircle,
} from 'lucide-react';

import { ArNSName } from '@/types';
import BaseModal from '../../../components/modals/BaseModal';
import { daysUntil } from '../../../utils/domainExpiry';
import { useArNSPrice } from '../hooks/useArNSPrice';
import { useArNSTurboSigner } from '../hooks/useArNSTurboSigner';
import {
  ManageIntent,
  useManageArNSName,
} from '../hooks/useManageArNSName';

const manageUrl = (name: string) => `https://arns.ar.io/#/manage/names/${name}`;
const LEASE_YEAR_OPTIONS = [1, 2, 3, 4, 5];
const UNDERNAME_QTY_OPTIONS = [1, 5, 10, 25, 50];

interface ManageDomainModalProps {
  domain: ArNSName;
  onClose: () => void;
  /** Called after a settled change so the caller can refresh its data. */
  onSuccess?: () => void;
}

const ACTION_META: Record<
  ManageIntent,
  { label: string; icon: typeof CalendarPlus; verb: string }
> = {
  'Extend-Lease': { label: 'Renew', icon: CalendarPlus, verb: 'Extend lease' },
  'Upgrade-Name': {
    label: 'Make permanent',
    icon: InfinityIcon,
    verb: 'Upgrade to permabuy',
  },
  'Increase-Undername-Limit': {
    label: 'Add undernames',
    icon: Layers,
    verb: 'Increase undername limit',
  },
};

/**
 * In-console lifecycle management for an owned ArNS name: renew (extend lease),
 * upgrade a lease to permanent, or add undername slots — each paid with Turbo
 * Credits, replacing the old external arns.ar.io deep-links.
 */
export default function ManageDomainModal({
  domain,
  onClose,
  onSuccess,
}: ManageDomainModalProps) {
  const isLease = domain.type !== 'permabuy';
  const signer = useArNSTurboSigner();
  const canManage = signer.isReady;

  // Lease names can renew / upgrade / add undernames; permabuy can only add.
  const actions: ManageIntent[] = isLease
    ? ['Extend-Lease', 'Upgrade-Name', 'Increase-Undername-Limit']
    : ['Increase-Undername-Limit'];

  const [action, setAction] = useState<ManageIntent>(actions[0]);
  const [years, setYears] = useState(1);
  const [qty, setQty] = useState(1);

  const {
    manage,
    phase,
    statusMessage,
    error,
    insufficientCredits,
    isBusy,
  } = useManageArNSName();

  const priceArgs =
    action === 'Extend-Lease'
      ? { intent: 'Extend-Lease' as const, years }
      : action === 'Increase-Undername-Limit'
        ? { intent: 'Increase-Undername-Limit' as const, increaseQty: qty }
        : { intent: 'Upgrade-Name' as const };

  const {
    data: price,
    isFetching: priceLoading,
    error: priceError,
  } = useArNSPrice({
    name: domain.name,
    ...priceArgs,
    enabled: canManage && phase !== 'success',
  });

  const creditsLabel = useMemo(
    () =>
      price
        ? price.credits.toLocaleString(undefined, { maximumFractionDigits: 4 })
        : null,
    [price],
  );
  const usdLabel = useMemo(
    () =>
      price?.usd
        ? price.usd.toLocaleString(undefined, {
            style: 'currency',
            currency: 'USD',
          })
        : null,
    [price],
  );

  const expiryLabel =
    isLease && typeof domain.endTimestamp === 'number'
      ? `Expires in ${daysUntil(domain.endTimestamp, Date.now())} days`
      : 'Permanent';

  const handleConfirm = async () => {
    try {
      const res = await manage({
        name: domain.name,
        intent: action,
        years: action === 'Extend-Lease' ? years : undefined,
        increaseQty:
          action === 'Increase-Undername-Limit' ? qty : undefined,
      });
      if (res) onSuccess?.();
    } catch {
      // Error surfaced via hook state (`error`); nothing else to do here.
    }
  };

  return (
    <BaseModal onClose={onClose} showCloseButton>
      <div className="w-[92vw] max-w-lg p-6">
        {/* Header */}
        <div className="mb-5">
          <h3 className="font-heading text-xl font-bold text-foreground">
            Manage{' '}
            <span className="font-mono text-primary">
              {domain.displayName}.ar.io
            </span>
          </h3>
          <p className="mt-1 text-sm text-foreground/70">{expiryLabel}</p>
        </div>

        {/* Success state */}
        {phase === 'success' ? (
          <div className="rounded-2xl border border-primary/30 bg-card p-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-primary" />
            <p className="font-semibold text-foreground">
              {statusMessage || 'Done!'}
            </p>
            <button
              onClick={onClose}
              className="mt-4 rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Close
            </button>
          </div>
        ) : !canManage ? (
          /* Wallet gate — non-Solana falls back to the external manage app. */
          <div className="rounded-2xl border border-border/20 bg-card p-5 text-center">
            <p className="text-sm text-foreground/80">
              Connect or link a Solana wallet to manage this name in-console with
              Turbo Credits.
            </p>
            <a
              href={manageUrl(domain.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/30 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              Manage on arns.ar.io
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        ) : (
          <>
            {/* Action selector */}
            {actions.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {actions.map((a) => {
                  const Meta = ACTION_META[a];
                  const Icon = Meta.icon;
                  return (
                    <button
                      key={a}
                      onClick={() => setAction(a)}
                      disabled={isBusy}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                        action === a
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border/20 bg-card text-foreground/70 hover:border-primary/40'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {Meta.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Action-specific controls */}
            {action === 'Extend-Lease' && (
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium">
                  Extend by
                </label>
                <div className="flex flex-wrap gap-2">
                  {LEASE_YEAR_OPTIONS.map((y) => (
                    <button
                      key={y}
                      onClick={() => setYears(y)}
                      disabled={isBusy}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                        years === y
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border/20 bg-card text-foreground/70 hover:border-primary/40'
                      }`}
                    >
                      {y} {y === 1 ? 'year' : 'years'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {action === 'Increase-Undername-Limit' && (
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium">
                  Undername slots to add
                </label>
                <div className="flex flex-wrap gap-2">
                  {UNDERNAME_QTY_OPTIONS.map((n) => (
                    <button
                      key={n}
                      onClick={() => setQty(n)}
                      disabled={isBusy}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                        qty === n
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border/20 bg-card text-foreground/70 hover:border-primary/40'
                      }`}
                    >
                      +{n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {action === 'Upgrade-Name' && (
              <p className="mb-4 rounded-2xl border border-border/20 bg-card p-4 text-sm text-foreground/80">
                Convert this lease to a permanent registration — it will never
                expire and never need renewal.
              </p>
            )}

            {/* Price */}
            <div className="mb-4 rounded-2xl border border-border/20 bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/70">Cost</span>
                {priceLoading ? (
                  <span className="flex items-center gap-2 text-sm text-foreground/70">
                    <Loader2 className="h-4 w-4 animate-spin" /> Fetching price…
                  </span>
                ) : priceError ? (
                  <span className="text-sm text-error">Price unavailable</span>
                ) : creditsLabel ? (
                  <div className="text-right">
                    <div className="text-lg font-bold text-foreground">
                      {creditsLabel} Credits
                    </div>
                    {usdLabel && (
                      <div className="text-xs text-foreground/60">
                        ≈ {usdLabel}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-foreground/50">—</span>
                )}
              </div>
            </div>

            {/* Status / error */}
            {isBusy && (
              <div className="mb-4 flex items-center gap-2 text-sm text-foreground/70">
                <Loader2 className="h-4 w-4 animate-spin" />
                {statusMessage || 'Processing…'}
              </div>
            )}
            {phase === 'error' && insufficientCredits && (
              <div className="mb-4 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm">
                <p className="mb-2 font-medium text-foreground">
                  Not enough Turbo Credits for this.
                </p>
                <Link
                  to="/topup"
                  onClick={onClose}
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                >
                  Top up credits
                </Link>
              </div>
            )}
            {phase === 'error' && !insufficientCredits && error && (
              <div className="mb-4 flex items-start gap-2 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error.message}</span>
              </div>
            )}

            {/* Confirm */}
            <button
              onClick={handleConfirm}
              disabled={isBusy || priceLoading || !price}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                </>
              ) : (
                <>
                  <Wallet className="h-4 w-4" /> {ACTION_META[action].verb} with
                  Turbo Credits
                </>
              )}
            </button>
          </>
        )}
      </div>
    </BaseModal>
  );
}
