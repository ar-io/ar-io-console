import {
  TurboFactory,
  ArconnectSigner,
  ARToTokenAmount,
  ETHToTokenAmount,
  SOLToTokenAmount,
  POLToTokenAmount,
} from '@ardrive/turbo-sdk/web';
import { useState } from 'react';
import { Clock, RefreshCw, Wallet, AlertCircle, CheckCircle, Users, Loader2, XCircle } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import {
  tokenLabels,
  tokenNetworkLabels,
  tokenProcessingTimes,
  wincPerCredit,
  SupportedTokenType,
} from '../../../constants';
import { useWincForAnyToken, useWincForOneGiB } from '../../../hooks/useWincForOneGiB';
import useTurboWallets from '../../../hooks/useTurboWallets';
import { useWallets } from '@privy-io/react-auth';
import { getWalletTypeLabel } from '../../../utils/addressValidation';
import CopyButton from '../../CopyButton';
import { useTurboConfig } from '../../../hooks/useTurboConfig';
import { useTokenBalance } from '../../../hooks/useTokenBalance';
import { formatTokenAmount } from '../../../utils/jitPayment';
import { savePendingTopUpTx, removePendingTopUpTx } from '../../../utils/pendingTopUp';
import { useWallet } from '@solana/wallet-adapter-react';

interface CryptoConfirmationPanelProps {
  cryptoAmount: number;
  tokenType: SupportedTokenType;
  onBack: () => void;
  onPaymentComplete: (result: any) => void;
}

export default function CryptoConfirmationPanel({
  cryptoAmount,
  tokenType,
  onBack,
  onPaymentComplete,
}: CryptoConfirmationPanelProps) {
  const { address, walletType, paymentTargetAddress, paymentTargetType } = useStore();
  const { wallets } = useWallets(); // Get Privy wallets
  const { publicKey: solanaPublicKey, signMessage: solanaSignMessage, signTransaction: solanaSignTransaction } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string>();
  const [failedTxId, setFailedTxId] = useState<string>();
  const [isRetrying, setIsRetrying] = useState(false);

  const turboConfig = useStore((state) => state.getCurrentConfig());
  const turboConfigForRetry = useTurboConfig(tokenType);

  // Cross-wallet top-up: Use target address if different from connected wallet
  const turboCreditDestinationAddress =
    paymentTargetAddress && paymentTargetAddress !== address ? paymentTargetAddress : undefined;

  // Use comprehensive hook for all token types
  const { wincForToken, error: pricingError, loading: pricingLoading } = useWincForAnyToken(tokenType, cryptoAmount);
  const { data: turboWallets } = useTurboWallets();
  const wincForOneGiB = useWincForOneGiB();

  // Fetch wallet balance for the selected token (always enabled for Buy Credits)
  const {
    balance: tokenBalance,
    loading: balanceLoading,
    error: balanceError,
    isNetworkError,
  } = useTokenBalance(tokenType, walletType, address, true);

  const quote = wincForToken
    ? {
        tokenAmount: cryptoAmount,
        credits: Number(wincForToken) / wincPerCredit,
        // Calculate storage correctly using actual GiB rate
        gigabytes: wincForOneGiB ? Number(wincForToken) / Number(wincForOneGiB) : 0,
      }
    : null;

  // Calculate balance after purchase
  const balanceAfterPurchase = tokenBalance - cryptoAmount;
  // Balance validation: Block on network errors or insufficient balance, allow on other errors
  const hasSufficientBalance = balanceError && !isNetworkError ? true : !isNetworkError && tokenBalance >= cryptoAmount;

  // Get the turbo wallet address for manual payments
  const turboWalletAddress = turboWallets?.[tokenType as keyof typeof turboWallets];

  // Smart storage display - show in appropriate units
  const formatStorage = (gigabytes: number): string => {
    if (gigabytes >= 1) {
      return `${gigabytes.toFixed(2)} GiB`;
    } else if (gigabytes >= 0.001) {
      const mebibytes = gigabytes * 1024;
      return `${mebibytes.toFixed(1)} MiB`;
    } else if (gigabytes > 0) {
      const kibibytes = gigabytes * 1024 * 1024;
      return `${kibibytes.toFixed(0)} KiB`;
    } else {
      return '0 storage';
    }
  };

  // Determine if user can pay directly or needs manual payment
  const canPayDirectly =
    (walletType === 'arweave' && tokenType === 'arweave') ||
    (walletType === 'ethereum' &&
      (tokenType === 'ethereum' ||
        tokenType === 'base-eth' ||
        tokenType === 'pol' ||
        tokenType === 'usdc' ||
        tokenType === 'base-usdc' ||
        tokenType === 'polygon-usdc')) ||
    (walletType === 'solana' && tokenType === 'solana');

  const handlePayment = async () => {
    if (!address || !quote) return;

    setIsProcessing(true);
    setPaymentError(undefined);

    try {
      if (canPayDirectly) {
        // Direct payment via Turbo SDK with proper wallet support
        if (walletType === 'arweave' && window.arweaveWallet && tokenType === 'arweave') {
          const signer = new ArconnectSigner(window.arweaveWallet);
          const turbo = TurboFactory.authenticated({
            signer,
            token: tokenType,
            paymentServiceConfig: {
              url: turboConfig.paymentServiceUrl || 'https://payment.ardrive.io',
            },
            gatewayUrl: turboConfig.tokenMap[tokenType], // Dev mode uses testnet RPC URLs
          });

          const tokenAmount = ARToTokenAmount(cryptoAmount);

          const result = await turbo.topUpWithTokens({
            tokenAmount,
            turboCreditDestinationAddress,
          });

          onPaymentComplete({
            ...result,
            quote,
            tokenType,
            transactionId: result.id,
          });
        } else if (
          walletType === 'ethereum' &&
          (tokenType === 'ethereum' ||
            tokenType === 'base-eth' ||
            tokenType === 'pol' ||
            tokenType === 'usdc' ||
            tokenType === 'base-usdc' ||
            tokenType === 'polygon-usdc')
        ) {
          // ETH L1/Base ETH/POL/USDC direct payment via Ethereum wallet
          const { ethers } = await import('ethers');

          // Check if this is a Privy embedded wallet
          const privyWallet = wallets.find((w) => w.walletClientType === 'privy');

          let provider;
          let signer;

          if (privyWallet) {
            // Use Privy embedded wallet
            const privyProvider = await privyWallet.getEthereumProvider();
            provider = new ethers.BrowserProvider(privyProvider);
            signer = await provider.getSigner();
          } else if (window.ethereum) {
            // Fallback to regular Ethereum wallet (MetaMask, WalletConnect)
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
          } else {
            throw new Error('No Ethereum wallet available');
          }

          // Network validation and auto-switching
          const network = await provider.getNetwork();
          // Dev mode uses testnets: Holesky (17000) for ETH, Base Sepolia (84532) for Base, Amoy (80002) for POL
          // POL is the native token on Polygon network (like ETH on Ethereum)
          // USDC tokens use the same networks as their corresponding native tokens
          const isDevMode = turboConfig.paymentServiceUrl?.includes('.dev');
          const expectedChainId =
            tokenType === 'ethereum' || tokenType === 'usdc'
              ? isDevMode
                ? 17000
                : 1 // Holesky testnet : Ethereum mainnet
              : tokenType === 'base-eth' || tokenType === 'base-usdc'                 ? isDevMode
                  ? 84532
                  : 8453 // Base Sepolia : Base mainnet
                : tokenType === 'pol' || tokenType === 'polygon-usdc'
                  ? isDevMode
                    ? 80002
                    : 137 // Amoy testnet : Polygon mainnet
                  : 1; // Default to Ethereum mainnet

          // Auto-switch network if needed
          if (Number(network.chainId) !== expectedChainId) {
            if (privyWallet) {
              // Privy wallets use their own switchChain method
              try {
                await privyWallet.switchChain(expectedChainId);
                // Wait for switch to complete
                await new Promise((resolve) => setTimeout(resolve, 1000));

                // Re-create provider and signer after switch
                const newPrivyProvider = await privyWallet.getEthereumProvider();
                provider = new ethers.BrowserProvider(newPrivyProvider);
                signer = await provider.getSigner();
              } catch {
                const networkName =
                  tokenType === 'base-eth' || tokenType === 'base-usdc'                     ? isDevMode
                      ? 'Base Sepolia testnet'
                      : 'Base network'
                    : tokenType === 'pol' || tokenType === 'polygon-usdc'
                      ? isDevMode
                        ? 'Polygon Amoy testnet'
                        : 'Polygon Mainnet'
                      : isDevMode
                        ? 'Ethereum Holesky testnet'
                        : 'Ethereum Mainnet';
                throw new Error(`Failed to switch to ${networkName}. Please try again.`);
              }
            } else if (window.ethereum) {
              // Only attempt auto-switching for regular wallets
              if (tokenType === 'base-eth' || tokenType === 'base-usdc') {
                try {
                  await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [
                      {
                        chainId: `0x${expectedChainId.toString(16)}`,
                      },
                    ], // Dynamic: Base Sepolia (0x14A34) or Base Mainnet (0x2105)
                  });
                  await new Promise((resolve) => setTimeout(resolve, 1000));

                  // Create fresh provider after switch
                  provider = new ethers.BrowserProvider(window.ethereum);
                  signer = await provider.getSigner();
                } catch (switchError: any) {
                  // Error 4902 means the network doesn't exist in MetaMask - add it first
                  if (switchError.code === 4902) {
                    try {
                      const networkParams = isDevMode
                        ? {
                            chainId: '0x14a34', // 84532
                            chainName: 'Base Sepolia',
                            nativeCurrency: {
                              name: 'Sepolia Ether',
                              symbol: 'ETH',
                              decimals: 18,
                            },
                            rpcUrls: ['https://sepolia.base.org'],
                            blockExplorerUrls: ['https://sepolia.basescan.org'],
                          }
                        : {
                            chainId: '0x2105', // 8453
                            chainName: 'Base',
                            nativeCurrency: {
                              name: 'Ether',
                              symbol: 'ETH',
                              decimals: 18,
                            },
                            rpcUrls: ['https://mainnet.base.org'],
                            blockExplorerUrls: ['https://basescan.org'],
                          };

                      await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [networkParams],
                      });

                      // Wait for network to be added and switched
                      await new Promise((resolve) => setTimeout(resolve, 1000));

                      // Create fresh provider after adding network
                      provider = new ethers.BrowserProvider(window.ethereum);
                      signer = await provider.getSigner();
                    } catch {
                      const networkName = isDevMode ? 'Base Sepolia testnet' : 'Base Network';
                      throw new Error(`Failed to add ${networkName} to MetaMask. Please add it manually.`);
                    }
                  } else {
                    const networkName = isDevMode ? 'Base Sepolia testnet' : 'Base Network';
                    const tokenName = tokenType === 'base-usdc' ? 'USDC' : 'ETH';
                    throw new Error(`Please switch to ${networkName} in your wallet for ${tokenName} payments.`);
                  }
                }
              } else if (tokenType === 'pol' || tokenType === 'polygon-usdc') {
                // POL: Switch to Polygon network (Amoy testnet or Polygon mainnet)
                try {
                  await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [
                      {
                        chainId: `0x${expectedChainId.toString(16)}`,
                      },
                    ], // Amoy (0x13882) or Polygon Mainnet (0x89)
                  });
                  await new Promise((resolve) => setTimeout(resolve, 1000));

                  // Create fresh provider after switch
                  provider = new ethers.BrowserProvider(window.ethereum);
                  signer = await provider.getSigner();
                } catch (switchError: any) {
                  // Error 4902 means the network doesn't exist in MetaMask - add it first
                  if (switchError.code === 4902) {
                    try {
                      const networkParams = isDevMode
                        ? {
                            chainId: '0x13882', // 80002
                            chainName: 'Polygon Amoy Testnet',
                            nativeCurrency: {
                              name: 'POL',
                              symbol: 'POL',
                              decimals: 18,
                            },
                            rpcUrls: ['https://rpc-amoy.polygon.technology'],
                            blockExplorerUrls: ['https://amoy.polygonscan.com'],
                          }
                        : {
                            chainId: '0x89', // 137
                            chainName: 'Polygon Mainnet',
                            nativeCurrency: {
                              name: 'POL',
                              symbol: 'POL',
                              decimals: 18,
                            },
                            rpcUrls: ['https://polygon-rpc.com'],
                            blockExplorerUrls: ['https://polygonscan.com'],
                          };

                      await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [networkParams],
                      });

                      // Wait for network to be added and switched
                      await new Promise((resolve) => setTimeout(resolve, 1000));

                      // Create fresh provider after adding network
                      provider = new ethers.BrowserProvider(window.ethereum);
                      signer = await provider.getSigner();
                    } catch {
                      const networkName = isDevMode ? 'Polygon Amoy testnet' : 'Polygon Mainnet';
                      throw new Error(`Failed to add ${networkName} to MetaMask. Please add it manually.`);
                    }
                  } else {
                    const networkName = isDevMode ? 'Polygon Amoy testnet' : 'Polygon Mainnet';
                    const tokenName = tokenType === 'polygon-usdc' ? 'USDC' : 'POL';
                    throw new Error(`Please switch to ${networkName} in your wallet for ${tokenName} payments.`);
                  }
                }
              } else if (tokenType === 'ethereum' || tokenType === 'usdc') {
                // ETH/USDC: Switch to Ethereum network (Holesky testnet or Ethereum mainnet)
                try {
                  await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [
                      {
                        chainId: `0x${expectedChainId.toString(16)}`,
                      },
                    ], // Dynamic: Holesky (0x4268) or Ethereum Mainnet (0x1)
                  });
                  await new Promise((resolve) => setTimeout(resolve, 1000));

                  // Create fresh provider after switch
                  provider = new ethers.BrowserProvider(window.ethereum);
                  signer = await provider.getSigner();
                } catch {
                  const networkName = isDevMode ? 'Ethereum Holesky testnet' : 'Ethereum Mainnet';
                  const tokenName = tokenType === 'usdc' ? 'USDC' : 'ETH';
                  throw new Error(`Please switch to ${networkName} in your wallet for ${tokenName} payments.`);
                }
              }
            }
          }

          // ETH/Base ETH/POL payment using walletAdapter
          // POL is the native token on Polygon network
          const turboConfig_forSDK: any = {
            token: tokenType, // 'ethereum', 'base-eth', or 'pol'
            walletAdapter: {
              getSigner: () => signer as any,
            },
            paymentServiceConfig: {
              url: turboConfig.paymentServiceUrl || 'https://payment.ardrive.io',
            },
          };

          // Add gatewayUrl for all tokens EXCEPT POL mainnet (SDK defaults to https://polygon-rpc.com/ for POL)
          if (tokenType === 'pol' && !isDevMode) {
            // POL mainnet: Don't pass gatewayUrl - SDK uses https://polygon-rpc.com/ by default
            // (POL is the native token on Polygon Mainnet, like ETH on Ethereum)
          } else {
            // All other tokens: Pass their respective RPC URLs
            turboConfig_forSDK.gatewayUrl = turboConfig.tokenMap[tokenType];
          }

          const turbo = TurboFactory.authenticated(turboConfig_forSDK);

          // Convert to smallest unit (wei for ETH/Base, POL for Polygon, 6 decimals for USDC/ARIO)
          let tokenAmount;
          if (tokenType === 'pol') {
            tokenAmount = POLToTokenAmount(cryptoAmount);
          } else if (tokenType === 'usdc' || tokenType === 'base-usdc' || tokenType === 'polygon-usdc') {
            // USDC uses 6 decimals
            tokenAmount = (cryptoAmount * 1e6).toString();
          } else {
            tokenAmount = ETHToTokenAmount(cryptoAmount);
          }

          const result = await turbo.topUpWithTokens({
            tokenAmount,
            turboCreditDestinationAddress,
          });

          onPaymentComplete({
            ...result,
            quote,
            tokenType,
            transactionId: result.id,
          });
        } else if (walletType === 'solana' && solanaPublicKey && solanaSignMessage && tokenType === 'solana') {
          const turboAuthenticated = TurboFactory.authenticated({
            token: 'solana',
            paymentServiceConfig: {
              url: turboConfig.paymentServiceUrl || 'https://payment.ardrive.io',
            },
            walletAdapter: { publicKey: solanaPublicKey, signMessage: solanaSignMessage, signTransaction: solanaSignTransaction! },
            gatewayUrl: turboConfig.tokenMap.solana,
          });

          const result = await turboAuthenticated.topUpWithTokens({
            tokenAmount: SOLToTokenAmount(cryptoAmount), // Convert to lamports
            turboCreditDestinationAddress,
          });

          onPaymentComplete({
            ...result,
            quote,
            tokenType,
            transactionId: result.id,
          });
        } else {
          throw new Error('Wallet not available for direct payment');
        }
      } else {
        // Manual payment flow - user needs to send crypto manually
        onPaymentComplete({
          requiresManualPayment: true,
          quote,
          tokenType,
          turboWalletAddress,
        });
      }
    } catch (error) {
      console.error('Payment error:', error);

      // Handle SDK compatibility issues for Base ETH
      if (error instanceof Error && error.message.includes('EthereumSigner') && tokenType === 'base-eth') {
        console.log('Base ETH direct payment failed, falling back to manual payment');
        // Fall back to manual payment for Base ETH
        onPaymentComplete({
          requiresManualPayment: true,
          quote,
          tokenType,
          turboWalletAddress,
        });
        return;
      }

      // Always try to extract transaction ID from error message first.
      // This is critical: the on-chain TX may have succeeded even if the
      // backend notification failed. We must capture the TX ID for recovery
      // regardless of which error branch we enter.
      if (error instanceof Error) {
        const txIdMatch = error.message.match(/turbo\.submitFundTransaction\([^)]*\)['"]:\s*(\S+)/);
        const extractedTxId = txIdMatch?.[1] || undefined;
        if (extractedTxId) {
          setFailedTxId(extractedTxId);
          savePendingTopUpTx({
            txId: extractedTxId,
            tokenType,
            amount: cryptoAmount,
            timestamp: Date.now(),
          });
        }

        if (error.message.includes('insufficient funds') || (error as any).code === 'INSUFFICIENT_FUNDS') {
          setPaymentError(
            `Insufficient ${tokenLabels[tokenType]} balance. You need enough to cover both the payment amount and gas fees. Current transaction requires approximately ${cryptoAmount} ${tokenLabels[tokenType]} + gas fees.`
          );
        } else if (error.message.includes('user rejected') || error.message.includes('denied')) {
          setPaymentError('Transaction was cancelled. Please try again if you want to proceed.');
        } else if (error.message.includes('network') || error.message.includes('connection')) {
          if (extractedTxId) {
            // On-chain TX succeeded but backend notification failed due to network issue
            setPaymentError(
              `Your on-chain transaction was sent successfully, but we couldn't notify the ar.io backend due to a network issue. Your transaction ID has been saved — use the Retry button to complete the process.`
            );
          } else {
            setPaymentError('Network connection issue. Please check your connection and try again.');
          }
        } else if (error.message.includes('gas')) {
          setPaymentError('Transaction gas estimation failed. Please try again or check your wallet settings.');
        } else if (extractedTxId) {
          setPaymentError(
            `Your on-chain transaction was sent successfully, but the ar.io backend wasn't notified. Your transaction ID has been saved — use the Retry button to complete the process.`
          );
        } else {
          setPaymentError(`Payment failed: ${error.message}`);
        }
      } else {
        setPaymentError('Payment failed. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Retry failed transaction
  const retryTransaction = async () => {
    if (!failedTxId) return;

    setIsRetrying(true);
    setPaymentError('Waiting for blockchain confirmation (3 seconds)...');

    // Wait a bit for the transaction to be confirmed on-chain
    await new Promise((resolve) => setTimeout(resolve, 3000));

    setPaymentError('Submitting transaction to ar.io...');

    try {
      // Use properly formatted turbo config with correct token type
      const turbo = TurboFactory.unauthenticated({
        ...turboConfigForRetry,
        token: tokenType as any,
      });

      console.log('Retrying submitFundTransaction with txId:', failedTxId);
      const response = await turbo.submitFundTransaction({
        txId: failedTxId,
      });
      console.log('Retry response:', response);

      if (response.status === 'failed') {
        setPaymentError(
          'Transaction retry failed. The blockchain transaction may not be confirmed yet. Please wait a minute and try again, or contact support if the issue persists.'
        );
        setIsRetrying(false);
      } else {
        removePendingTopUpTx(failedTxId);
        setFailedTxId(undefined);
        setPaymentError(undefined);
        onPaymentComplete(response);
      }
    } catch (e: unknown) {
      console.error('Retry error:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);

      if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        setPaymentError(
          `Transaction not found yet. The blockchain transaction (${failedTxId}) needs to be confirmed before ar.io can process it. Please wait 1-2 minutes and try again.`
        );
      } else {
        setPaymentError(`Retry failed: ${errorMessage}`);
      }
      setIsRetrying(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 border border-border/20">
          <Wallet className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-2xl font-heading font-bold text-foreground mb-1">Review Payment</h3>
          <p className="text-sm text-foreground/80">Confirm your crypto payment details</p>
        </div>
      </div>

      {/* Single Main Container - All elements inside like Stripe */}
      <div className="bg-card rounded-2xl border border-border/20 p-6">
        {pricingLoading ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-foreground mb-2">Getting Live Pricing</p>
            <p className="text-sm text-foreground/80">Fetching current {tokenLabels[tokenType]} rates...</p>
          </div>
        ) : pricingError ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
            <p className="text-foreground mb-2">Quote Generation Unavailable</p>
            <p className="text-sm text-foreground/80 mb-4">{pricingError}</p>
            <button onClick={onBack} className="text-foreground hover:text-foreground/80 transition-colors">
              Go Back and Try Different Token
            </button>
          </div>
        ) : quote ? (
          <>
            {/* Show recipient info if funding another wallet */}
            {paymentTargetAddress && paymentTargetAddress !== address && (
              <div className="mb-6 bg-info/10 border border-info/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-info mb-2">
                  <Users className="w-4 h-4" />
                  <span className="font-medium text-sm">Credits will be delivered to:</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-sm text-info font-mono break-all flex-1 p-2 bg-card/50 rounded">
                    {paymentTargetAddress}
                  </code>
                  <CopyButton textToCopy={paymentTargetAddress} />
                </div>
                <div className="text-xs text-info/80 mt-2">
                  {getWalletTypeLabel(paymentTargetType || 'unknown')} wallet
                </div>
              </div>
            )}

            {/* Order Summary */}
            <div className="bg-card p-6 rounded-2xl mb-6">
              <div className="flex flex-col items-center py-4 mb-4">
                <div className="text-4xl font-bold text-foreground mb-1">{quote.credits.toFixed(4)}</div>
                <div className="text-sm text-foreground/80">Credits</div>
                {quote.gigabytes > 0 && (
                  <div className="text-xs text-foreground/80 mt-1">
                    ≈ {formatStorage(quote.gigabytes)} storage power
                  </div>
                )}
              </div>

              {/* Token Amount Breakdown */}
              <div className="flex justify-between py-2 text-sm text-foreground/80 border-t border-border/20">
                <div>Token Amount:</div>
                <div>
                  {quote.tokenAmount.toFixed(
                    tokenType === 'ethereum' || tokenType === 'base-eth'
                      ? 6
                      : tokenType === 'solana'
                        ? 4
                        : tokenType === 'pol'
                          ? 2
                          : tokenType === 'usdc' || tokenType === 'base-usdc' || tokenType === 'polygon-usdc'
                            ? 2
                            : 8
                  )}{' '}
                  {tokenLabels[tokenType]}
                </div>
              </div>
              <div className="flex justify-between py-2 text-sm text-foreground/80">
                <div>Network:</div>
                <div>{tokenNetworkLabels[tokenType]}</div>
              </div>
            </div>

            {/* Wallet Balance Section */}
            <div className="bg-card rounded-2xl p-4 border border-border/20 mb-6">
              <h4 className="font-heading font-medium text-foreground mb-3">Wallet Balance</h4>

              {balanceLoading ? (
                <div className="flex items-center gap-2 p-2 bg-card/50 rounded border border-border/20">
                  <Loader2 className="w-4 h-4 text-foreground/80 animate-spin" />
                  <span className="text-xs text-foreground/80">Checking wallet balance...</span>
                </div>
              ) : balanceError ? (
                <div className="flex items-center gap-2 p-2 bg-warning/10 rounded border border-warning/20">
                  <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-warning font-medium">Unable to fetch balance</div>
                    <div className="text-xs text-warning/70 mt-0.5">{balanceError}</div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Current Balance */}
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-foreground/80">Current Balance:</span>
                    <span className="text-sm font-medium text-foreground">
                      {formatTokenAmount(tokenBalance, tokenType)} {tokenLabels[tokenType]}
                    </span>
                  </div>

                  {/* Payment Amount */}
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-foreground/80">Payment Amount:</span>
                    <span className="text-sm font-medium text-error">
                      -{formatTokenAmount(cryptoAmount, tokenType)} {tokenLabels[tokenType]}
                    </span>
                  </div>

                  {/* After Purchase */}
                  <div className="flex justify-between items-center py-2 pt-3 border-t border-border/20/30">
                    <span className="text-sm font-medium text-foreground">After Purchase:</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${hasSufficientBalance ? 'text-success' : 'text-error'}`}>
                        {formatTokenAmount(Math.max(0, balanceAfterPurchase), tokenType)} {tokenLabels[tokenType]}
                      </span>
                      {hasSufficientBalance ? (
                        <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-error flex-shrink-0" />
                      )}
                    </div>
                  </div>

                  {/* Insufficient balance warning */}
                  {!hasSufficientBalance && (
                    <div className="mt-3 p-2 bg-error/10 rounded border border-error/20">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-error">
                          <div className="font-medium">Insufficient {tokenLabels[tokenType]} balance</div>
                          <div className="mt-1">
                            You need {formatTokenAmount(cryptoAmount - tokenBalance, tokenType)}{' '}
                            {tokenLabels[tokenType]} more to complete this purchase.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Payment Method Info */}
            <div className="bg-card rounded-2xl p-4 border border-border/20 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-info/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-info" />
                </div>
                <div>
                  <h4 className="font-heading font-medium text-foreground mb-1">Payment Method</h4>
                  <p className="text-sm text-foreground/80">
                    {(() => {
                      // Extract just the token name without network qualifier (e.g., "ARIO" from "ARIO (Base)")
                      const tokenName = tokenLabels[tokenType].split(' (')[0];
                      return canPayDirectly
                        ? `Direct payment using your ${tokenName} on ${tokenNetworkLabels[tokenType]}`
                        : `Manual transfer of ${tokenName} on ${tokenNetworkLabels[tokenType]} required`;
                    })()}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Clock
                      className={`w-3 h-3 ${
                        tokenProcessingTimes[tokenType].speed === 'fast'
                          ? 'text-success'
                          : tokenProcessingTimes[tokenType].speed === 'medium'
                            ? 'text-warning'
                            : 'text-warning'
                      }`}
                    />
                    <p
                      className={`text-xs ${
                        tokenProcessingTimes[tokenType].speed === 'fast'
                          ? 'text-success'
                          : tokenProcessingTimes[tokenType].speed === 'medium'
                            ? 'text-warning'
                            : 'text-warning'
                      }`}
                    >
                      Expected processing: {tokenProcessingTimes[tokenType].time}
                    </p>
                  </div>
                  {!canPayDirectly && (
                    <p className="text-xs text-foreground/80 mt-1">
                      You'll be guided through the manual payment process
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="text-center bg-card/30 rounded-2xl p-4 mb-6">
              <p className="text-xs text-foreground/80">
                By uploading, you agree to our{' '}
                <a
                  href="https://ardrive.io/tos-and-privacy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:text-foreground/80 transition-colors"
                >
                  Terms of Service
                </a>
              </p>
            </div>

            {/* Error Message */}
            {paymentError && (
              <div className="bg-error/10 border border-error/20 rounded-2xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-error text-sm break-words">{paymentError}</div>
                    {failedTxId && (
                      <button
                        onClick={retryTransaction}
                        disabled={isRetrying}
                        className="mt-3 w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                        {isRetrying ? 'Retrying...' : 'Retry Transaction'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-6 border-t border-border/20">
              <button onClick={onBack} className="text-sm text-foreground/80 hover:text-foreground">
                Back
              </button>

              <button
                onClick={handlePayment}
                disabled={!quote || isProcessing || (!hasSufficientBalance && !balanceLoading)}
                className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4" />
                    {canPayDirectly ? 'Pay Now' : 'Continue'}
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
            <p className="text-foreground mb-2">Quote Generation Failed</p>
            <p className="text-sm text-foreground/80 mb-4">Unable to generate pricing for {tokenLabels[tokenType]}</p>
            <button onClick={onBack} className="text-foreground hover:text-foreground/80">
              Go Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
