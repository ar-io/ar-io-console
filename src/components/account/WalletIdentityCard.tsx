import { Wallet, Globe, ExternalLink } from 'lucide-react';
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
  /** The primary ArNS name for this identity (already resolved by the page). */
  arnsName?: string | null;
  loadingArNS?: boolean;
}

/**
 * The wallet-identity card: who you're signed in as. Flat, tokenized card that
 * pairs with the balance card at the top of the account page. Replaces the unused
 * WalletOverviewCard.
 */
export default function WalletIdentityCard({
  address,
  walletType,
  arnsName,
  loadingArNS,
}: WalletIdentityCardProps) {
  if (!address || !walletType) return null;

  const explorerUrl = getExplorerAddressUrl(address, walletType);
  const walletLabel = WALLET_LABELS[walletType] ?? walletType;

  return (
    <div className="rounded-2xl border border-border/20 bg-card p-5 sm:p-6">
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
        <span className="text-foreground/60">Address</span>
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
              className="inline-flex flex-shrink-0 items-center gap-1 text-primary hover:underline"
            >
              <span className="hidden sm:inline">Explorer</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </span>
      </div>

      {/* Wallet ecosystem */}
      <div className="flex items-center justify-between gap-3 border-t border-border/20 py-2.5 text-sm">
        <span className="text-foreground/60">Wallet</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/20 bg-background px-2.5 py-1 text-xs font-medium text-foreground/80">
          <Globe className="h-3 w-3 text-primary" />
          {walletLabel}
        </span>
      </div>

      {/* Primary ArNS name */}
      <div className="flex items-center justify-between gap-3 border-t border-border/20 py-2.5 text-sm">
        <span className="text-foreground/60">Primary name</span>
        {loadingArNS ? (
          <span className="h-4 w-24 animate-pulse rounded bg-foreground/10" />
        ) : arnsName ? (
          <a
            href={`https://${arnsName}.ar.io`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            {arnsName}
          </a>
        ) : (
          <span className="text-foreground/60">None set</span>
        )}
      </div>
    </div>
  );
}
