import { useState } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useTheme } from '../hooks/useTheme';
import WalletSelectionModal from '../components/modals/WalletSelectionModal';
import { useWincForOneGiB } from '../hooks/useWincForOneGiB';
import { useCreditsForFiat } from '../hooks/useCreditsForFiat';
import { useFreeUploadLimit, formatFreeLimit } from '../hooks/useFreeUploadLimit';
import {
  ArrowRight, Zap, Github,
  CreditCard, Users, Upload, Globe2, Search, Check, Copy, ChevronDown, Info,
  Camera, BookOpen, Calculator, Compass, LayoutTemplate, Terminal
} from 'lucide-react';
import { HeroBackground } from '../components/HeroBackground';

const LandingPage = () => {
  const { address } = useStore();
  useTheme(); // Initialize theme
  const navigate = useNavigate();
  const location = useLocation();
  const loggedIn = address !== null;

  // Auto-open wallet modal when accessing /login route
  const isLoginRoute = location.pathname === '/login';
  const [showWalletModal, setShowWalletModal] = useState(isLoginRoute);

  // Handle modal close - if on /login, replace URL with home
  const handleWalletModalClose = () => {
    setShowWalletModal(false);
    if (isLoginRoute) {
      navigate('/', { replace: true });
    }
  };
  const [copied, setCopied] = useState(false);
  const [selectedFeatureIndex, setSelectedFeatureIndex] = useState(0);

  // Get pricing data (matches pricing calculator logic)
  const wincForOneGiB = useWincForOneGiB();
  const [creditsForOneUSD] = useCreditsForFiat(1, () => {});

  // Convert winc to USD: winc -> credits -> dollars
  const pricePerGiB = wincForOneGiB && creditsForOneUSD
    ? ((Number(wincForOneGiB) / 1e12) / creditsForOneUSD).toFixed(2)
    : '...';

  // Get free upload limit from bundler
  const { freeUploadLimitBytes, freeTier } = useFreeUploadLimit();

  // Consistent feature styling using primary brand color
  const getFeatureColor = () => {
    return {
      text: 'text-primary',
      bg: 'bg-primary/10',
      border: 'border-primary',
      button: 'bg-primary text-white hover:bg-primary/90'
    };
  };

  // Feature data for consistent rendering
  const features = [
    {
      name: 'Top Up',
      icon: CreditCard,
      title: 'Buy Credits with Cash or Crypto',
      description: 'Add credits to your account using a credit card, stablecoins or other cryptocurrencies. Instant processing with competitive rates.',
      benefits: ['Credit cards accepted', 'Pay in ETH, SOL, USDC, ARIO and more', 'Instant credits'],
      action: 'topup',
      loginText: 'Buy Credits',
      connectText: 'Sign in to Top Up'
    },
    {
      name: 'Upload',
      icon: Upload,
      title: 'Upload Files & Folders',
      description: 'Drag and drop files for permanent storage on Arweave. Batch uploads with real-time progress tracking, x402 instant payments and instant receipts.',
      benefits: ['Drag & drop interface', 'Batch uploads', 'x402 instant payments', 'Instant receipts'],
      action: 'upload',
      loginText: 'Upload Files',
      connectText: 'Sign in to Upload'
    },
    {
      name: 'Deploy',
      icon: Zap,
      title: 'Deploy Sites to the Permaweb',
      description: 'Deploy complete websites with automatic manifest creation and permanent hosting. Perfect for static sites, SPAs, and documentation.',
      benefits: ['Permanent hosting', 'Automatic manifests', 'Custom fallback pages', 'Domain name assignment'],
      action: 'deploy',
      loginText: 'Deploy Site',
      connectText: 'Sign in to Deploy'
    },
    {
      name: 'Pages',
      icon: LayoutTemplate,
      title: 'Build a Permanent Link-in-Bio Page',
      description: 'Create a link-in-bio page in seconds and publish it permanently to Arweave — no code, no files. Pick from dozens of designer templates, edit with a live preview, and give it a domain name.',
      benefits: ['30+ designer templates', 'Live preview editor', 'Permanent & versioned', 'Memorable domain name'],
      action: 'pages',
      loginText: 'Create a Page',
      connectText: 'Sign in to Create'
    },
    {
      name: 'Capture',
      icon: Camera,
      title: 'Capture & Archive Webpages',
      description: 'Preserve any webpage as a full-page screenshot on Arweave. Perfect for archiving content, preserving evidence, or creating permanent snapshots of the web.',
      benefits: ['Full-page screenshots', 'Web page archival', 'Smart domain assignment'],
      action: 'capture',
      loginText: 'Capture Webpage',
      connectText: 'Sign in to Capture'
    },
    {
      name: 'Browse',
      icon: Compass,
      title: 'Browse & Verify Arweave Data',
      description: 'Access any Arweave content by ArNS name or transaction ID. Browse the permaweb with optional cryptographic verification through multiple gateways.',
      benefits: ['ArNS name resolution', 'Cryptographic verification', 'Multi-gateway routing'],
      action: 'browse',
      loginText: 'Browse Data',
      connectText: 'Browse Data'
    },
    {
      name: 'Share',
      icon: Users,
      title: 'Share Credits Between Wallets',
      description: 'Delegate credits to other wallets for collaborative uploads and payments. Set time-based expiration and revoke anytime.',
      benefits: ['Wallet-to-wallet sharing', 'Time-based expiration', 'Revoke anytime'],
      action: 'share',
      loginText: 'Share Credits',
      connectText: 'Sign in to Share'
    },
    // DEPRECATED: Gifting feature disabled
    // {
    //   name: 'Gift',
    //   ...
    // },
    // {
    //   name: 'Redeem',
    //   ...
    // },
    {
      name: 'Domains',
      icon: Globe2,
      title: 'Search Available Domain Names',
      description: 'Search for available ArNS domain names and check registration costs. No login required to browse available names.',
      benefits: ['Search any name', 'Check availability', 'View pricing'],
      action: 'domains',
      loginText: 'Search Domains',
      connectText: 'Search Available Domains'
    },
    {
      name: 'Check Balance',
      icon: Search,
      title: 'Check Any Wallet Balance',
      description: 'Look up credit balances for any wallet address across Arweave, Ethereum, and Solana networks with storage estimates.',
      benefits: ['Multi-chain support', 'Real-time data', 'Storage estimates'],
      action: 'balances',
      loginText: 'Check Balance',
      connectText: 'Check Balance'
    },
    {
      name: 'Service Info',
      icon: Info,
      title: 'Gateway Service Information',
      description: 'View real-time gateway metrics, service configuration, and network status. Compare fees and technical details.',
      benefits: ['Live metrics', 'Fee transparency', 'Network status'],
      action: 'settings',
      loginText: 'View Service Info',
      connectText: 'View Service Info'
    }
  ];

  return (
    <div className="space-y-12 px-4 sm:px-0">
      {/* Hero Section */}
      <div className="relative flex w-full flex-col items-center rounded-2xl border border-border/20 bg-card px-8 sm:px-12 py-10 overflow-hidden">
        {/* Memoized background to prevent flickering from parent re-renders */}
        <HeroBackground />
        {/* Main headline with gradient */}
        <h1 className="relative z-10 font-heading font-bold text-3xl sm:text-4xl lg:text-5xl text-center max-w-5xl leading-tight">
          <span className="text-foreground">Scale on a </span>
          <span className="text-primary">permanent</span>
          <span className="text-foreground"> cloud</span>
        </h1>

        {/* Subheadline */}
        <p className="relative z-10 mt-5 text-base sm:text-lg text-center max-w-3xl text-foreground/80 leading-relaxed">
          Enterprise-grade storage, deployments, and domains for devs and teams.
        </p>

        {/* CTA Section */}
        <div className="relative z-10 mt-7 flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={() => navigate('/try')}
            className="group relative rounded-full bg-primary px-8 py-4 font-bold text-white hover:bg-primary/90 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center gap-2 text-lg cursor-pointer"
          >
            <Upload className="w-5 h-5" />
            <span>Try it Out</span>
          </button>

          <a
            href="https://docs.ar.io/build/upload/bundling-services"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-border/20 px-8 py-4 font-medium flex items-center gap-2 hover:bg-card hover:border-foreground transition-all group"
          >
            <BookOpen className="w-5 h-5" />
            <span>Read the Docs</span>
          </a>
        </div>

        {/* Terminal snippet - more integrated */}
        <div className="relative z-10 mt-8 w-full max-w-2xl">
          <div className="text-xs text-foreground/80 uppercase tracking-wider mb-2 text-center">Quick Start</div>
          <div className="bg-code-surface border border-border/20 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between bg-code-surface px-3 py-2 border-b border-border/20">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-error/80"></div>
                <div className="w-3 h-3 rounded-full bg-warning/80"></div>
                <div className="w-3 h-3 rounded-full bg-success/80"></div>
              </div>
              <div className="flex-1 text-center">
                <span className="text-[10px] text-white/50 font-mono uppercase tracking-wider">bash</span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('npm i @ardrive/turbo-sdk');
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-white/10 transition-all text-xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span className="text-white">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-white/50" />
                    <span className="text-white/50">Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="px-4 py-3.5 font-mono text-sm">
              <div className="flex items-center">
                <span className="text-white/70 select-none">$</span>
                <span className="text-white ml-2">npm i @ardrive/turbo-sdk</span>
                <span className="text-white/50 ml-1 animate-[blink_1s_infinite]">|</span>
              </div>
            </div>
          </div>

        </div>

        {showWalletModal && (
          <WalletSelectionModal
            onClose={handleWalletModalClose}
          />
        )}
      </div>

      {/* How it Works */}
      <div className="mb-12">
        <div className="text-center mb-12">
          <h2 className="font-heading font-bold text-2xl mb-2 text-foreground">How does it work?</h2>
          <p className="text-lg text-foreground/80 max-w-3xl mx-auto">
            Ar.io handles the complexity so you don't have to. Fund instantly, upload seamlessly, and access your permanent data through a decentralized CDN.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {/* Step 1: Fund */}
          <div className="bg-card border border-border/20 rounded-2xl p-6 hover:border-primary/50 transition-colors group">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-2xl font-bold text-foreground">1.</div>
              <h3 className="font-heading font-bold text-xl text-foreground">Fund</h3>
            </div>
            <p className="text-sm text-foreground/80">
              Buy Credits instantly with a card or crypto like ETH, SOL, ARIO, Stablecoins (via x402), and more — ready to upload in seconds.
            </p>
          </div>

          {/* Step 2: Bundle */}
          <div className="bg-card border border-border/20 rounded-2xl p-6 hover:border-primary/50 transition-colors group">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-2xl font-bold text-foreground">2.</div>
              <h3 className="font-heading font-bold text-xl text-foreground">Upload</h3>
            </div>
            <p className="text-sm text-foreground/80">
              Use your favorite Arweave, Ethereum, or Solana wallet to cryptographically sign and upload data.
            </p>
          </div>

          {/* Step 3: Settle */}
          <div className="bg-card border border-border/20 rounded-2xl p-6 hover:border-primary/50 transition-colors group">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-2xl font-bold text-foreground">3.</div>
              <h3 className="font-heading font-bold text-xl text-foreground">Settle</h3>
            </div>
            <p className="text-sm text-foreground/80">
              Your files are bundled and permanently stored on Arweave — timestamped, tamper-proof, and verifiable forever.
            </p>
          </div>

          {/* Step 4: Access */}
          <div className="bg-card border border-border/20 rounded-2xl p-6 hover:border-primary/50 transition-colors group">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-2xl font-bold text-foreground">4.</div>
              <h3 className="font-heading font-bold text-xl text-foreground">Access</h3>
            </div>
            <p className="text-sm text-foreground/80">
              Access your data instantly with CDN-level performance via the ar.io network.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-10 flex flex-row items-center justify-center gap-3 sm:gap-4">
          <a
            href="https://ar.io/technology/"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative rounded-full bg-primary px-4 sm:px-8 py-3 sm:py-4 font-bold text-white hover:bg-primary/90 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center gap-2 text-sm sm:text-lg"
          >
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Learn more</span>
          </a>

          <button
            className="rounded-full border border-border/20 px-4 sm:px-8 py-3 sm:py-4 font-medium flex items-center gap-2 hover:bg-card hover:border-foreground transition-all group text-sm sm:text-lg"
            onClick={() => navigate('/try')}
          >
            <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Try it Out</span>
          </button>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="mb-12">
        <div className="text-center mb-8">
          <h2 className="font-heading font-bold text-2xl text-foreground mb-2">Transparent Pricing</h2>
          <p className="text-foreground/80">Pay-as-you-go storage with no subscriptions, now with x402</p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:gap-6 max-w-2xl mx-auto">
          {/* Free Tier */}
          <div className="bg-card rounded-2xl border border-success/30 p-4 md:p-8 text-center">
            <div className="text-4xl font-heading font-bold text-success mb-2">FREE</div>
            <div className="text-lg text-foreground font-medium mb-1">
              {freeUploadLimitBytes > 0 ? `Up to ${formatFreeLimit(freeUploadLimitBytes)} per file` : 'Small files'}
            </div>
            <div className="text-sm text-foreground/80 mb-4">
              {freeTier.lifetimeBytes > 0
                ? `${formatFreeLimit(freeTier.lifetimeBytes)} lifetime limit`
                : 'No wallet or credits required'}
            </div>
            <button
              onClick={() => navigate('/try')}
              className="inline-flex items-center gap-1 text-sm text-success hover:text-success/80 font-medium group"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Try it now</span>
            </button>
          </div>

          {/* Per GiB Pricing */}
          <div className="bg-card rounded-2xl border border-border/20 p-4 md:p-8 text-center">
            <div className="text-4xl font-heading font-bold text-primary mb-2">${pricePerGiB}</div>
            <div className="text-lg text-foreground font-medium mb-1">Per GiB</div>
            <div className="text-sm text-foreground/80 mb-4">Larger files & bulk storage</div>
            <button
              onClick={() => navigate('/calculator')}
              className="inline-flex items-center gap-1 text-sm text-foreground/80 hover:text-foreground font-medium group"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Calculate your costs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Feature Explorer */}
      <div className="mb-12">
        {/* Section Header */}
        <div className="text-center mb-6">
          <h2 className="font-heading font-bold text-2xl text-foreground mb-2">What's in the Console</h2>
          <p className="text-foreground/80">Explore what you can do within the ar.io console</p>
        </div>

        <div className="rounded-2xl border border-border/20 bg-card">
          {/* Desktop: Vertical Sidebar Layout */}
          <div className="hidden md:flex">
            {/* Sidebar */}
            <div className="w-64 border-r border-border/20 bg-card/30">
              <div className="py-2">
                {features.map((feature, index) => (
                  <button
                    key={feature.name}
                    onClick={() => setSelectedFeatureIndex(index)}
                    className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                      selectedFeatureIndex === index
                        ? `${getFeatureColor().bg} border-r-2 ${getFeatureColor().border} text-foreground`
                        : 'text-foreground/80 hover:bg-card/50 hover:text-foreground'
                    }`}
                  >
                    <feature.icon className={`w-5 h-5 ${
                      selectedFeatureIndex === index ? getFeatureColor().text : 'text-foreground/80'
                    }`} />
                    <span className="font-medium">{feature.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 sm:p-8">
              <div className="text-center py-4">
                {(() => {
                  const Icon = features[selectedFeatureIndex].icon;
                  return <Icon className={`w-16 h-16 ${getFeatureColor().text} mx-auto mb-4`} />;
                })()}
                <h3 className="font-heading font-bold text-xl text-foreground mb-2">{features[selectedFeatureIndex].title}</h3>
                <p className="text-foreground/80 mb-6 max-w-md mx-auto">
                  {features[selectedFeatureIndex].description}
                </p>
                <div className="flex items-center justify-center gap-4 text-sm text-foreground/80 mb-6 flex-wrap">
                  {features[selectedFeatureIndex].benefits.map((benefit) => (
                    <span key={benefit} className="flex items-center gap-1">
                      <Check className={`w-4 h-4 ${getFeatureColor().text}`} /> {benefit}
                    </span>
                  ))}
                </div>
                <button onClick={() => {
                  const feature = features[selectedFeatureIndex];
                  if (feature.action === 'balances' || feature.action === 'settings' || feature.action === 'browse' || feature.action === 'domains') {
                    navigate(`/${feature.action}`);
                  } else if (loggedIn) {
                    // Pages: jump straight to the template picker, not the dashboard.
                    if (feature.action === 'pages') {
                      navigate('/pages', { state: { create: true } });
                    } else {
                      navigate(`/${feature.action}`);
                    }
                  } else {
                    setShowWalletModal(true);
                  }
                }} className={`px-6 py-2 rounded-full font-medium ${getFeatureColor().button}`}>
                  {(features[selectedFeatureIndex].action === 'balances' || features[selectedFeatureIndex].action === 'settings' || features[selectedFeatureIndex].action === 'browse' || features[selectedFeatureIndex].action === 'domains')
                    ? features[selectedFeatureIndex].loginText
                    : loggedIn
                      ? features[selectedFeatureIndex].loginText
                      : features[selectedFeatureIndex].connectText
                  }
                </button>
              </div>
            </div>
          </div>

          {/* Mobile: Dropdown Layout */}
          <div className="md:hidden">
            <div className="p-4">
              <Listbox value={features[selectedFeatureIndex]} onChange={(feature) => {
                const index = features.findIndex(f => f.name === feature.name);
                setSelectedFeatureIndex(index);
              }}>
                <div className="relative mb-4">
                  <Listbox.Button className="w-full flex items-center justify-between px-4 py-3 bg-card border border-border/20 rounded-2xl text-left">
                    <span className="flex items-center gap-3">
                      {(() => {
                        const Icon = features[selectedFeatureIndex].icon;
                        return <Icon className="w-5 h-5 text-primary" />;
                      })()}
                      <span className="font-medium text-foreground">{features[selectedFeatureIndex].name}</span>
                    </span>
                    <ChevronDown className="w-4 h-4 text-foreground/80" />
                  </Listbox.Button>
                  <Transition
                    as={Fragment}
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <Listbox.Options className="absolute z-50 mt-1 w-full bg-card border border-border/20 rounded-2xl shadow-lg py-1">
                      {features.map((feature) => (
                        <Listbox.Option
                          key={feature.name}
                          className={({ active }) =>
                            `relative cursor-pointer select-none py-2 px-4 ${
                              active ? 'bg-card text-foreground' : 'text-foreground/80'
                            }`
                          }
                          value={feature}
                        >
                          <span className="flex items-center gap-3">
                            <feature.icon className="w-4 h-4" />
                            {feature.name}
                          </span>
                        </Listbox.Option>
                      ))}
                    </Listbox.Options>
                  </Transition>
                </div>
              </Listbox>

              {/* Mobile Content */}
              <div className="text-center py-4">
                {(() => {
                  const Icon = features[selectedFeatureIndex].icon;
                  return <Icon className={`w-16 h-16 ${getFeatureColor().text} mx-auto mb-4`} />;
                })()}
                <h3 className="font-heading font-bold text-xl text-foreground mb-2">{features[selectedFeatureIndex].title}</h3>
                <p className="text-foreground/80 mb-6">
                  {features[selectedFeatureIndex].description}
                </p>
                <div className="grid grid-cols-1 gap-2 text-sm text-foreground/80 mb-6">
                  {features[selectedFeatureIndex].benefits.map((benefit) => (
                    <span key={benefit} className="flex items-center gap-2">
                      <Check className={`w-4 h-4 ${getFeatureColor().text}`} /> {benefit}
                    </span>
                  ))}
                </div>
                <button onClick={() => {
                  const feature = features[selectedFeatureIndex];
                  if (feature.action === 'balances' || feature.action === 'settings' || feature.action === 'browse' || feature.action === 'domains') {
                    navigate(`/${feature.action}`);
                  } else if (loggedIn) {
                    // Pages: jump straight to the template picker, not the dashboard.
                    if (feature.action === 'pages') {
                      navigate('/pages', { state: { create: true } });
                    } else {
                      navigate(`/${feature.action}`);
                    }
                  } else {
                    setShowWalletModal(true);
                  }
                }} className={`px-6 py-2 rounded-full font-medium ${getFeatureColor().button}`}>
                  {(features[selectedFeatureIndex].action === 'balances' || features[selectedFeatureIndex].action === 'settings' || features[selectedFeatureIndex].action === 'browse' || features[selectedFeatureIndex].action === 'domains')
                    ? features[selectedFeatureIndex].loginText
                    : loggedIn
                      ? features[selectedFeatureIndex].loginText
                      : features[selectedFeatureIndex].connectText
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Builder's Journey Section */}
      <section className="mb-12">
        <div className="text-center mb-10">
          <h2 className="font-heading font-bold text-2xl text-foreground mb-2">Builder's Journey</h2>
          <p className="text-foreground/80">Follow the path from first upload to running your own infrastructure. Click any step to explore.</p>
        </div>

        {/* Desktop/Tablet: 3x3 Grid with snake line */}
        <div className="hidden md:block max-w-2xl mx-auto px-4">
          <div className="relative isolate">
            {/* SVG Snake line connecting all cells */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 300 300"
              preserveAspectRatio="none"
              style={{ zIndex: 1 }}
            >
              <defs>
                <linearGradient id="journeyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="100%" stopColor="#5427C8" />
                </linearGradient>
              </defs>
              {/* Snake path: Row1 L→R, Row2 R→L, Row3 L→R - wider zigzag */}
              <path
                d="M 25 50
                   L 153 50
                   L 275 50
                   L 275 150
                   L 153 150
                   L 25 150
                   L 25 250
                   L 153 250
                   L 275 250"
                fill="none"
                stroke="url(#journeyGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* 3x3 Grid - square cells */}
            <div className="grid grid-cols-3 gap-x-12 gap-y-8 relative" style={{ zIndex: 2 }}>
              {/* Cell 1: Learn - special start box (larger) */}
              <div className="h-36 bg-white border-2 border-primary/30 rounded-xl p-4 relative flex flex-col items-center justify-center shadow-md">
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-heading font-bold text-sm shadow-md">
                  1
                </div>
                <p className="text-xs text-foreground/80 text-center mb-3 leading-snug">Learn the fundamentals of ar.io and Arweave</p>
                <a
                  href="https://docs.ar.io/learn/what-is-arweave/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 bg-primary text-white rounded-lg px-4 py-2 hover:bg-primary/90 transition-all text-xs font-medium w-full"
                >
                  Get Started
                </a>
              </div>

              {/* Cells 2-8: Regular steps (compact) - row 2 reversed for snake pattern */}
              {[
                { num: 2, desc: <><strong className="text-foreground">Upload</strong> your first file permanently</>, href: 'https://docs.ar.io/build/upload/bundling-services/', xOffset: 0, yOffset: 20 },
                { num: 3, desc: <><strong className="text-foreground">Deploy</strong> a decentralized app</>, href: 'https://docs.ar.io/build/guides/hosting-decentralised-apps/', xOffset: 35, yOffset: 20 },
                { num: 6, desc: <><strong className="text-foreground">Explore</strong> more patterns</>, href: 'https://docs.ar.io/build/guides/', xOffset: -35, yOffset: 0 },
                { num: 5, desc: <><strong className="text-foreground">Resolve</strong> and fetch content</>, href: 'https://docs.ar.io/build/access/', xOffset: 0, yOffset: 0 },
                { num: 4, desc: <>Get a friendly <strong className="text-foreground">domain name</strong></>, href: 'https://docs.ar.io/build/guides/working-with-arns/', xOffset: 35, yOffset: 0 },
                { num: 7, desc: <>Learn how <strong className="text-foreground">gateways</strong> work</>, href: 'https://docs.ar.io/learn/gateways/', xOffset: -35, yOffset: 20 },
                { num: 8, desc: <><strong className="text-foreground">Run</strong> your own infra</>, href: 'https://docs.ar.io/build/run-a-gateway/', xOffset: 0, yOffset: 20 },
              ].map((step) => (
                <a
                  key={step.num}
                  href={step.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group justify-self-center"
                  style={{ transform: `translate(${step.xOffset}px, ${step.yOffset}px)` }}
                >
                  <div className="w-24 h-24 bg-card border-2 border-primary/20 rounded-xl p-3 transition-all duration-200 group-hover:-translate-y-1 group-hover:border-primary group-hover:shadow-lg relative flex items-center justify-center">
                    <div className="absolute -top-2.5 -left-2.5 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-heading font-bold text-xs shadow-md">
                      {step.num}
                    </div>
                    <p className="text-[11px] text-foreground/70 leading-snug text-center">{step.desc}</p>
                  </div>
                </a>
              ))}

              {/* Cell 9: Join Community - solid purple background (larger) */}
              <div className="h-36 bg-primary rounded-xl p-4 relative flex flex-col items-center justify-center shadow-lg">
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-white text-primary flex items-center justify-center font-heading font-bold text-sm shadow-md">
                  9
                </div>
                <p className="text-xs text-white/90 text-center mb-3 leading-snug">Join the ar.io open source community</p>
                <div className="flex flex-col gap-2 w-full">
                  <a href="https://discord.com/invite/HGG52EtTc2" target="_blank" rel="noopener noreferrer"
                     className="flex items-center justify-center gap-1.5 bg-white text-primary rounded-lg px-3 py-2 hover:bg-white/90 transition-all text-xs font-medium">
                    <img src="https://ar.io/icons/discord-icon.svg" alt="Discord" className="w-4 h-4" />
                    Discord
                  </a>
                  <a href="https://github.com/ar-io" target="_blank" rel="noopener noreferrer"
                     className="flex items-center justify-center gap-1.5 bg-white/20 text-white rounded-lg px-3 py-2 hover:bg-white/30 transition-all text-xs">
                    <Github className="w-4 h-4" />
                    GitHub
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: Single column with vertical line */}
        <div className="md:hidden px-4">
          <div className="relative">
            {/* Vertical connecting line - centered on number circles (w-7 = 28px, center at 14px) */}
            <div className="absolute left-[14px] top-8 bottom-8 w-1.5 bg-gradient-to-b from-white to-primary -translate-x-1/2" style={{ zIndex: 0 }} />

            <div className="space-y-3 relative" style={{ zIndex: 1 }}>
              {/* Mobile: Step 1 - Learn (special start box like desktop) */}
              <a href="https://docs.ar.io/learn/what-is-arweave/" target="_blank" rel="noopener noreferrer" className="block group">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-heading font-bold text-xs shadow-md shrink-0">
                    1
                  </div>
                  <div className="flex-1 bg-white border-2 border-primary/30 rounded-lg px-3 py-3 group-hover:border-primary/50 transition-colors">
                    <p className="text-xs text-foreground/80 mb-2"><strong className="text-foreground">Learn</strong> the fundamentals of ar.io and Arweave</p>
                    <span className="inline-flex items-center justify-center gap-1 bg-primary text-white rounded-lg px-3 py-1.5 text-xs font-medium">
                      Get Started
                    </span>
                  </div>
                </div>
              </a>

              {/* Mobile: Steps 2-8 with bolded word format */}
              {[
                { num: 2, desc: <><strong className="text-foreground">Upload</strong> your first file permanently</>, href: 'https://docs.ar.io/build/upload/bundling-services/' },
                { num: 3, desc: <><strong className="text-foreground">Deploy</strong> a decentralized app</>, href: 'https://docs.ar.io/build/guides/hosting-decentralised-apps/' },
                { num: 4, desc: <>Get a friendly <strong className="text-foreground">domain name</strong></>, href: 'https://docs.ar.io/build/guides/working-with-arns/' },
                { num: 5, desc: <><strong className="text-foreground">Resolve</strong> and fetch content</>, href: 'https://docs.ar.io/build/access/' },
                { num: 6, desc: <><strong className="text-foreground">Explore</strong> more patterns</>, href: 'https://docs.ar.io/build/guides/' },
                { num: 7, desc: <>Learn how <strong className="text-foreground">gateways</strong> work</>, href: 'https://docs.ar.io/learn/gateways/' },
                { num: 8, desc: <><strong className="text-foreground">Run</strong> your own infra</>, href: 'https://docs.ar.io/build/run-a-gateway/' },
              ].map((step) => (
                <a key={step.num} href={step.href} target="_blank" rel="noopener noreferrer" className="block group">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-heading font-bold text-xs shadow-md shrink-0">
                      {step.num}
                    </div>
                    <div className="flex-1 bg-card border border-primary/20 rounded-lg px-3 py-2 group-hover:border-primary/50 transition-colors">
                      <p className="text-xs text-foreground/70">{step.desc}</p>
                    </div>
                  </div>
                </a>
              ))}

              {/* Mobile: Join Community - solid purple like desktop */}
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-white text-primary flex items-center justify-center font-heading font-bold text-xs shadow-md shrink-0">
                  9
                </div>
                <div className="flex-1 bg-primary rounded-lg px-3 py-3">
                  <p className="text-xs text-white/90 mb-2"><strong className="text-white">Join</strong> the community</p>
                  <div className="flex gap-2">
                    <a href="https://discord.com/invite/HGG52EtTc2" target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-1.5 bg-white text-primary rounded-lg px-3 py-1.5 hover:bg-white/90 transition-all text-xs font-medium">
                      <img src="https://ar.io/icons/discord-icon.svg" alt="Discord" className="w-3.5 h-3.5" />
                      Discord
                    </a>
                    <a href="https://github.com/ar-io" target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-1.5 bg-white/20 text-white border border-white/30 rounded-lg px-3 py-1.5 hover:bg-white/30 transition-all text-xs">
                      <Github className="w-3.5 h-3.5" />
                      GitHub
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* For AI agents & LLMs */}
      <AgentDocsSection />

      {/* ArDrive — sibling consumer app for permanent file storage. A compact
          horizontal strip so it reads as a footer cross-link, not a second
          feature card stacked under the dark agents section above. */}
      <section className="flex flex-col gap-4 rounded-2xl border border-border/20 bg-gradient-to-r from-primary/[0.06] to-card p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        <img src="/ardrive-logo.png" alt="ArDrive" className="h-14 w-14 flex-shrink-0" />
        <div className="flex-1 text-center sm:text-left">
          <h3 className="font-heading text-lg font-bold text-foreground">Just want to store files?</h3>
          <p className="mt-1 text-sm leading-relaxed text-foreground/70">
            ArDrive is a permanent file drive — drag, drop, organize, and share files and
            folders that last forever. All the permanence of the permaweb, in a friendly app
            anyone can use.
          </p>
        </div>
        <a
          href="https://ardrive.net/"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex flex-shrink-0 items-center justify-center gap-2 self-center rounded-full border border-border/30 bg-background px-5 py-2.5 font-semibold text-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          Try ArDrive
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </a>
      </section>

    </div>
  );
};

/**
 * A distinct, terminal-styled call-out for AI agents / LLM builders: the ar.io
 * docs are published as one plain-text file (llms-full.txt) sized for context
 * windows, and an agent can claim a permanent name/dataset/API at an ArNS name.
 */
function AgentDocsSection() {
  const [copied, setCopied] = useState(false);
  const cmd = 'curl https://docs.ar.io/llms-full.txt';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-foreground/20 bg-foreground text-white shadow-lg">
      <div className="grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-2">
        {/* Pitch */}
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1">
            <Terminal className="h-3.5 w-3.5 text-lavender" />
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">
              For AI agents &amp; LLMs
            </span>
          </div>
          <h2 className="mb-3 font-heading text-2xl font-bold sm:text-3xl">Point your agent at ar.io</h2>
          <p className="mb-5 max-w-md text-sm leading-relaxed text-white/70 sm:text-base">
            The entire ar.io documentation as one plain-text file — sized for LLM context
            windows and autonomous agents. Then give your agent a permanent home it owns:
            a name, dataset, and API, all under one ArNS name.
          </p>
          <a
            href="https://docs.ar.io/llms-full.txt"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-80"
          >
            Read llms-full.txt <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Terminal — mirrors the hero "Quick Start" snippet chrome (traffic
            lights, bash label, $ prompt + cursor). Uses a black-tinted surface
            rather than bg-code-surface, which is #23232D — identical to this
            section's bg-foreground and would render invisible here. */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 font-mono shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-error/80" />
              <span className="h-3 w-3 rounded-full bg-warning/80" />
              <span className="h-3 w-3 rounded-full bg-success/80" />
            </div>
            <div className="flex-1 text-center">
              <span className="text-[10px] uppercase tracking-wider text-white/50">bash</span>
            </div>
            <button
              type="button"
              onClick={copy}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-all hover:bg-white/10"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-white" />
                  <span className="text-white">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-white/50" />
                  <span className="text-white/50">Copy</span>
                </>
              )}
            </button>
          </div>
          <div className="px-4 py-3.5 text-sm">
            <div className="flex items-center">
              <span className="select-none text-white/70">$</span>
              <span className="ml-2 break-all text-white">{cmd}</span>
              <span className="ml-1 animate-[blink_1s_infinite] text-white/50">|</span>
            </div>
            <div className="mt-2.5 text-[12px] leading-relaxed text-white/40">
              <span className="text-success">200 OK</span> — the complete docs, in plain text,
              ready to drop into a prompt.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default LandingPage;
