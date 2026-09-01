import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Flame,
  Infinity as InfinityIcon,
  Loader2,
  Pencil,
  RefreshCw,
  Rocket,
  Settings2,
  Wallet,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import type { ArNSName } from '@/types';
import BaseModal from '../../../components/modals/BaseModal';
import SolanaGateButton from '../../../components/SolanaGateButton';
import type { ArNSRegistrationType } from '../hooks/useArNSPrice';
import { useArNSCostDetails } from '../hooks/useArNSCostDetails';
import { useArNSPaymentBalances } from '../hooks/useArNSPaymentBalances';
import { useArNSTurboSigner } from '../hooks/useArNSTurboSigner';
import { useBuyReturnedName } from '../hooks/useBuyReturnedName';
import { useReturnedName } from '../hooks/useReturnedNames';
import { auctionMultiplier, formatCountdown } from '../returnedNamePricing';
import { ArNSFundingSource, ArNSPaymentSelector } from './ArNSPaymentSelector';
import { ArNSCostBreakdown } from './ArNSCostBreakdown';
import EditDetailsModal from './EditDetailsModal';
import ReturnedNamePremiumChart from './ReturnedNamePremiumChart';
import { toUnicodeName } from '@/utils/punycode';
import ModalHeader from '../../../components/modals/ModalHeader';
import TransactionReceipt from './TransactionReceipt';

const LEASE_YEAR_OPTIONS = [1, 2, 3, 4, 5];

interface ReturnedNameBuyModalProps {
  name: string;
  startTimestamp: number;
  endTimestamp: number;
  onClose: () => void;
}

/**
 * Buy a name from its returned-name (Dutch auction). Reuses the native ArNS
 * payment stack (funding-source selector + cost breakdown + cost-details hook),
 * re-checks auction freshness, gates on the Solana signer, and drives the
 * two-signature buy (spawn ANT → buyReturnedName) with a step progress UX.
 *
 * ARIO-only by design: a returned name always settles from the wallet's ARIO at
 * the current premium. Turbo Credits are intentionally NOT offered here — the
 * on-chain `buyReturnedName` draws from the wallet's liquid ARIO regardless of
 * the funding hint (io-writeable routes `turbo`→balance), and the premium-aware
 * price + affordability gate come from `getCostDetails` (which multiplies in the
 * returned-name premium). A credits path would both mis-quote the premium and
 * gate on a credit balance it never spends.
 */
export default function ReturnedNameBuyModal({
  name,
  startTimestamp,
  endTimestamp,
  onClose,
}: ReturnedNameBuyModalProps) {
  const navigate = useNavigate();
  const signer = useArNSTurboSigner();

  const [type, setType] = useState<ArNSRegistrationType>('lease');
  const [years, setYears] = useState(1);
  const [fundingSource, setFundingSource] =
    useState<ArNSFundingSource>('balance');
  const [editing, setEditing] = useState(false);

  // Live now-tick so the premium/countdown banner decays on screen.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const signerAddress = signer.address ?? undefined;
  const balances = useArNSPaymentBalances(signerAddress);
  const buyState = useBuyReturnedName();

  // Freshness re-check — a soft, non-blocking signal. Its rejection can't be told
  // apart from a transient RPC error, so it never gates the purchase (the
  // time-based window below is authoritative); a fetch error only shows a
  // retryable warning.
  const freshness = useReturnedName(name);

  // Fund the ARIO price from the chosen wallet source (liquid / +staked /
  // staked). `getCostDetails` prices this premium-aware and reports the real
  // shortfall for the chosen source — the authoritative affordability gate.
  const fundFrom = fundingSource;

  const {
    data: cost,
    isFetching: costLoading,
    error: costError,
  } = useArNSCostDetails({
    intent: 'Buy-Name',
    name,
    type,
    years,
    fundFrom,
    fromAddress: signerAddress,
    // Re-price the (premium-decaying) auction quote on a coarse ~20s cadence so
    // it doesn't stay frozen for the full 60s staleTime while the displayed
    // multiplier keeps falling every second. Conservative by design — the quote
    // trails the live premium, so the affordability gate never under-charges.
    refreshTick: Math.floor(now / 20_000),
  });

  const multiplier = auctionMultiplier({ startTimestamp, endTimestamp, now });
  const countdown = formatCountdown(Math.max(0, endTimestamp - now));
  // The auction window is authoritative for "ended" — a freshness fetch error is
  // ambiguous (name gone vs. RPC blip) and must not hard-block a still-live buy.
  const auctionEnded = now >= endTimestamp;
  const freshnessWarning = !auctionEnded && freshness.isError;

  const insufficientSol =
    // Only a KNOWN balance can block the action. `undefined` means the lookup
    // failed or never ran — blocking on that told funded users to go buy SOL.
    !!cost &&
    !balances.loading &&
    balances.sol !== undefined &&
    balances.sol < cost.gasTotalSol;
  const insufficientFunds = useMemo(
    () => (cost?.shortfallMARIO ?? 0) > 0,
    [cost?.shortfallMARIO],
  );

  const priceReady = cost?.arioCost != null;
  const canPay =
    priceReady &&
    !insufficientSol &&
    !insufficientFunds &&
    !buyState.isBusy &&
    !auctionEnded;

  const handleBuy = () => {
    void buyState
      .buy({
        name,
        type,
        years: type === 'lease' ? years : undefined,
        fundFrom,
      })
      .catch(() => undefined);
  };

  const newProcessId = buyState.result?.processId;
  const newDomain: ArNSName | undefined = newProcessId
    ? { name, displayName: toUnicodeName(name), processId: newProcessId }
    : undefined;

  return (
    <BaseModal onClose={onClose} showCloseButton>
      <div className="w-[92vw] max-w-md p-4 sm:p-5">
        {/* Header */}
        <ModalHeader
          icon={Flame}
          title={
            <>
              Buy{' '}
              <span className="break-all font-mono text-primary">
                {toUnicodeName(name)}.ar.io
              </span>
            </>
          }
          description="From the returned-name auction"
        />

        {/*
          The sharpest edge in the release, said before the button rather than
          discovered at the wallet.

          An auction sits one click from a registration that needs no SOL at
          all — but it is not a Turbo action: the buyer pays in ARIO, signs
          twice, and their own wallet covers the Solana rent. Twenty times the
          SOL of anything else in the app, and the only flow with two
          approvals. Reading as a bug is the default outcome unless all three
          facts are stated up front.
        */}
        <div className="mb-4 rounded-2xl border border-warning/30 bg-warning/10 p-3 text-xs text-foreground/80">
          Auction names work differently from registering a new one. You pay in
          ARIO, approve twice, and your wallet needs a small amount of SOL for
          the network fee — Turbo doesn&apos;t cover auctions yet.
        </div>

        {/* Live premium / countdown banner */}
        {buyState.phase === 'idle' && !auctionEnded && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3">
            <div>
              <p className="text-xs text-foreground/60">Current premium</p>
              <p className="font-heading text-lg font-extrabold text-primary">
                {multiplier.toFixed(1)}x
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-foreground/60">Ends in</p>
              <p className="font-mono text-sm font-semibold text-foreground">
                {countdown}
              </p>
            </div>
          </div>
        )}

        {/* Premium-decay chart */}
        {buyState.phase === 'idle' && !auctionEnded && (
          <div className="mb-4 rounded-2xl border border-border/20 bg-card px-4 pb-2 pt-3">
            <p className="mb-1 text-xs text-foreground/60">
              Premium falls as the auction runs
            </p>
            <ReturnedNamePremiumChart
              startTimestamp={startTimestamp}
              endTimestamp={endTimestamp}
              now={now}
            />
          </div>
        )}

        {/* Auction ended — only while idle, so it never competes with a terminal
            error (the clock can tick past `end` mid-submit; the failure must win). */}
        {auctionEnded && buyState.phase === 'idle' && (
          <div className="rounded-2xl border border-error/20 bg-error/10 p-5 text-sm">
            <div className="mb-1 flex items-center gap-2 font-semibold text-error">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              This auction has ended
            </div>
            <p className="text-foreground/80">
              The name may have already been bought or the auction window closed.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => freshness.refetch()}
                className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/10"
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
              <button
                onClick={onClose}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Soft freshness warning — non-blocking; the time window stays authoritative */}
        {freshnessWarning && buyState.phase === 'idle' && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
              <p className="text-foreground/80">
                Couldn&apos;t re-verify this auction is still live. You can still
                try the purchase — if the name was already taken, the transaction
                fails safely.
              </p>
            </div>
            <button
              onClick={() => freshness.refetch()}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-warning/30 bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-warning/10"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )}

        {/* Configure + buy. The buy button gates on a Solana signer via
            SolanaGateButton, so the wallet step appears at purchase time. */}
        {!auctionEnded && buyState.phase === 'idle' && (
          <>
            {/* Lease vs permabuy */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => setType('lease')}
                className={`flex items-center gap-2 rounded-2xl border p-3 transition-colors ${
                  type === 'lease'
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/20 bg-card text-foreground/70 hover:border-primary/40'
                }`}
              >
                <Calendar className="h-4 w-4" />
                <span className="font-medium">Lease</span>
              </button>
              <button
                onClick={() => setType('permabuy')}
                className={`flex items-center gap-2 rounded-2xl border p-3 transition-colors ${
                  type === 'permabuy'
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/20 bg-card text-foreground/70 hover:border-primary/40'
                }`}
              >
                <InfinityIcon className="h-4 w-4" />
                <span className="font-medium">Permabuy</span>
              </button>
            </div>

            {/* Lease term */}
            {type === 'lease' && (
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium">Lease term</label>
                <div className="flex flex-wrap gap-2">
                  {LEASE_YEAR_OPTIONS.map((y) => (
                    <button
                      key={y}
                      onClick={() => setYears(y)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
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

            {/* Funding source (ARIO only) */}
            <div className="mb-4">
              <ArNSPaymentSelector
                arioOnly
                options={[]}
                selectedId=""
                fundingSource={fundingSource}
                balances={balances}
                onSelect={() => undefined}
                onSourceChange={setFundingSource}
                disabled={buyState.isBusy}
              />
            </div>

            {/* Cost breakdown */}
            <div className="mb-4">
              <ArNSCostBreakdown
                priceUnit="ario"
                arioPrice={cost?.arioCost}
                priceLoading={costLoading}
                priceError={!!costError}
                gasTotalSol={cost?.gasTotalSol ?? 0}
                gasRentSol={cost?.gasRentSol ?? 0}
                gasFeeSol={cost?.gasFeeSol ?? 0}
                gasLoading={costLoading}
                solBalance={balances.sol}
                insufficientFunds={insufficientFunds}
                insufficientSol={insufficientSol}
              />
              <p className="mt-1 text-[11px] text-foreground/50">
                The price shown includes the current auction premium and falls as
                the auction runs.
              </p>
            </div>

            <SolanaGateButton
              onAction={handleBuy}
              disabled={!canPay}
              actionVerb="buy this name"
            >
              <Flame className="h-4 w-4" /> Buy with ARIO
            </SolanaGateButton>
          </>
        )}

        {/* Submitting — two-step progress */}
        {buyState.phase === 'submitting' && (
          <div className="rounded-2xl border border-primary/30 bg-card p-5">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-primary" />
              <div>
                <p className="font-medium text-foreground">
                  Step {Math.min(buyState.progress.done + 1, buyState.progress.total)}
                  /{buyState.progress.total} — {buyState.progress.label}
                </p>
                <p className="mt-0.5 text-xs text-foreground/60">
                  Keep this tab open. Approve each prompt — this takes two wallet
                  approvals.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success receipt */}
        {buyState.phase === 'success' && buyState.result && (
          <div className="rounded-2xl border border-primary/30 bg-card p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-primary" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  Bought &quot;{toUnicodeName(name)}.ar.io&quot;
                </p>
                <p className="mt-1 text-sm text-foreground/70">
                  The name is now yours and resolves across the ar.io network.
                </p>
                <TransactionReceipt
                  txId={buyState.result.messageId}
                  className="mt-3"
                />
                {/* A bare id labelled with a protocol term is noise on a
                    success screen — the transaction receipt above is what a
                    buyer can act on, and the name's own page carries the token
                    address for anyone who wants it. */}

                <p className="mt-4 text-sm font-medium text-foreground">
                  What&apos;s next?
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => navigate('/deploy')}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <Rocket className="h-4 w-4" /> Deploy a site
                  </button>
                  {newDomain && (
                    <button
                      onClick={() => setEditing(true)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/10"
                    >
                      <Pencil className="h-4 w-4" /> Edit details
                    </button>
                  )}
                  <button
                    onClick={() => navigate('/my-domains')}
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/10"
                  >
                    <Settings2 className="h-4 w-4" /> Manage domains
                  </button>
                  <a
                    href={`https://${name}.ar.io`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/10"
                  >
                    Visit <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
                <button
                  onClick={onClose}
                  className="mt-3 text-sm font-medium text-primary hover:underline"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error / insufficient ARIO — gated on phase, NOT the auction window: a
            submit that fails as the clock passes `end` must still show its reason
            (incl. the "your ANT was created — retry" hint), not the ended banner. */}
        {buyState.phase === 'error' && (
          buyState.insufficientCredits ? (
            <div className="rounded-2xl border border-warning/30 bg-warning/10 p-5">
              <div className="flex items-start gap-3">
                <Wallet className="h-6 w-6 flex-shrink-0 text-warning" />
                <div className="flex-1">
                  <p className="font-semibold text-foreground">
                    Not enough ARIO
                  </p>
                  <p className="mt-1 text-sm text-foreground/70">
                    Add ARIO to the funding source you selected, then try the
                    purchase again. If the first step already completed it will
                    be reused, so you won&apos;t pay that SOL twice.
                  </p>
                  <button
                    onClick={() => buyState.reset()}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-error/20 bg-error/10 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 flex-shrink-0 text-error" />
                <div className="flex-1">
                  <p className="font-semibold text-error">Purchase didn&apos;t complete</p>
                  <p className="mt-1 text-sm text-foreground/70">
                    {buyState.error?.message ?? 'Something went wrong. Please try again.'}
                  </p>
                  <button
                    onClick={() => buyState.reset()}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          )
        )}

        {editing && newDomain && (
          <EditDetailsModal domain={newDomain} onClose={() => setEditing(false)} />
        )}
      </div>
    </BaseModal>
  );
}
