import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useFreeUploadLimit } from './hooks/useFreeUploadLimit';
import { useTheme } from './hooks/useTheme';
import { useStore } from './store/useStore';
import { WalletProviders } from './providers/WalletProviders';
import { useWalletAccountListener } from './hooks/useWalletAccountListener';

// The homepage is eagerly loaded — it's the primary entry point, so lazy-loading
// it just trades a smaller bundle for a visible spinner on every first visit.
import LandingPage from './pages/LandingPage';

// Other route pages are lazy-loaded so each ships in its own chunk rather than
// the entry bundle. Layout wraps <Outlet> in <Suspense>, so the header/nav stay
// mounted while a page chunk loads.
const TopUpPage = lazy(() => import('./pages/TopUpPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const CapturePage = lazy(() => import('./pages/CapturePage'));
const ShareCreditsPage = lazy(() => import('./pages/ShareCreditsPage'));
// DEPRECATED: Gifting/Redeem features disabled — routes below stay commented out.
const DomainsPage = lazy(() => import('./pages/DomainsPage'));
const NameDetailPage = lazy(() => import('./pages/NameDetailPage'));
const ArNSPage = lazy(() => import('./pages/ArNSPage'));
const ReturnedNamesPage = lazy(() => import('./pages/ReturnedNamesPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const BalanceCheckerPage = lazy(() => import('./pages/BalanceCheckerPage'));
const GatewayInfoPage = lazy(() => import('./pages/GatewayInfoPage'));
const DeploySitePage = lazy(() => import('./pages/DeploySitePage'));
const RecentDeploymentsPage = lazy(() => import('./pages/RecentDeploymentsPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const MyDomainsPage = lazy(() => import('./pages/MyDomainsPage'));
const TryItNowPage = lazy(() => import('./pages/TryItNowPage'));
const PagesPage = lazy(() => import('./pages/PagesPage'));
const BrowsePage = lazy(() => import('./pages/BrowsePage'));

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
          <Route path="pages" element={<PagesPage />} />
          <Route path="share" element={<ShareCreditsPage />} />
          {/* DEPRECATED: Gifting feature disabled */}
          <Route path="domains" element={<DomainsPage />} />
          <Route path="domains/:name" element={<NameDetailPage />} />
          <Route path="arns" element={<ArNSPage />} />
          <Route path="returned-names" element={<ReturnedNamesPage />} />
          <Route path="pricing" element={<PricingPage />} />
          {/* Old pricing routes fold into the unified page (keep links alive). */}
          <Route path="calculator" element={<Navigate to="/pricing" replace />} />
          <Route path="name-prices" element={<Navigate to="/pricing?type=domains" replace />} />
          <Route path="services-calculator" element={<Navigate to="/pricing" replace />} />
          <Route path="balances" element={<BalanceCheckerPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="my-domains" element={<MyDomainsPage />} />
          <Route path="settings" element={<GatewayInfoPage />} />
          <Route path="try" element={<TryItNowPage />} />
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