import { X, Loader2 } from 'lucide-react';
import BaseModal from './BaseModal';
import { useLinkedSolanaWallet } from '../../hooks/useLinkedSolanaWallet';

interface LinkSolanaWalletModalProps {
  onClose: () => void;
  isReconnect?: boolean;
}

export default function LinkSolanaWalletModal({ onClose, isReconnect = false }: LinkSolanaWalletModalProps) {
  const { solanaWallets, linkWallet, isLinking } = useLinkedSolanaWallet();

  const installedWallets = solanaWallets.filter(
    (w) => w.readyState === 'Installed' && !w.adapter.name.toLowerCase().includes('metamask')
  );

  return (
    <BaseModal onClose={onClose} showCloseButton={false}>
      <div className="flex flex-col text-foreground p-6 sm:p-8" style={{ minWidth: 'min(85vw, 400px)', maxWidth: '95vw' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-heading font-bold text-foreground">
              {isReconnect ? 'Reconnect Solana Wallet' : 'Link Solana Wallet'}
            </h3>
            <p className="text-sm text-foreground/80 mt-1">
              {isReconnect
                ? 'Reconnect to sign ArNS transactions'
                : 'Connect a Solana wallet to manage your ArNS domains'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-card rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wallet list */}
        <div className="flex flex-col gap-3">
          {installedWallets.length > 0 ? (
            installedWallets.map((w) => (
              <button
                key={w.adapter.name}
                disabled={isLinking}
                className="w-full bg-card border border-border/20 p-4 rounded-2xl hover:border-primary/50 hover:bg-card/80 transition-all text-left flex items-center gap-3 group disabled:opacity-50"
                onClick={() => linkWallet(w.adapter.name)}
              >
                <img
                  src={w.adapter.icon}
                  alt={w.adapter.name}
                  className="w-8 h-8 flex-shrink-0 rounded-lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-base">{w.adapter.name}</div>
                  <div className="text-xs text-foreground/70">Solana wallet</div>
                </div>
                {isLinking && (
                  <Loader2 className="w-4 h-4 animate-spin text-foreground/60" />
                )}
              </button>
            ))
          ) : (
            <div className="text-center py-6 text-sm text-foreground/60">
              <p className="mb-3">No Solana wallets detected</p>
              <div className="flex justify-center gap-4">
                <a
                  href="https://phantom.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Install Phantom
                </a>
                <a
                  href="https://solflare.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Install Solflare
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </BaseModal>
  );
}
