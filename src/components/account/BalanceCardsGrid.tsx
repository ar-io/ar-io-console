import { useEffect, useState } from 'react';
import { Coins, Share2, Plus, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getTurboBalance } from '../../utils';
import { useStore } from '../../store/useStore';
import { useWincForOneGiB } from '../../hooks/useWincForOneGiB';
import { useFreeUploadLimit, useFreeStatus, freeTierSummary } from '../../hooks/useFreeUploadLimit';
import { wincPerCredit } from '../../constants';

interface BalanceData {
  credits: number;
  gibStorage: number;
}

export default function BalanceCardsGrid() {
  const { address, walletType } = useStore();
  const navigate = useNavigate();
  const wincForOneGiB = useWincForOneGiB();
  const { freeUploadLimitBytes } = useFreeUploadLimit();
  const { bytesRemaining } = useFreeStatus();
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchBalanceData = async () => {
      if (!address || !walletType) return;

      setLoading(true);
      try {
        const balance = await getTurboBalance(address, walletType);
        const { winc } = balance;

        const credits = Number(winc) / wincPerCredit;
        const gibStorage = wincForOneGiB ? Number(winc) / Number(wincForOneGiB) : 0;

        setBalanceData({ credits, gibStorage });
      } catch (error) {
        console.error('Failed to fetch balance data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBalanceData();
  }, [address, walletType, wincForOneGiB]);

  if (!balanceData && !loading) {
    return null;
  }

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

  return (
    <div className="rounded-2xl border border-border/20 bg-card p-5 sm:p-6">
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

      {loading ? (
        <div className="py-8 text-center text-foreground/80">Loading account balance…</div>
      ) : balanceData ? (
        <>
          {/* Primary balance */}
          <div className="text-3xl font-bold tabular-nums text-foreground">
            {formatCredits(balanceData.credits)}{' '}
            <span className="text-base font-semibold text-foreground/60">Credits</span>
          </div>
          <div className="mt-1 text-sm text-success">
            ≈ {balanceData.gibStorage.toFixed(2)} GiB of permanent storage
          </div>

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
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-foreground px-4 py-3 font-medium text-card transition-colors hover:bg-foreground/90"
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
      ) : (
        <div className="py-8 text-center text-foreground/80">Unable to load balance data</div>
      )}
    </div>
  );
}
