import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useFreeUploadLimit } from './hooks/useFreeUploadLimit';
import { useTheme } from './hooks/useTheme';
import LandingPage from './pages/LandingPage';
import TopUpPage from './pages/TopUpPage';
import UploadPage from './pages/UploadPage';
import CapturePage from './pages/CapturePage';
import ShareCreditsPage from './pages/ShareCreditsPage';
import GiftPage from './pages/GiftPage';
import DomainsPage from './pages/DomainsPage';
import CalculatorPage from './pages/CalculatorPage';
import ServicesCalculatorPage from './pages/ServicesCalculatorPage';
import BalanceCheckerPage from './pages/BalanceCheckerPage';
import RedeemPage from './pages/RedeemPage';
import GatewayInfoPage from './pages/GatewayInfoPage';
import DeploySitePage from './pages/DeploySitePage';
import RecentDeploymentsPage from './pages/RecentDeploymentsPage';
import AccountPage from './pages/AccountPage';
import TryItNowPage from './pages/TryItNowPage';
import VerifyPage from './pages/VerifyPage';

// Lazy-load BrowsePage to isolate wayfinder dependencies and avoid circular dependency issues
const BrowsePage = lazy(() => import('./pages/BrowsePage'));
import { useStore } from './store/useStore';
import { WalletProviders } from './providers/WalletProviders';
import { useWalletAccountListener } from './hooks/useWalletAccountListener';

// Loading screen for Browse page while lazy-loading
function BrowsePageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="relative inline-block mb-4">
          {/* Shield icon */}
          <svg
            className="w-12 h-12 text-primary/30"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          {/* Spinner overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        </div>
        <p className="text-foreground/60 text-sm">Loading Browse...</p>
      </div>
    </div>
  );
}

// Payment callback handler component
function PaymentCallbackHandler() {
  const { address } = useStore();
  const location = useLocation();

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const paymentStatus = urlParams.get('payment');
    
    if (paymentStatus === 'success') {
      // Show success message and refresh balance
      if (address) {
        alert('Payment successful! Your credits have been added to your account.');
        // Trigger a balance refresh by dispatching a custom event
        window.dispatchEvent(new CustomEvent('refresh-balance'));
      }
    } else if (paymentStatus === 'cancelled') {
      alert('Payment cancelled.');
    }
  }, [location.search, address]);

  return null;
}

function AppRoutes() {
  // Listen for wallet account changes across all wallet types
  useWalletAccountListener();

  // Initialize bundler's free upload limit on app startup
  useFreeUploadLimit();

  // Apply theme class to document based on user preference
  useTheme();

  return (
    <>
      <PaymentCallbackHandler />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LandingPage />} />
          <Route path="login" element={<LandingPage />} />
          <Route path="topup" element={<TopUpPage />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="capture" element={<CapturePage />} />
          <Route path="deploy" element={<DeploySitePage />} />
          <Route path="deployments" element={<RecentDeploymentsPage />} />
          <Route path="share" element={<ShareCreditsPage />} />
          <Route path="gift" element={<GiftPage />} />
          <Route path="domains" element={<DomainsPage />} />
          <Route path="calculator" element={<CalculatorPage />} />
          <Route path="services-calculator" element={<ServicesCalculatorPage />} />
          <Route path="balances" element={<BalanceCheckerPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="redeem" element={<RedeemPage />} />
          <Route path="settings" element={<GatewayInfoPage />} />
          <Route path="try" element={<TryItNowPage />} />
          <Route path="verify" element={<VerifyPage />} />
          <Route path="browse" element={
            <Suspense fallback={<BrowsePageLoader />}>
              <BrowsePage />
            </Suspense>
          } />
          {/* Catch all route - redirect to home */}
          <Route path="*" element={<LandingPage />} />
        </Route>
      </Routes>
    </>
  );
}

export function App() {
  return (
    <WalletProviders>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </WalletProviders>
  );
}