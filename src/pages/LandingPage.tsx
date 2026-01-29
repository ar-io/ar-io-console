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
  CreditCard, Gift, Ticket, Users, Upload, Globe2, Search, Check, Copy, ChevronDown, Info,
  Package, Cloud, Server, Wallet, Camera, Phone, BookOpen, Calculator
} from 'lucide-react';
import { HeroBackground } from '../components/HeroBackground';
import { CompanyCarousel } from '../components/CompanyCarousel';

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
  const freeUploadLimitBytes = useFreeUploadLimit();

  // Company data for the carousel
  const companies = [
    { name: 'Forward Research', url: 'https://fwd.ar.io/', logo: '/forward-research-logo.jpg', description: 'Arweave core development team' },
    { name: 'Drip Haus', url: 'https://drip.haus/', logo: '/drip-haus-logo.png', description: 'NFT curation and discovery platform' },
    { name: 'Manifold', url: 'https://manifold.xyz/', logo: '/manifold_logo.jpg', description: 'NFT creation and deployment tools' },
    { name: 'Meta/Instagram', url: 'https://www.theblock.co/post/182569/meta-arweave-instagram-nfts', logo: '/meta-logo.svg', description: 'Digital collectibles platform' },
    { name: 'RedStone Oracle', url: 'https://www.redstone.finance/', logo: '/RedStone_squarelogo.png', description: 'Permanent price feed storage' },
    { name: 'KYVE Network', url: 'https://www.kyve.network/', logo: '/kyve-logo.jpeg', description: 'Blockchain data archival' },
    { name: 'Metaplex', url: 'https://www.metaplex.com/', logo: '/metaplex_studios_logo.jpeg', description: 'Solana NFT metadata storage' },
    { name: 'Load Network', url: 'https://www.load.network/', logo: '/load-network-logo.svg', description: 'High performance EVM storage chain' },
    { name: 'Solana Mobile', url: 'https://solanamobile.com/', logo: '/Solana_logo.png', description: 'Mobile app storage and distribution' }
  ];


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
      title: 'Buy Credits with Fiat & Crypto',
      description: 'Add credits to your account using credit cards or multiple cryptocurrencies. Instant processing with competitive rates.',
      benefits: ['Credit cards accepted', 'Multiple cryptocurrencies', 'Instant credits'],
      action: 'topup',
      loginText: 'Buy Credits',
      connectText: 'Connect Wallet to Top Up'
    },
    {
      name: 'Upload',
      icon: Upload,
      title: 'Upload Files & Folders',
      description: 'Drag and drop files for permanent storage on Arweave. Batch uploads with real-time progress tracking, x402 instant payments and instant receipts.',
      benefits: ['Drag & drop interface', 'Batch uploads', 'x402 instant payments', 'Instant receipts'],
      action: 'upload',
      loginText: 'Upload Files',
      connectText: 'Connect Wallet to Upload'
    },
    {
      name: 'Deploy',
      icon: Zap,
      title: 'Deploy Sites to the Permaweb',
      description: 'Deploy complete websites with automatic manifest creation and permanent hosting. Perfect for static sites, SPAs, and documentation.',
      benefits: ['Permanent hosting', 'Automatic manifests', 'Custom fallback pages', 'Domain name assignment'],
      action: 'deploy',
      loginText: 'Deploy Site',
      connectText: 'Connect Wallet to Deploy'
    },
    {
      name: 'Capture',
      icon: Camera,
      title: 'Capture & Archive Webpages',
      description: 'Preserve any webpage as a full-page screenshot on Arweave. Perfect for archiving content, preserving evidence, or creating permanent snapshots of the web.',
      benefits: ['Full-page screenshots', 'Web page archival', 'Smart domain assignment'],
      action: 'capture',
      loginText: 'Capture Webpage',
      connectText: 'Connect Wallet to Capture'
    },
    {
      name: 'Share',
      icon: Users,
      title: 'Share Credits Between Wallets',
      description: 'Delegate credits to other wallets for collaborative uploads and payments. Set time-based expiration and revoke anytime.',
      benefits: ['Wallet-to-wallet sharing', 'Time-based expiration', 'Revoke anytime'],
      action: 'share',
      loginText: 'Share Credits',
      connectText: 'Connect Wallet to Share'
    },
    {
      name: 'Gift',
      icon: Gift,
      title: 'Send Credits as Gifts',
      description: 'Send credits to anyone via email with optional personal messages. Recipients can redeem with any wallet.',
      benefits: ['Email delivery', 'Custom messages', 'Any amount'],
      action: 'gift',
      loginText: 'Send Gift',
      connectText: 'Connect Wallet to Send Gifts'
    },
    {
      name: 'Redeem',
      icon: Ticket,
      title: 'Redeem Gift Codes',
      description: 'Enter gift codes received via email to add credits to your wallet. Simple redemption process with instant credit delivery.',
      benefits: ['Shared via Gift email', 'Instant delivery', 'Any wallet you want'],
      action: 'redeem',
      loginText: 'Redeem Gift Code',
      connectText: 'Redeem Gift Code'
    },
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
      action: 'gateway-info',
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
          <a
            href="https://cal.com/kempsterrrr/ar-io-ecosystem-intro"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative rounded-full bg-primary px-8 py-4 font-bold text-white hover:bg-primary/90 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center gap-2 text-lg"
          >
            <Phone className="w-5 h-5" />
            <span>Book a Demo</span>
          </a>

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

          {/* Subtle Try it Out link */}
          <div className="mt-3 text-center">
            <button
              onClick={() => navigate(loggedIn ? '/upload' : '/try')}
              className="text-sm text-foreground/80 hover:text-foreground underline decoration-foreground/40 hover:decoration-foreground inline-flex items-center gap-1.5 group transition-colors"
            >
              <span>or try uploading a file for free</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
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
          <h2 className="font-heading font-bold text-3xl mb-3 text-foreground">How does it work?</h2>
          <p className="text-lg text-foreground/80 max-w-3xl mx-auto">
            ar.io handles the complexity so you don't have to. Fund instantly, upload seamlessly, and access your data through a global gateway network.
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
              Access your data instantly with CDN-level performance through the decentralized AR.IO Network.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="https://ar.io/technology/"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative rounded-full bg-primary px-8 py-4 font-bold text-white hover:bg-primary/90 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center gap-2 text-lg"
          >
            <BookOpen className="w-5 h-5" />
            <span>Learn more</span>
          </a>

          <button
            className="rounded-full border border-border/20 px-8 py-4 font-medium flex items-center gap-2 hover:bg-card hover:border-foreground transition-all group"
            onClick={() => navigate(loggedIn ? '/upload' : '/try')}
          >
            <Upload className="w-5 h-5" />
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

        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Free Tier */}
          <div className="bg-card rounded-2xl border border-success/30 p-8 text-center">
            <div className="text-4xl font-heading font-bold text-success mb-2">FREE</div>
            <div className="text-lg text-foreground font-medium mb-1">
              {freeUploadLimitBytes > 0 ? `Up to ${formatFreeLimit(freeUploadLimitBytes)}` : 'Small files'}
            </div>
            <div className="text-sm text-foreground/80 mb-4">No wallet or credits required</div>
            <button
              onClick={() => navigate('/try')}
              className="inline-flex items-center gap-1 text-sm text-success hover:text-success/80 font-medium group"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Try it now</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Per GiB Pricing */}
          <div className="bg-card rounded-2xl border border-border/20 p-8 text-center">
            <div className="text-4xl font-heading font-bold text-primary mb-2">${pricePerGiB}</div>
            <div className="text-lg text-foreground font-medium mb-1">Per GiB</div>
            <div className="text-sm text-foreground/80 mb-4">Larger files & bulk storage</div>
            <button
              onClick={() => navigate('/calculator')}
              className="inline-flex items-center gap-1 text-sm text-foreground/80 hover:text-foreground font-medium group"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Calculate custom costs</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
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
                  if (feature.action === 'redeem' || feature.action === 'balances' || feature.action === 'gateway-info') {
                    navigate(`/${feature.action}`);
                  } else if (loggedIn) {
                    navigate(`/${feature.action}`);
                  } else {
                    setShowWalletModal(true);
                  }
                }} className={`px-6 py-2 rounded-full font-medium ${getFeatureColor().button}`}>
                  {(features[selectedFeatureIndex].action === 'redeem' || features[selectedFeatureIndex].action === 'balances' || features[selectedFeatureIndex].action === 'gateway-info')
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
                  if (feature.action === 'redeem' || feature.action === 'balances' || feature.action === 'gateway-info') {
                    navigate(`/${feature.action}`);
                  } else if (loggedIn) {
                    navigate(`/${feature.action}`);
                  } else {
                    setShowWalletModal(true);
                  }
                }} className={`px-6 py-2 rounded-full font-medium ${getFeatureColor().button}`}>
                  {(features[selectedFeatureIndex].action === 'redeem' || features[selectedFeatureIndex].action === 'balances' || features[selectedFeatureIndex].action === 'gateway-info')
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

      {/* ar.io by the Numbers */}
      <div className="mb-12">
        <div className="text-center mb-8">
          <h2 className="font-heading font-bold text-2xl text-foreground mb-2">ar.io by the Numbers</h2>
          <p className="text-foreground/80">Real performance metrics from production infrastructure</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-card rounded-2xl border border-border/20 p-6 text-center">
            <div className="text-3xl font-heading font-bold text-primary mb-1">20B+</div>
            <div className="text-sm text-foreground/80">Files uploaded to Arweave</div>
          </div>
          <div className="bg-card rounded-2xl border border-border/20 p-6 text-center">
            <div className="text-3xl font-heading font-bold text-primary mb-1">200TiB</div>
            <div className="text-sm text-foreground/80">Data stored</div>
          </div>
          <div className="bg-card rounded-2xl border border-border/20 p-6 text-center">
            <div className="text-3xl font-heading font-bold text-primary mb-1">~860</div>
            <div className="text-sm text-foreground/80">Files per second</div>
          </div>
          <div className="bg-card rounded-2xl border border-border/20 p-6 text-center">
            <div className="text-3xl font-heading font-bold text-primary mb-1">99.9%</div>
            <div className="text-sm text-foreground/80">Gateway uptime</div>
          </div>
        </div>
      </div>

      {/* Developer Resources Section */}
      <section className="mb-12">
        <div className="text-center mb-8">
          <h2 className="font-heading font-bold text-2xl text-foreground mb-2">Developer Resources</h2>
          <p className="text-foreground/80">Guides, APIs, and documentation to build on ar.io</p>
        </div>

        {/* Guides */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wider mb-4 text-center">Guides</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <a href="https://docs.ar.io/build/upload/bundling-services" target="_blank" rel="noopener noreferrer"
               className="bg-card border border-border/20 rounded-2xl p-5 hover:border-primary/50 transition-colors">
              <h4 className="font-heading font-bold mb-1 text-foreground">Getting Started</h4>
              <p className="text-sm text-foreground/80">Create your first upload integration.</p>
            </a>
            <a href="https://docs.ar.io/build/guides/hosting-decentralized-websites" target="_blank" rel="noopener noreferrer"
               className="bg-card border border-border/20 rounded-2xl p-5 hover:border-primary/50 transition-colors">
              <h4 className="font-heading font-bold mb-1 text-foreground">Host Websites</h4>
              <p className="text-sm text-foreground/80">Deploy your site to Arweave with ArNS.</p>
            </a>
            <a href="https://docs.ar.io/build/upload/advanced-uploading-with-turbo" target="_blank" rel="noopener noreferrer"
               className="bg-card border border-border/20 rounded-2xl p-5 hover:border-primary/50 transition-colors">
              <h4 className="font-heading font-bold mb-1 text-foreground">Advanced Uploading</h4>
              <p className="text-sm text-foreground/80">Code-first examples for uploads and payments.</p>
            </a>
            <a href="https://docs.ar.io/build/upload/turbo-credits" target="_blank" rel="noopener noreferrer"
               className="bg-card border border-border/20 rounded-2xl p-5 hover:border-primary/50 transition-colors">
              <h4 className="font-heading font-bold mb-1 text-foreground">Paying for Uploads</h4>
              <p className="text-sm text-foreground/80">Credits are the payment medium for uploads.</p>
            </a>
            <a href="https://docs.ar.io/build/access" target="_blank" rel="noopener noreferrer"
               className="bg-card border border-border/20 rounded-2xl p-5 hover:border-primary/50 transition-colors">
              <h4 className="font-heading font-bold mb-1 text-foreground">Accessing Data</h4>
              <p className="text-sm text-foreground/80">Resilient and decentralized access for apps.</p>
            </a>
            <a href="https://docs.ar.io/build/run-a-gateway" target="_blank" rel="noopener noreferrer"
               className="bg-card border border-border/20 rounded-2xl p-5 hover:border-primary/50 transition-colors">
              <h4 className="font-heading font-bold mb-1 text-foreground">Run a Gateway</h4>
              <p className="text-sm text-foreground/80">Join the network that powers permanent data.</p>
            </a>
          </div>
        </div>

        {/* APIs */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wider mb-4 text-center">API Reference</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <a href="https://upload.ardrive.io/api-docs" target="_blank" rel="noopener noreferrer"
               className="bg-card border border-border/20 rounded-2xl p-5 hover:border-primary/50 transition-colors flex items-start gap-3">
              <Upload className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-heading font-bold mb-1 text-foreground">Upload Service API</h4>
                <p className="text-sm text-foreground/80">Pay for signed data-items and post to Arweave.</p>
              </div>
            </a>
            <a href="https://payment.ardrive.io/api-docs" target="_blank" rel="noopener noreferrer"
               className="bg-card border border-border/20 rounded-2xl p-5 hover:border-primary/50 transition-colors flex items-start gap-3">
              <Wallet className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-heading font-bold mb-1 text-foreground">Payment Service API</h4>
                <p className="text-sm text-foreground/80">Top ups, fiat rates, supported currencies.</p>
              </div>
            </a>
            <a href="http://turbo-gateway.com/api-docs/" target="_blank" rel="noopener noreferrer"
               className="bg-card border border-border/20 rounded-2xl p-5 hover:border-primary/50 transition-colors flex items-start gap-3">
              <Server className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-heading font-bold mb-1 text-foreground">Gateway API</h4>
                <p className="text-sm text-foreground/80">General gateway endpoints for this Gateway.</p>
              </div>
            </a>
          </div>
        </div>

        {/* Learn - Compact grid */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wider mb-4 text-center">Learn</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <a href="https://docs.ar.io/learn/gateways" target="_blank" rel="noopener noreferrer"
               className="bg-card border border-border/20 rounded-xl p-4 hover:border-primary/50 transition-colors text-center">
              <Server className="w-5 h-5 text-primary mx-auto mb-2" />
              <h4 className="font-bold text-sm text-foreground">Gateways</h4>
            </a>
            <a href="https://docs.ar.io/learn/arns" target="_blank" rel="noopener noreferrer"
               className="bg-card border border-border/20 rounded-xl p-4 hover:border-primary/50 transition-colors text-center">
              <Globe2 className="w-5 h-5 text-primary mx-auto mb-2" />
              <h4 className="font-bold text-sm text-foreground">ArNS</h4>
            </a>
            <a href="https://docs.ar.io/learn/wayfinder" target="_blank" rel="noopener noreferrer"
               className="bg-card border border-border/20 rounded-xl p-4 hover:border-primary/50 transition-colors text-center">
              <Search className="w-5 h-5 text-primary mx-auto mb-2" />
              <h4 className="font-bold text-sm text-foreground">Wayfinder</h4>
            </a>
            <a href="https://docs.ar.io/build/upload/turbo-credits#credit-sharing" target="_blank" rel="noopener noreferrer"
               className="bg-card border border-border/20 rounded-xl p-4 hover:border-primary/50 transition-colors text-center">
              <Users className="w-5 h-5 text-primary mx-auto mb-2" />
              <h4 className="font-bold text-sm text-foreground">Credit Sharing</h4>
            </a>
            <a href="https://docs.ar.io/learn/what-is-ario" target="_blank" rel="noopener noreferrer"
               className="bg-card border border-border/20 rounded-xl p-4 hover:border-primary/50 transition-colors text-center">
              <Cloud className="w-5 h-5 text-primary mx-auto mb-2" />
              <h4 className="font-bold text-sm text-foreground">AR.IO Network</h4>
            </a>
            <a href="https://docs.ar.io/learn/ans-104-bundles" target="_blank" rel="noopener noreferrer"
               className="bg-card border border-border/20 rounded-xl p-4 hover:border-primary/50 transition-colors text-center">
              <Package className="w-5 h-5 text-primary mx-auto mb-2" />
              <h4 className="font-bold text-sm text-foreground">ANS-104</h4>
            </a>
          </div>
        </div>

        {/* Source Code - Compact row */}
        <div>
          <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wider mb-4 text-center">Source Code</h3>
          <div className="flex flex-wrap gap-3 justify-center">
            <a href="https://github.com/ardriveapp/turbo-sdk" target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-2 bg-card border border-border/20 rounded-full px-4 py-2 hover:border-primary/50 transition-colors">
              <Github className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm text-foreground">SDK</span>
            </a>
            <a href="https://github.com/ardriveapp/turbo-upload-service" target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-2 bg-card border border-border/20 rounded-full px-4 py-2 hover:border-primary/50 transition-colors">
              <Github className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm text-foreground">Upload Service</span>
            </a>
            <a href="https://github.com/ardriveapp/turbo-payment-service" target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-2 bg-card border border-border/20 rounded-full px-4 py-2 hover:border-primary/50 transition-colors">
              <Github className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm text-foreground">Payment Service</span>
            </a>
            <a href="https://github.com/ar-io/ar-io-node" target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-2 bg-card border border-border/20 rounded-full px-4 py-2 hover:border-primary/50 transition-colors">
              <Github className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm text-foreground">AR.IO Node</span>
            </a>
          </div>
        </div>
      </section>

      {/* ArDrive Section - For Non-Developers */}
      <section className="text-center bg-card rounded-2xl border border-border/20 p-4 sm:p-8">
        <div className="max-w-3xl mx-auto">
          <h3 className="font-heading font-bold text-xl text-foreground mb-3">Looking for a no-code solution?</h3>
          <p className="text-foreground/80 mb-6">
            ArDrive is the user-friendly app powered by ar.io. Upload, share, and publish your most important files permanently with a simple drag-and-drop interface. Manage smart domain names, create permanent websites, and organize your files—all without writing code.
          </p>
          <a
            href="https://ardrive.net/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-card hover:bg-card border border-border/20 rounded-2xl px-6 py-3 group transition-all hover:border-primary/50"
          >
            <img src="/ardrive-logo.png" alt="ArDrive" className="w-8 h-8" />
            <div className="text-left">
              <div className="font-bold text-foreground group-hover:text-primary transition-colors">Try ArDrive</div>
              <div className="text-xs text-foreground/80">A permanent dropbox</div>
            </div>
            <ArrowRight className="w-5 h-5 text-foreground/80 group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      </section>

      {/* Trusted by Industry Leaders */}
      <div className="mb-12">
        <div className="text-center mb-8">
          <h2 className="font-heading font-bold text-2xl text-foreground mb-2">Trusted by Web3 Leaders</h2>
          <p className="text-foreground/80">Powering critical infrastructure across the decentralized web</p>
        </div>

        <CompanyCarousel companies={companies} />
      </div>

      {/* Final CTA Section */}
      <section className="bg-card rounded-2xl border border-border/20 p-8 sm:p-12 text-center">
        <h2 className="font-heading font-bold text-3xl mb-4 text-foreground">Ready to build on ar.io?</h2>
        <p className="text-lg text-foreground/80 max-w-2xl mx-auto mb-8">
          Talk to our team about custom integrations, enterprise solutions, or technical guidance.
          We'll help you choose the right architecture for permanent data storage at scale.
        </p>
        <a
          href="https://cal.com/kempsterrrr/ar-io-ecosystem-intro"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 font-bold text-white hover:bg-primary/90 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl text-lg"
        >
          <Phone className="w-5 h-5" />
          <span>Book a Demo</span>
        </a>
      </section>

    </div>
  );
};

export default LandingPage;
