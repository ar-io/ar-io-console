import { ReactNode } from 'react';
import { WagmiProvider, http } from 'wagmi';
import { mainnet, base, polygon, polygonAmoy } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PrivyProvider } from '@privy-io/react-auth';
import { RainbowKitProvider, getDefaultConfig, darkTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import '@solana/wallet-adapter-react-ui/styles.css';
import { RPC_ENDPOINTS } from '../store/useStore';

// WalletConnect Project ID - get one from https://cloud.walletconnect.com/
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '9f180997f87a0c8e1ddd5bcd92ae5363';

// Configure Wagmi with RainbowKit - supports MetaMask, WalletConnect, Coinbase, and many more
// RainbowKit's getDefaultConfig handles session persistence automatically via wagmi's reconnect
const wagmiConfig = getDefaultConfig({
  appName: 'ar.io',
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [mainnet, base, polygon, polygonAmoy],
  transports: {
    // Same endpoints the tokenMap uses (RPC_ENDPOINTS) — balance reads and wallet
    // operations hit one provider per chain, so rate limits and rotation apply
    // in one place instead of two that can drift.
    [mainnet.id]: http(RPC_ENDPOINTS.ethereum),
    [base.id]: http(RPC_ENDPOINTS.base),
    [polygon.id]: http(RPC_ENDPOINTS.polygon),
    [polygonAmoy.id]: http('https://rpc-amoy.polygon.technology'),
  },
  ssr: false,
  pollingInterval: 600_000, // 10 min — app fetches balances on-demand, not via wagmi polling
});

// Custom RainbowKit theme to match ar.io's dark theme
const arioRainbowTheme = darkTheme({
  accentColor: '#FE0230', // primary
  accentColorForeground: 'white',
  borderRadius: 'medium',
  fontStack: 'system',
});

// Empty array: modern wallets (Phantom, Solflare, Backpack) self-register via
// the Wallet Standard protocol. Importing explicit adapters (e.g. SolflareWalletAdapter)
// triggers MetaMask Snap detection side-effects that corrupt the wallet registry.
// This matches the approach used in ar-io-network-portal.
const solanaWallets: never[] = [];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 2,
    },
  },
});

import { PrivySolanaBridge } from './PrivySolanaBridge';

interface WalletProvidersProps {
  children: ReactNode;
}

export function WalletProviders({ children }: WalletProvidersProps) {
  return (
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID || 'cmfbrom1o000njr0bdhjvtaza'}
      config={{
        embeddedWallets: {
          ethereum: {
            // Only mint an embedded wallet for users who arrive WITHOUT one,
            // i.e. the email/"try it now" flow. 'all-users' also minted one for
            // people connecting MetaMask, producing a second, empty address the
            // user never asked for and did not know existed — and payment code
            // that reached for "the Privy wallet" would then sign from that
            // empty address while the UI displayed the connected wallet's
            // balance.
            createOnLogin: 'users-without-wallets',
          },
          /*
            ADDED alongside Ethereum, never replacing it. Turbo credits belong
            to an address, so switching an existing email user's identity to a
            fresh Solana wallet would strand the balance they already hold.
            They keep the Ethereum session; the Solana wallet is what signs
            ArNS writes, via PrivySolanaBridge.
          */
          solana: {
            /*
              'all-users', unlike Ethereum above.

              'users-without-wallets' means "no wallet of ANY kind", so every
              existing email user — who already holds an embedded Ethereum
              wallet — would be skipped and never get a Solana key. That is the
              entire population this is for.

              The reason Ethereum avoids 'all-users' does not apply here: there
              it minted a second, empty ETH address that competed with the one
              the user had connected. Privy is email-only in this app
              (`loginMethods: ['email']`), so nobody arrives with a Solana
              wallet through it, and there is nothing for this to shadow.
            */
            createOnLogin: 'all-users',
          },
          // Disable wallet UIs to prevent signature prompts during file uploads
          showWalletUIs: false,
        },
        loginMethods: ['email'], // Email-only, no wallet connections through Privy
        appearance: {
          theme: 'dark',
          accentColor: '#FE0230', // primary
          showWalletLoginFirst: false,
        },
      }}
    >
      {/* Announces Privy's embedded Solana wallet to the Wallet Standard
          registry, so the adapter below discovers it like any extension. */}
      <PrivySolanaBridge />
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider theme={arioRainbowTheme}>
            <ConnectionProvider endpoint={RPC_ENDPOINTS.solana}>
              <WalletProvider wallets={solanaWallets} autoConnect={false}>
                <WalletModalProvider>
                  {children}
                </WalletModalProvider>
              </WalletProvider>
            </ConnectionProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}
