import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useHotWallet } from '../hooks/useHotWallet';
import TryItNowPanel from '../components/panels/TryItNowPanel';

/**
 * Try It Out Page
 *
 * Allows users to upload files without connecting a wallet.
 * Hot wallet is generated on-demand when user clicks upload.
 *
 * Behavior:
 * - If user has real wallet connected: Redirect to /upload
 * - If user has existing hot wallet: Restore it (to show upload history)
 * - If user has no wallet: Show upload UI, generate wallet on first upload
 */
export default function TryItNowPage() {
  const navigate = useNavigate();
  const { address, walletType, isHotWallet } = useStore();
  const { restoreHotWallet, hasStoredHotWallet } = useHotWallet();

  useEffect(() => {
    // If user has a real wallet connected (not hot wallet), redirect to regular upload
    if (address && walletType && !isHotWallet && !hasStoredHotWallet()) {
      navigate('/upload');
      return;
    }

    // Only restore existing hot wallet - don't generate new one
    // New wallet will be generated on-demand when user clicks upload
    if (hasStoredHotWallet() && !isHotWallet) {
      restoreHotWallet();
    }
  }, [address, walletType, isHotWallet, restoreHotWallet, hasStoredHotWallet, navigate]);

  return (
    <div className="pt-6 sm:pt-8 pb-3 sm:pb-4">
      <TryItNowPanel />
    </div>
  );
}
