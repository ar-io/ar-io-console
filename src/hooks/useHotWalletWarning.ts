import { useEffect } from 'react';
import { useStore } from '../store/useStore';

/**
 * Hook that shows a browser warning before leaving the page if:
 * - User has a hot wallet active
 * - Seed phrase hasn't been exported
 * - User has uploads tied to this wallet
 *
 * This prevents users from accidentally losing access to their uploads.
 * Should be called once at the app level (e.g., in App.tsx or AppRoutes).
 */
export function useHotWalletWarning() {
  const { isHotWallet, hotWalletSeedExported, uploadHistory, address } = useStore();

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only warn if: hot wallet + not exported + has uploads
      const hasUploads = uploadHistory.some((u) => u.owner === address);

      if (isHotWallet && !hotWalletSeedExported && hasUploads) {
        // Standard way to show a confirmation dialog
        e.preventDefault();
        // Chrome requires returnValue to be set
        e.returnValue =
          "You have uploads tied to an unsaved wallet. Export your recovery phrase or you'll lose access.";
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isHotWallet, hotWalletSeedExported, uploadHistory, address]);
}
