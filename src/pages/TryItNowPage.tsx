import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useHotWallet } from '../hooks/useHotWallet';
import TryItNowPanel from '../components/panels/TryItNowPanel';

/**
 * Try It Out Page
 *
 * Allows users to upload files without connecting a wallet.
 * Automatically generates and manages a temporary hot wallet.
 *
 * Behavior:
 * - If user has no wallet: Generate hot wallet automatically
 * - If user has hot wallet in session: Restore it
 * - If user has real wallet connected: Redirect to /upload
 */
export default function TryItNowPage() {
  const navigate = useNavigate();
  const { address, walletType, isHotWallet } = useStore();
  const { initializeHotWallet, isInitializing, hasStoredHotWallet, error } = useHotWallet();

  useEffect(() => {
    // If user has a real wallet connected (not hot wallet), redirect to regular upload
    if (address && walletType && !isHotWallet && !hasStoredHotWallet()) {
      navigate('/upload');
      return;
    }

    // Initialize hot wallet if:
    // - No wallet connected, OR
    // - Hot wallet exists in session storage but not yet restored
    if (!address || isHotWallet || hasStoredHotWallet()) {
      initializeHotWallet();
    }
  }, [address, walletType, isHotWallet, initializeHotWallet, hasStoredHotWallet, navigate]);

  // Loading state while initializing hot wallet
  if (isInitializing) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-turbo-red border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-link">Setting up your temporary wallet...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-400 text-2xl">!</span>
          </div>
          <h2 className="text-xl font-bold text-fg-muted mb-2">Failed to Create Wallet</h2>
          <p className="text-sm text-link mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-fg-muted text-canvas font-semibold rounded-lg hover:bg-fg-muted/90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-6 sm:pt-8 pb-3 sm:pb-4">
      <TryItNowPanel />
    </div>
  );
}
