import { Wallet, ExternalLink, Link2, Unlink } from 'lucide-react';
import { formatWalletAddress } from '../../utils';
import { getExplorerAddressUrl } from '../../utils/getExplorerAddressUrl';
import CopyButton from '../CopyButton';

const WALLET_LABELS: Record<string, string> = {
  arweave: 'Arweave',
  ethereum: 'Ethereum',
  solana: 'Solana',
};

interface WalletIdentityCardProps {
  address: string;
  walletType: string | null;
  /** Linked-wallet (Solana-for-ArNS) state, folded into this card. */
  isPrimarySolana: boolean;
  linkedAddress?: string | null;
  linkedWalletName?: string | null;
  isSolanaConnected: boolean;
  onLink: () => void;
  onUnlink: () => void;
}

/**
 * The wallet-identity card: who you're signed in as, plus the linked Solana wallet
 * used for ArNS updates (shown only when the primary wallet isn't already Solana).
 */
export default function WalletIdentityCard({
  address,
  walletType,
  isPrimarySolana,
  linkedAddress,
  linkedWalletName,
  isSolanaConnected,
  onLink,
  onUnlink,
}: WalletIdentityCardProps) {
  if (!address || !walletType) return null;

  const explorerUrl = getExplorerAddressUrl(address, walletType);
  const walletLabel = WALLET_LABELS[walletType] ?? walletType;

  return (
    <div className="rounded-2xl border border-border/20 bg-card p-4 sm:p-6">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/20 bg-foreground/20">
          <Wallet className="h-5 w-5 text-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground">Wallet</h3>
          <p className="text-sm text-foreground/80">The account you’re signed in as</p>
        </div>
      </div>

      {/* Address */}
      <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
        <span className="flex-shrink-0 text-foreground/60">Address</span>
        <span className="flex min-w-0 items-center gap-2 text-foreground">
          <span className="truncate font-mono text-xs" title={address}>
            {formatWalletAddress(address, 6)}
          </span>
          <CopyButton textToCopy={address} />
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View address on block explorer"
              className="inline-flex flex-shrink-0 items-center gap-1 text-primary hover:underline"
            >
              <span className="hidden sm:inline">Explorer</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </span>
      </div>

      {/* Network / ecosystem */}
      <div className="flex items-center justify-between gap-3 border-t border-border/20 py-2.5 text-sm">
        <span className="flex-shrink-0 text-foreground/60">Network</span>
        <span className="inline-flex items-center rounded-full border border-border/20 bg-background px-2.5 py-1 text-xs font-medium text-foreground/80">
          {walletLabel}
        </span>
      </div>

      {/* Linked Solana wallet (for ArNS) — only when the primary isn't Solana */}
      {!isPrimarySolana && (
        <div className="border-t border-border/20 pt-3">
          <div className="mb-2 text-xs text-foreground/60">Linked wallet</div>
          {linkedAddress ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
                  <Link2 className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {linkedWalletName || 'Solana Wallet'}{' '}
                    <span className="text-xs text-foreground/60">(ArNS)</span>
                  </div>
                  <div className="font-mono text-xs text-foreground/60">
                    {formatWalletAddress(linkedAddress, 6)}
                  </div>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-3">
                {isSolanaConnected ? (
                  <span className="text-xs text-success">Connected</span>
                ) : (
                  <button onClick={onLink} className="text-xs text-primary hover:underline">
                    Reconnect
                  </button>
                )}
                <button
                  onClick={onLink}
                  className="text-xs text-foreground/60 transition-colors hover:text-foreground"
                >
                  Change
                </button>
                <button
                  onClick={onUnlink}
                  className="p-1 text-foreground/40 transition-colors hover:text-error"
                  title="Unlink wallet"
                  aria-label="Unlink Solana wallet"
                >
                  <Unlink className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-foreground/80">
                Link a Solana wallet to manage ArNS domains
              </span>
              <button
                onClick={onLink}
                className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90"
              >
                <Link2 className="h-3.5 w-3.5" />
                Link wallet
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
