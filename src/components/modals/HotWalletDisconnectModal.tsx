import { useState } from 'react';
import { AlertTriangle, Key } from 'lucide-react';
import BaseModal from './BaseModal';
import SeedPhraseModal from './SeedPhraseModal';
import { useStore } from '../../store/useStore';

interface HotWalletDisconnectModalProps {
  onClose: () => void;
  onDisconnect: () => void;
  seedExported: boolean;
}

export default function HotWalletDisconnectModal({
  onClose,
  onDisconnect,
  seedExported,
}: HotWalletDisconnectModalProps) {
  const { uploadHistory, address } = useStore();
  const [showSeedModal, setShowSeedModal] = useState(false);

  // Count uploads for this address
  const uploadCount = uploadHistory.filter((u) => u.owner === address).length;

  // If seed is already exported, show simple confirmation
  if (seedExported) {
    return (
      <BaseModal onClose={onClose}>
        <div className="w-[400px] p-6">
          <h2 className="text-xl font-bold text-fg-muted mb-4">Disconnect Temporary Wallet?</h2>
          <p className="text-sm text-link mb-6">
            You can restore this seedphrase into any Ethereum wallet and log in later.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-lg border border-default text-link hover:bg-surface hover:text-fg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onDisconnect}
              className="flex-1 py-3 px-4 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      </BaseModal>
    );
  }

  // Seed not exported - show warning
  return (
    <>
      <BaseModal onClose={onClose}>
        <div className="w-[450px] p-6">
          {/* Warning Header */}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-alert-warning" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-fg-muted">
                You Haven't Saved Your Recovery Phrase
              </h2>
            </div>
          </div>

          {/* Warning Message */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
            <p className="text-sm text-alert-warning">
              If you disconnect without saving your recovery phrase, you'll lose access to:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-alert-warning/80">
              {uploadCount > 0 && (
                <li>
                  &bull; {uploadCount} uploaded file{uploadCount !== 1 ? 's' : ''}
                </li>
              )}
              <li>&bull; Any credits in this wallet</li>
              <li>&bull; This wallet address permanently</li>
            </ul>
          </div>

          {/* Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => setShowSeedModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-fg-muted text-canvas font-semibold hover:bg-fg-muted/90 transition-colors"
            >
              <Key className="w-4 h-4" />
              Export Recovery Phrase
            </button>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-lg border border-default text-link hover:bg-surface hover:text-fg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onDisconnect}
                className="flex-1 py-3 px-4 rounded-lg border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Disconnect Anyway
              </button>
            </div>
          </div>
        </div>
      </BaseModal>

      {/* Seed Phrase Modal */}
      {showSeedModal && (
        <SeedPhraseModal
          onClose={() => setShowSeedModal(false)}
          onExported={() => {
            setShowSeedModal(false);
            // After exporting, user can safely disconnect
          }}
        />
      )}
    </>
  );
}
