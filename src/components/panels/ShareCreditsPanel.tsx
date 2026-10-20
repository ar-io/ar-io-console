import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TurboFactory,
  TurboAuthenticatedClient,
  ArconnectSigner
} from '@ardrive/turbo-sdk/web';
import { useStore } from '../../store/useStore';
import { wincPerCredit } from '../../constants';
import { useTurboConfig } from '../../hooks/useTurboConfig';
import { ExternalLink, Shield, ArrowRight, Share2, Book, Lightbulb, Code, CheckCircle, Wallet } from 'lucide-react';
import { promptSignIn, getTurboBalance } from '../../utils';
import { toShareableBalance, toApprovedWinc, wincToCredits } from '../../utils/shareableCredits';
import { useWincForOneGiB } from '../../hooks/useWincForOneGiB';
import { validateWalletAddress, getWalletTypeLabel } from '../../utils/addressValidation';
import { useEthereumTurboClient } from '../../hooks/useEthereumTurboClient';
import { useWallet } from '@solana/wallet-adapter-react';
import { buttonClass } from '@/components/button';

// Rounded down so a figure the user copies back into the form never exceeds
// what can actually be shared.
const floorTo4 = (credits: number) => (Math.floor(credits * 10_000) / 10_000).toFixed(4);

interface Approval {
  approvedAddress: string;
  approvedWincAmount: string;
  expirationDate?: string;
}

export default function ShareCreditsPanel() {
  const { address, walletType, configMode } = useStore();
  const paymentAvailable = useStore((s) => s.isPaymentServiceAvailable());
  const wincForOneGiB = useWincForOneGiB();
  const turboConfig = useTurboConfig();
  const { createEthereumTurboClient } = useEthereumTurboClient();
  const { publicKey: solanaPublicKey, signMessage: solanaSignMessage, signTransaction: solanaSignTransaction } = useWallet();

  // Create authenticated turbo client based on wallet type
  const createTurboClient = async (): Promise<TurboAuthenticatedClient> => {
    if (!address || !walletType) {
      throw new Error('Wallet not connected');
    }

    switch (walletType) {
      case 'arweave':
        if (!window.arweaveWallet) {
          throw new Error('Wander wallet extension not found. Please install from https://wander.app');
        }
        const signer = new ArconnectSigner(window.arweaveWallet);
        return TurboFactory.authenticated({
          ...turboConfig,
          signer
        });

      case 'ethereum':
        // Use the shared Ethereum Turbo client with custom connect message
        return createEthereumTurboClient('ethereum');

      case 'solana':
        if (!solanaPublicKey || !solanaSignMessage) {
          throw new Error('Solana wallet not connected. Please reconnect your Solana wallet.');
        }

        return TurboFactory.authenticated({
          token: "solana",
          walletAdapter: { publicKey: solanaPublicKey, signMessage: solanaSignMessage, signTransaction: solanaSignTransaction! },
          ...turboConfig,
        });

      default:
        throw new Error(`Unsupported wallet type: ${walletType}`);
    }
  };
  const [creditAmount, setCreditAmount] = useState(1);
  const [creditAmountInput, setCreditAmountInput] = useState('1');
  const [approvedAddress, setApprovedAddress] = useState('');
  const [approvedAddressInput, setApprovedAddressInput] = useState('');
  const [recipientWalletType, setRecipientWalletType] = useState<'arweave' | 'ethereum' | 'solana' | 'unknown' | null>(null);
  const [expiresBySeconds, setExpiresBySeconds] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Revoke state
  const [revokeAddress, setRevokeAddress] = useState('');
  const [revoking, setRevoking] = useState(false);

  /*
    Fetched here rather than read from the store's `creditBalance`, which is
    `effectiveBalance`: it includes credits other wallets shared with this one,
    which can be spent but not re-shared. Reading it offered more than the
    service would approve. The 'credit-balance' prefix keeps this query in the
    set that `refresh-balance` invalidates.
  */
  const { data: shareBalance, isLoading: balanceLoading } = useQuery({
    queryKey: ['credit-balance', 'shareable', address, walletType, configMode],
    enabled: !!address && !!walletType && paymentAvailable,
    staleTime: 30_000,
    queryFn: async () => toShareableBalance(await getTurboBalance(address!, walletType!)),
  });
  const shareableWinc = shareBalance?.shareableWinc ?? 0n;
  const shareableCredits = wincToCredits(shareableWinc);
  const receivedCredits = wincToCredits(shareBalance?.receivedWinc ?? 0n);
  const sharedOutCredits = wincToCredits(shareBalance?.sharedOutWinc ?? 0n);

  // The amount of the share that just succeeded; the form resets to 0 before
  // the success message renders, so it can't read `creditAmount`.
  const [sharedAmount, setSharedAmount] = useState(0);

  const handleShare = async () => {
    if (!address || !approvedAddress || creditAmount < 0.01) {
      setError('Please fill in all required fields (minimum 0.01 credits)');
      return;
    }

    setSending(true);
    setError('');
    
    try {
      const turbo = await createTurboClient();
      const approvedWincAmount = toApprovedWinc(creditAmount, shareableWinc).toString();
      
      await turbo.shareCredits({
        approvedAddress,
        approvedWincAmount,
        expiresBySeconds: expiresBySeconds > 0 ? expiresBySeconds : undefined,
      });
      
      setSharedAmount(creditAmount);
      setSuccess(true);

      // Refresh balance in header
      window.dispatchEvent(new CustomEvent('refresh-balance'));

      // Clear form
      setApprovedAddress('');
      setApprovedAddressInput('');
      setRecipientWalletType(null);
      setCreditAmount(0);
      setCreditAmountInput('0');
      setExpiresBySeconds(0);
      
      setTimeout(() => {
        setSuccess(false);
      }, 10000);
    } catch (err) {
      console.error('Share credits error details:', err);
      console.error('Error type:', typeof err);
      console.error('Error constructor:', err?.constructor?.name);
      if (err instanceof Error) {
        console.error('Error message:', err.message);
        console.error('Error stack:', err.stack);
      }
      setError(err instanceof Error ? err.message : 'Failed to share credits');
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async () => {
    if (!address || !revokeAddress) {
      setError('Please enter an address to revoke');
      return;
    }

    setRevoking(true);
    setError('');
    
    try {
      const turbo = await createTurboClient();
      await turbo.revokeCredits({ revokedAddress: revokeAddress });
      
      // Refresh balance in header
      window.dispatchEvent(new CustomEvent('refresh-balance'));
      
      setRevokeAddress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke credits');
    } finally {
      setRevoking(false);
    }
  };

  if (!address) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-heading font-extrabold mb-3">Sign in required</h3>
        <p className="text-foreground/80 mb-5">Sign in to share credits with another wallet.</p>
        <button
          onClick={promptSignIn}
          className={buttonClass('primary', 'lg')}
        >
          <Wallet className="w-4 h-4" /> Sign in to share credits
        </button>
      </div>
    );
  }

  const givenApprovals: Approval[] = [];

  return (
    <div className="px-4 sm:px-6">
      {/* Inline Header with Description */}
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 bg-primary/20 rounded-2xl flex items-center justify-center flex-shrink-0 mt-1 border border-border/20">
          <Share2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-2xl font-heading font-extrabold text-foreground mb-1">Share Credits</h3>
          <p className="text-sm text-foreground/80">
            Delegate credits to other wallets for collaborative uploads and distributed payments
          </p>
        </div>
      </div>

      {/* Main Content Container with Gradient */}
      <div className="bg-card rounded-2xl border border-border/20 p-4 sm:p-6 mb-4 sm:mb-6">
      
      {/* Current Balance */}
      {paymentAvailable && (
        <div className="bg-card rounded-2xl p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-foreground/80">Available to Share:</span>
            <div className="text-right">
              <span className="font-bold text-foreground">
                {balanceLoading ? '…' : floorTo4(shareableCredits)} Credits
              </span>
              {!balanceLoading && wincForOneGiB && (
                <div className="text-xs text-foreground/80">
                  ~{((shareableCredits * wincPerCredit) / Number(wincForOneGiB)).toFixed(2)} GiB capacity
                </div>
              )}
            </div>
          </div>
          {receivedCredits > 0 && (
            <div className="flex justify-between text-sm mt-2">
              <span className="text-foreground/80">Shared with you (spendable, not shareable):</span>
              <span>{receivedCredits.toFixed(4)} Credits</span>
            </div>
          )}
          {sharedOutCredits > 0 && (
            <div className="flex justify-between text-sm mt-2">
              <span className="text-foreground/80">Already Shared:</span>
              <span>{sharedOutCredits.toFixed(4)} Credits</span>
            </div>
          )}
        </div>
      )}

      {/* Share Form */}
      <div className="space-y-6">
        {/* Credits and Recipient on same row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-3">Credits to Share</label>
            <input
              type="text"
              value={creditAmountInput}
              onChange={(e) => {
                const inputValue = e.target.value;
                setCreditAmountInput(inputValue);
                
                // Parse the numeric value
                const amount = Number(inputValue);
                if (!isNaN(amount) && amount >= 0) {
                  setCreditAmount(amount);
                }
              }}
              onBlur={() => {
                // Clean up on blur
                let finalAmount = creditAmount;
                if (creditAmount < 0.01) {
                  finalAmount = 0.01;
                } else if (creditAmount > shareableCredits) {
                  finalAmount = shareableCredits;
                }
                setCreditAmount(finalAmount);
                setCreditAmountInput(String(finalAmount));
              }}
              className="w-full p-3 rounded-2xl border border-border/20 bg-card text-foreground focus:border-foreground transition-colors"
              placeholder="Minimum 0.01 credits"
              inputMode="decimal"
            />
            {creditAmount >= 0.01 && wincForOneGiB && (
              <div className="mt-2 text-xs text-foreground/80">
                ~{((creditAmount * wincPerCredit) / Number(wincForOneGiB)).toFixed(2)} GiB storage
              </div>
            )}
            {creditAmount > 0 && creditAmount < 0.01 && (
              <div className="mt-2 text-xs text-warning">
                Minimum share amount is 0.01 credits
              </div>
            )}
            {!balanceLoading && creditAmount > shareableCredits && (
              <div className="mt-2 text-xs text-error">
                Exceeds the {floorTo4(shareableCredits)} credits you can share
                {receivedCredits > 0 && ' (credits shared with you can’t be re-shared)'}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-3">Recipient Wallet Address</label>
            <input
              type="text"
              value={approvedAddressInput}
              onChange={(e) => {
                setApprovedAddressInput(e.target.value);
                // Clear validation state on change
                if (approvedAddress) {
                  setApprovedAddress('');
                  setRecipientWalletType(null);
                }
              }}
              onBlur={() => {
                const trimmed = approvedAddressInput.trim();
                if (trimmed) {
                  const validation = validateWalletAddress(trimmed);
                  if (validation.isValid && validation.type !== 'unknown') {
                    setApprovedAddress(trimmed);
                    setRecipientWalletType(validation.type);
                  } else {
                    setRecipientWalletType('unknown');
                  }
                } else {
                  setApprovedAddress('');
                  setRecipientWalletType(null);
                }
              }}
              className="w-full p-3 rounded-2xl border border-border/20 bg-card text-foreground font-mono text-sm focus:border-foreground transition-colors"
              placeholder="Arweave, Ethereum, or Solana address"
            />
            {recipientWalletType && recipientWalletType !== 'unknown' && (
              <div className="mt-2 text-xs text-success flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Valid {getWalletTypeLabel(recipientWalletType)} address
              </div>
            )}
            {recipientWalletType === 'unknown' && (
              <div className="mt-2 text-xs text-error">
                Invalid wallet address format
              </div>
            )}
            {!recipientWalletType && (
              <div className="mt-2 text-xs text-foreground/80">
                e.g., 1seRanklLU_1VTGkEk7P0x...
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-3">Expiration (Optional)</label>
          <div className="grid grid-cols-4 gap-2 mb-3">
            <button
              onClick={() => setExpiresBySeconds(3600)}
              className={`py-2 px-3 rounded-2xl border text-sm transition-all ${
                expiresBySeconds === 3600
                  ? 'border-foreground bg-foreground/10 text-foreground'
                  : 'border-border/20 text-foreground/80 hover:bg-card hover:text-foreground'
              }`}
            >
              1 hour
            </button>
            <button
              onClick={() => setExpiresBySeconds(86400)}
              className={`py-2 px-3 rounded-2xl border text-sm transition-all ${
                expiresBySeconds === 86400
                  ? 'border-foreground bg-foreground/10 text-foreground'
                  : 'border-border/20 text-foreground/80 hover:bg-card hover:text-foreground'
              }`}
            >
              1 day
            </button>
            <button
              onClick={() => setExpiresBySeconds(604800)}
              className={`py-2 px-3 rounded-2xl border text-sm transition-all ${
                expiresBySeconds === 604800
                  ? 'border-foreground bg-foreground/10 text-foreground'
                  : 'border-border/20 text-foreground/80 hover:bg-card hover:text-foreground'
              }`}
            >
              1 week
            </button>
            <button
              onClick={() => setExpiresBySeconds(0)}
              className={`py-2 px-3 rounded-2xl border text-sm transition-all ${
                expiresBySeconds === 0
                  ? 'border-foreground bg-foreground/10 text-foreground'
                  : 'border-border/20 text-foreground/80 hover:bg-card hover:text-foreground'
              }`}
            >
              Never
            </button>
          </div>
          {expiresBySeconds > 0 && (
            <input
              type="number"
              value={expiresBySeconds}
              onChange={(e) => setExpiresBySeconds(Math.max(0, Number(e.target.value)))}
              className="w-full p-3 rounded-2xl border border-border/20 bg-card text-foreground focus:border-foreground transition-colors"
              placeholder="Custom time in seconds"
              min="1"
            />
          )}
          {expiresBySeconds > 0 && (
            <p className="text-xs text-foreground/80 mt-1">
              Expires in {expiresBySeconds < 3600
                ? `${expiresBySeconds} seconds`
                : expiresBySeconds < 86400
                ? `${(expiresBySeconds / 3600).toFixed(1)} hours`
                : `${(expiresBySeconds / 86400).toFixed(1)} days`
              }
            </p>
          )}
        </div>

        {error && (
          <div className="text-error text-sm p-3 bg-error/10 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="text-success text-sm p-4 bg-success/10 rounded-2xl border border-success/20">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4" />
              <span className="font-medium">Credits shared successfully!</span>
            </div>
            <p className="text-xs text-foreground/80">
              {sharedAmount} credits are now available for the recipient to use. Your balance has been updated.
            </p>
          </div>
        )}

        <button
          onClick={handleShare}
          disabled={sending || !address || balanceLoading || creditAmount < 0.01 || creditAmount > shareableCredits || !approvedAddress}
          className={`${buttonClass('primary', 'xl')} w-full`}
        >
          {sending ? (
            <>
              <ArrowRight className="w-5 h-5 animate-pulse" />
              Sharing Credits...
            </>
          ) : (
            <>
              <Share2 className="w-5 h-5" />
              Share Credits
            </>
          )}
        </button>
      </div>
      </div>

      {/* Active Approvals */}
      {givenApprovals.length > 0 && (
        <div className="mt-8 pt-8 border-t border-border/20">
          <h4 className="mb-4">Active Approvals</h4>
          <div className="space-y-3">
            {givenApprovals.map((approval: Approval) => (
              <div key={approval.approvedAddress} className="bg-card rounded-2xl p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono text-sm">{approval.approvedAddress}</p>
                    <p className="text-sm text-foreground/80">
                      {(+approval.approvedWincAmount / wincPerCredit).toFixed(4)} Credits
                      {approval.expirationDate && (
                        <span className="ml-2">
                          • Expires {new Date(approval.expirationDate).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => setRevokeAddress(approval.approvedAddress)}
                    className="text-error hover:text-error/80 text-sm"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Revoke Form */}
          {revokeAddress && (
            <div className="mt-4 p-4 bg-card rounded-2xl">
              <p className="text-sm mb-3">Revoke credits from: {revokeAddress}</p>
              <div className="flex gap-3">
                <button
                  onClick={handleRevoke}
                  disabled={revoking}
                  className={buttonClass('danger', 'sm')}
                >
                  {revoking ? 'Revoking...' : 'Confirm Revoke'}
                </button>
                <button
                  onClick={() => setRevokeAddress('')}
                  className={buttonClass('secondary', 'sm')}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resource Links */}
      <div className="mt-8">
        <h4 className="mb-4">Learn More</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Documentation */}
          <a
            href="https://docs.ardrive.io/docs/turbo/credit-sharing.html"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-card rounded-2xl p-4 hover:bg-card/80 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <Book className="w-5 h-5 text-foreground" />
              <span className="font-medium">Documentation</span>
            </div>
            <p className="text-xs text-foreground/80">
              Complete guide to credit sharing features and API
            </p>
            <div className="flex items-center gap-1 mt-2 text-xs text-foreground/80 group-hover:text-foreground">
              <span>Read guide</span>
              <ExternalLink className="w-3 h-3" />
            </div>
          </a>

          {/* Use Cases */}
          <a
            href="https://docs.ardrive.io/docs/turbo/credit-sharing.html#use-cases"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-card rounded-2xl p-4 hover:bg-card/80 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <Lightbulb className="w-5 h-5 text-foreground" />
              <span className="font-medium">Use Cases</span>
            </div>
            <p className="text-xs text-foreground/80">
              Examples and scenarios for credit sharing
            </p>
            <div className="flex items-center gap-1 mt-2 text-xs text-foreground/80 group-hover:text-foreground">
              <span>View examples</span>
              <ExternalLink className="w-3 h-3" />
            </div>
          </a>

          {/* SDK Reference */}
          <a
            href="https://github.com/ardriveapp/turbo-sdk?tab=readme-ov-file#sharecredits-approvedaddress-approvedwincamount-expiresbyseconds-"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-card rounded-2xl p-4 hover:bg-card/80 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <Code className="w-5 h-5 text-foreground" />
              <span className="font-medium">SDK Reference</span>
            </div>
            <p className="text-xs text-foreground/80">
              Technical implementation details on GitHub
            </p>
            <div className="flex items-center gap-1 mt-2 text-xs text-foreground/80 group-hover:text-foreground">
              <span>View code</span>
              <ExternalLink className="w-3 h-3" />
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}