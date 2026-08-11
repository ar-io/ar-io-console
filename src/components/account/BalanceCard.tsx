import { Coins, Share2, Plus, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWincForOneGiB } from '../../hooks/useWincForOneGiB';
import { useCreditBalance } from '../../hooks/useCreditBalance';
import { useFreeUploadLimit, useFreeStatus, freeTierSummary } from '../../hooks/useFreeUploadLimit';
import { wincPerCredit } from '../../constants';

export default function BalanceCard() {
  const navigate = useNavigate();
  const wincForOneGiB = useWincForOneGiB();
  const { freeUploadLimitBytes } = useFreeUploadLimit();
  const { bytesRemaining } = useFreeStatus();
  const { credits, isLoading: loading } = useCreditBalance();

  // Derive storage from credits (1 credit = 1e12 winc)
  const gibStorage = wincForOneGiB ? (credits * wincPerCredit) / Number(wincForOneGiB) : 0;

  const formatCredits = (credits: number): string => {
    if (credits >= 1) {
      return credits.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    } else if (credits > 0) {
      return credits.toLocaleString('en-US', {
        minimumFractionDigits: 6,
        maximumFractionDigits: 8,
      });
    } else {
      return '0';
    }
  };

  const freeMsg = freeTierSummary(freeUploadLimitBytes, bytesRemaining);
  const freeExhausted = bytesRemaining === 0;
  // Only show the storage estimate once pricing has resolved — otherwise it reads
  // a misleading "≈ 0.00 GiB" while useWincForOneGiB is still loading.
  const showStorage = !!wincForOneGiB && gibStorage > 0;

  return (
    <div className="rounded-2xl border border-border/20 bg-card p-4 sm:p-6">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/20 bg-foreground/20">
          <Coins className="h-5 w-5 text-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground">Balance</h3>
          <p className="text-sm text-foreground/80">Credits &amp; storage</p>
        </div>
      </div>

      {loading && credits === 0 ? (
        <div className="space-y-3">
          <div className="h-9 w-40 animate-pulse rounded bg-foreground/10" />
          <div className="h-4 w-52 animate-pulse rounded bg-foreground/10" />
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <div className="h-11 flex-1 animate-pulse rounded-full bg-foreground/10" />
            <div className="h-11 flex-1 animate-pulse rounded-full bg-foreground/10" />
          </div>
        </div>
      ) : (
        <>
          {/* Primary balance */}
          <div className="text-3xl font-bold tabular-nums text-foreground">
            {formatCredits(credits)}{' '}
            <span className="text-base font-semibold text-foreground/60">Credits</span>
          </div>
          {showStorage && (
            <div className="mt-1 text-sm text-foreground/60">
              ≈ {gibStorage.toFixed(2)} GiB of permanent storage
            </div>
          )}

          {/* Free-tier awareness */}
          {freeMsg && (
            <div
              className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                freeExhausted ? 'bg-foreground/5 text-foreground/60' : 'bg-success/10 text-success'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {freeMsg}
            </div>
          )}

          {/* Actions */}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => navigate('/topup')}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-foreground px-4 py-3 font-medium text-white transition-colors hover:bg-foreground/90"
            >
              <Plus className="h-4 w-4" />
              Top Up
            </button>
            <button
              onClick={() => navigate('/share')}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border/20 bg-background px-4 py-3 font-medium text-foreground transition-colors hover:bg-card"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          </div>
        </>
      )}
    </div>
  );
}
