import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { ExternalLink, Coins, Calculator, RefreshCw, Wallet, CreditCard, Upload, Camera, Share2, Globe, Code, Search, Grid3x3, Zap, User, Key, Settings, Server, Compass, PencilLine, LayoutTemplate, Unlink, Flame } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useDisconnect } from 'wagmi';
import { useWallet } from '@solana/wallet-adapter-react';
import CopyButton from './CopyButton';
import DomainsNavFlyout from '@/components/DomainsNavFlyout';
import { useStore } from '../store/useStore';
import { formatWalletAddress } from '../utils';
import { getWalletNetworkLabel } from '../utils/walletDisplay';
import ArioLogo from './ArioLogo';
import WalletSelectionModal from './modals/WalletSelectionModal';
import { usePrimaryArNSName } from '../hooks/usePrimaryArNSName';
import { useNavigate } from 'react-router-dom';
import { usePrivyWallet } from '../hooks/usePrivyWallet';
import { usePrivy } from '@privy-io/react-auth';
import { useWincForOneGiB } from '../hooks/useWincForOneGiB';
import { useCreditBalance } from '../hooks/useCreditBalance';
import { clearEthereumTurboClientCache } from '../hooks/useEthereumTurboClient';
import { clearX402SignerCache } from '../hooks/useX402Upload';

// Services for logged-in users
const accountServices = [
  { name: 'Buy Credits', page: 'topup' as const, icon: CreditCard },
  { name: 'Upload Files', page: 'upload' as const, icon: Upload },
  { name: 'Capture Page', page: 'capture' as const, icon: Camera },
  { name: 'Deploy Site', page: 'deploy' as const, icon: Zap },
  { name: 'Create Page', page: 'pages' as const, icon: LayoutTemplate },
  { name: 'Share Credits', page: 'share' as const, icon: Share2 },
  // DEPRECATED: Gifting feature disabled
  // { name: 'Redeem Gift', page: 'redeem' as const, icon: Ticket },
  // { name: 'Send Gift', page: 'gift' as const, icon: Gift },
];

// Public utility services
const utilityServices = [
  { name: 'Pricing', page: 'pricing' as const, icon: Calculator },
  { name: 'Check Balance', page: 'balances' as const, icon: Search },
  { name: 'Browse Data', page: 'browse' as const, icon: Compass },
  { name: 'Network Dashboard', href: 'https://gateways.ar.io', icon: Server, external: true },
  { name: 'Developer Docs', href: 'https://docs.ar.io', icon: Code, external: true },
];

// ArNS / domain actions — grouped into a single labeled "Domains" cluster in the
// mega-menu. None are payment-gated routes, so no x402/payment filtering applies.
const domainServices = [
  { name: 'Register a Name', page: 'arns' as const, icon: Globe },
  { name: 'Browse Domains', page: 'domains' as const, icon: Search },
  { name: 'Returned Names', page: 'returned-names' as const, icon: Flame },
  { name: 'Manage Domains', page: 'my-domains' as const, icon: PencilLine },
];

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { address, walletType, clearAddress, clearAllPaymentState, configMode, isPaymentServiceAvailable, linkedSolanaAddress, clearLinkedSolanaWallet } = useStore();
  const { isPrivyUser, privyLogout } = usePrivyWallet();
  const { exportWallet } = usePrivy();
  const { disconnectAsync } = useDisconnect(); // RainbowKit/Wagmi disconnect
  const { disconnect: solanaDisconnect } = useWallet(); // Solana wallet adapter disconnect
  const arnsAddress = useStore((s) => s.getArNSAddress());
  const { arnsName, profile, loading: loadingArNS } = usePrimaryArNSName(arnsAddress);

  const [showWalletModal, setShowWalletModal] = useState(false);
  const wincForOneGiB = useWincForOneGiB();
  const { credits: creditsNumeric, isLoading: loadingBalance, isFetching: isRefreshing, refetch: handleRefresh } = useCreditBalance();

  // Any CTA anywhere can open the sign-in (wallet) modal by dispatching
  // `open-signin` (see promptSignIn in utils). The Header owns the one modal.
  // Guard on address so a stray event can't stack the connect modal over a
  // live session.
  useEffect(() => {
    const handleOpenSignIn = () => {
      if (!useStore.getState().address) setShowWalletModal(true);
    };
    window.addEventListener('open-signin', handleOpenSignIn);
    return () => window.removeEventListener('open-signin', handleOpenSignIn);
  }, []);

  // Format credits for display
  const formatCredits = (amount: number): string => {
    if (amount >= 1) {
      return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    } else if (amount >= 0.01) {
      return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(amount);
    } else if (amount > 0) {
      return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(amount);
    }
    return '0';
  };
  const credits = formatCredits(creditsNumeric);

  // Calculate storage capacity from credits
  const formatStorageCapacity = (credits: number): string => {
    if (!wincForOneGiB || credits === 0) return '';

    const wincPerCredit = 1e12; // 1 trillion winc = 1 credit
    const totalWinc = credits * wincPerCredit;
    const gibibytes = totalWinc / Number(wincForOneGiB);

    if (gibibytes >= 1024) {
      // Show in TiB
      return `≈ ${(gibibytes / 1024).toFixed(2)} TiB`;
    } else if (gibibytes >= 1) {
      // Show in GiB
      return `≈ ${gibibytes.toFixed(2)} GiB`;
    } else if (gibibytes > 0) {
      // Show in MiB
      return `≈ ${(gibibytes * 1024).toFixed(1)} MiB`;
    }
    return '';
  };

  // Filter services based on payment service availability (x402-only mode)
  // Payment service dependent routes: topup, share, gift, balances, redeem
  // Note: pricing is NOT included - it works in x402-only mode with USDC pricing
  const paymentServiceRoutes = ['topup', 'share', 'balances']; // 'gift' and 'redeem' deprecated
  const filteredAccountServices = accountServices.filter(service =>
    isPaymentServiceAvailable() || !paymentServiceRoutes.includes(service.page)
  );
  const filteredUtilityServices = utilityServices.filter(service => {
    // External links are always shown
    if ('external' in service && service.external) return true;
    // Internal links: check if payment service is available or not a payment route
    if ('page' in service && service.page) {
      return isPaymentServiceAvailable() || !paymentServiceRoutes.includes(service.page);
    }
    return true;
  });

  return (
    <div className="flex items-center py-2 sm:py-3">
      <Link to="/" className="cursor-pointer ml-2 sm:ml-0">
        <ArioLogo />
      </Link>

      {/* Dev Mode Indicator */}
      {configMode !== 'production' && (
        <div className="ml-4 flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <span className="text-xs text-primary font-medium uppercase">
            {configMode === 'development' ? 'TESTNET' : configMode} MODE
          </span>
        </div>
      )}

      <div className="grow" />

      {/* Clean Services Waffle Popover */}
      <div className="mr-3">
        <Popover className="relative">
          <PopoverButton className="flex items-center p-3 text-foreground/60 hover:text-foreground transition-colors" title="All Services">
            <Grid3x3 className="w-6 h-6" />
          </PopoverButton>

          <PopoverPanel className="absolute right-1 sm:right-0 mt-2 w-56 sm:w-64 overflow-auto rounded-2xl bg-background border border-border/20 shadow-lg z-50 py-1">
            {({ close }) => (
              <>
                {/* Services — reachable without login; each flow prompts to connect a wallet at the action */}
                <div className="px-4 py-2">
                  <span className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">Services</span>
                </div>
                {filteredAccountServices.map((service) => {
                  const isActive = location.pathname === `/${service.page}`;

                  // Every service is reachable without login: the panels render and
                  // preview locally, and each flow prompts to connect a wallet at the
                  // action (pay / upload / deploy / sign). Navigation only — this never
                  // triggers signing. Sign-in stays on the header button + wallet modal.
                  return (
                    <Link
                      key={service.page}
                      to={`/${service.page}`}
                      onClick={() => close()}
                      className={`flex items-center gap-3 py-2 px-4 text-sm transition-colors ${
                        isActive
                          ? 'bg-primary/15 text-foreground font-medium'
                          : 'text-foreground/80 hover:bg-primary/10 hover:text-foreground'
                      }`}
                    >
                      <service.icon className={`w-4 h-4 ${
                        isActive ? 'text-primary' : 'text-foreground/60'
                      }`} />
                      {service.name}
                    </Link>
                  );
                })}
                <div className="border-t border-border/20 my-1" />

                {/* Domains — ArNS actions collapsed into a second-level flyout
                    (the flat list had grown long enough to dominate the panel) */}
                <DomainsNavFlyout
                  items={domainServices}
                  currentPath={location.pathname}
                  onNavigate={close}
                />
                <div className="border-t border-border/20 my-1" />

                {/* Public Tools */}
                <div className="px-4 py-2 text-xs font-semibold text-foreground/60 uppercase tracking-wider">Tools</div>
                {filteredUtilityServices.map((service) => {
                  // Handle external links
                  if ('external' in service && service.external && 'href' in service) {
                    return (
                      <a
                        key={service.href}
                        href={service.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => close()}
                        className="flex items-center gap-3 py-2 px-4 text-sm transition-colors text-foreground/80 hover:bg-primary/10 hover:text-foreground"
                      >
                        <service.icon className="w-4 h-4 text-foreground/60" />
                        <span className="flex-1">{service.name}</span>
                        <ExternalLink className="w-3 h-3 text-foreground/40" />
                      </a>
                    );
                  }

                  // Handle internal links
                  const isActive = 'page' in service && location.pathname === `/${service.page}`;
                  return (
                    <Link
                      key={'page' in service ? service.page : service.name}
                      to={`/${'page' in service ? service.page : ''}`}
                      onClick={() => close()}
                      className={`flex items-center gap-3 py-2 px-4 text-sm transition-colors ${
                        isActive
                          ? 'bg-primary/15 text-foreground font-medium'
                          : 'text-foreground/80 hover:bg-primary/10 hover:text-foreground'
                      }`}
                    >
                      <service.icon className={`w-4 h-4 ${
                        isActive ? 'text-primary' : 'text-foreground/60'
                      }`} />
                      {service.name}
                    </Link>
                  );
                })}

                {/* Settings - always accessible, even without login */}
                <div className="border-t border-border/20 my-1" />
                <Link
                  to="/settings"
                  onClick={() => close()}
                  className={`flex items-center gap-3 py-2 px-4 text-sm transition-colors ${
                    location.pathname === '/settings'
                      ? 'bg-primary/15 text-foreground font-medium'
                      : 'text-foreground/80 hover:bg-primary/10 hover:text-foreground'
                  }`}
                >
                  <Settings className={`w-4 h-4 ${
                    location.pathname === '/settings' ? 'text-primary' : 'text-foreground/60'
                  }`} />
                  Settings
                </Link>
              </>
            )}
          </PopoverPanel>
        </Popover>
      </div>

      {/* Profile Dropdown - only for logged in users */}
      {address && (
        <Popover className="relative">
          <PopoverButton className="flex items-center gap-2 rounded-full border border-border/20 px-3 py-2 font-semibold hover:bg-card hover:border-foreground/30 transition-colors">
            {/* Profile Image or Wallet Type Indicator */}
            {profile.logo ? (
              <div className="size-8 rounded-full overflow-hidden bg-card border border-border/20 flex items-center justify-center">
                <img
                  src={profile.logo}
                  alt={`${profile.name} logo`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Hide the image and show the fallback
                    const target = e.target as HTMLImageElement;
                    const container = target.parentElement;
                    if (container) {
                      target.style.display = 'none';
                      const fallback = container.querySelector('.fallback-indicator') as HTMLElement;
                      if (fallback) {
                        fallback.style.display = 'block';
                      }
                    }
                  }}
                />
                <div className={`fallback-indicator hidden size-2 rounded-full ${
                  walletType === 'arweave' ? 'bg-primary' :
                  walletType === 'ethereum' ? 'bg-info' :
                  walletType === 'solana' ? 'bg-purple-500' :
                  'bg-success'
                }`} />
              </div>
            ) : (
              <div className={`size-2 rounded-full ${
                walletType === 'arweave' ? 'bg-primary' :
                walletType === 'ethereum' ? 'bg-info' :
                walletType === 'solana' ? 'bg-purple-500' :
                'bg-success'
              }`} />
            )}
            <div className="text-foreground flex items-center gap-1">
              {loadingArNS ? (
                <span className="text-foreground/60">Loading...</span>
              ) : arnsName ? (
                <span className="font-medium">{arnsName}</span>
              ) : (
                formatWalletAddress(address)
              )}
            </div>
          </PopoverButton>

          <PopoverPanel className="absolute right-1 sm:right-0 mt-4 flex flex-col rounded-2xl bg-background text-left text-sm text-foreground shadow-lg border border-border/20 min-w-[280px] z-50">
            {({ close }) => (
              <>
            {/* Account Info Section */}
            <div className="px-6 py-4 border-b border-border/20">
              <div className="text-xs text-foreground/60 mb-2">
                {walletType && `${getWalletNetworkLabel(walletType)} Account`}
                {walletType === 'ethereum' && isPrivyUser && ' (Privy.io)'}
              </div>
              <div className="flex items-center justify-between">
                <div className="font-bold text-base">
                  {formatWalletAddress(address, 6)}
                </div>
                <CopyButton textToCopy={address} />
              </div>
              {linkedSolanaAddress && walletType !== 'solana' && (
                <div className="mt-2 pt-2 border-t border-border/10">
                  <div className="text-[10px] text-foreground/40 mb-1">ArNS wallet</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-foreground/40">{getWalletNetworkLabel('solana')}</span>
                      <span className="font-mono text-xs text-foreground/60">{formatWalletAddress(linkedSolanaAddress, 6)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CopyButton textToCopy={linkedSolanaAddress} />
                      <button
                        onClick={(e) => { e.stopPropagation(); clearLinkedSolanaWallet(); }}
                        className="p-1 text-foreground/30 hover:text-error transition-colors"
                        title="Unlink Solana wallet"
                        aria-label="Unlink Solana wallet"
                      >
                        <Unlink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Credit Balance Section - Display Only (hide in x402-only mode) */}
            {isPaymentServiceAvailable() && (
              <div className="px-6 py-4 border-b border-border/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-foreground" />
                    <span className="text-xs text-foreground/60">Credits</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end">
                      <div className="font-bold text-lg text-foreground">
                        {loadingBalance || isRefreshing ? '...' : credits}
                      </div>
                      {!loadingBalance && !isRefreshing && creditsNumeric > 0 && (
                        <div className="text-xs text-foreground/40 mt-0.5">
                          {formatStorageCapacity(creditsNumeric)}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent triggering the parent click
                        handleRefresh();
                      }}
                      disabled={isRefreshing || loadingBalance}
                      className="p-1 rounded hover:bg-card transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={isRefreshing ? 'Refreshing...' : 'Refresh balance'}
                    >
                      <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'text-primary animate-spin' : 'text-foreground/60 hover:text-foreground'}`} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center">
              <button
                className="flex-1 flex items-center gap-2 pl-6 pr-2 py-3 text-foreground/80 hover:text-foreground hover:bg-card transition-colors"
                onClick={() => {
                  navigate('/account');
                  close();
                }}
              >
                <User className="w-4 h-4" />
                My Account
              </button>
              <button
                className="pr-6 pl-2 py-3 text-foreground/40 hover:text-foreground transition-colors"
                onClick={() => {
                  let explorerUrl = '';
                  if (walletType === 'ethereum') {
                    explorerUrl = `https://etherscan.io/address/${address}`;
                  } else if (walletType === 'solana') {
                    explorerUrl = `https://solscan.io/account/${address}`;
                  } else {
                    explorerUrl = `https://viewblock.io/arweave/address/${address}`;
                  }
                  window.open(explorerUrl, '_blank');
                }}
                title="View on Explorer"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>

            {/* Export Wallet - Show for Privy users */}
            {isPrivyUser && (
              <button
                className="flex items-center gap-2 px-6 py-3 text-foreground/80 hover:text-foreground hover:bg-card transition-colors"
                onClick={async () => {
                  try {
                    // Export the Privy wallet - this opens Privy's secure modal
                    await exportWallet();
                    close(); // Close dropdown after export modal opens
                  } catch {
                    // Failed to export wallet
                  }
                }}
              >
                <Key className="w-4 h-4" />
                Export Private Key
              </button>
            )}

            <button
              className="px-6 py-3 font-semibold text-error hover:bg-error/10 border-t border-border/20 transition-colors"
              onClick={async () => {
                try {
                  // Check if this is a Privy user and handle logout differently
                  if (isPrivyUser) {
                    await privyLogout();
                  } else {
                    // Disconnect from the actual wallet extension based on wallet type
                    if (walletType === 'arweave' && window.arweaveWallet) {
                      await window.arweaveWallet.disconnect();
                    } else if (walletType === 'ethereum') {
                      // Disconnect RainbowKit/Wagmi connection (handles MetaMask, WalletConnect, Coinbase, etc.)
                      try {
                        await disconnectAsync();
                      } catch {
                        // Wagmi disconnect failed, continue anyway
                      }
                      // Clear cached Turbo + X402 signers (gotcha #2)
                      clearEthereumTurboClientCache();
                      clearX402SignerCache();
                    } else if (walletType === 'solana') {
                      // Disconnect via wallet adapter (handles all Solana wallets)
                      try {
                        await solanaDisconnect();
                      } catch {
                        // Solana wallet disconnect failed, continue anyway
                      }
                    }
                  }
                } catch {
                  // Error disconnecting from wallet extension, continue anyway
                }

                // Always clear our app state (unless Privy already handled it)
                if (!isPrivyUser) {
                  clearAllPaymentState();
                  clearAddress();
                }
              }}
            >
              {isPrivyUser ? 'Logout' : 'Disconnect'}
            </button>
              </>
            )}
          </PopoverPanel>
        </Popover>
      )}

      {/* Sign In Button for non-logged-in users */}
      {!address && (
        <button
          onClick={() => {
            setShowWalletModal(true);
          }}
          className="flex items-center gap-2 bg-foreground text-card px-4 py-2.5 rounded-full font-semibold hover:bg-foreground/90 transition-colors mr-2 sm:mr-0"
        >
          <Wallet className="w-4 h-4" />
          Sign in
        </button>
      )}

      {/* Wallet Selection Modal */}
      {showWalletModal && (
        <WalletSelectionModal
          onClose={() => {
            setShowWalletModal(false);
          }}
        />
      )}
    </div>
  );
};

export default Header;
