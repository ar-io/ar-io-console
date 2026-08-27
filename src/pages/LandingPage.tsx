import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { Fragment } from 'react';

// Real Pages template rendered in the hero browser frame — lazy so the template
// registry it pulls in doesn't weigh down the initial landing bundle.
const ArNSResolvedPreview = lazy(() => import('../components/ArNSResolvedPreview'));
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useTheme } from '../hooks/useTheme';
import WalletSelectionModal from '../components/modals/WalletSelectionModal';
import { useWincForOneGiB } from '../hooks/useWincForOneGiB';
import { useCreditsForFiat } from '../hooks/useCreditsForFiat';
import { useFreeUploadLimit, formatFreeLimit } from '../hooks/useFreeUploadLimit';
import {
  ArrowRight, Zap, Github,
  CreditCard, Users, Upload, Globe2, Search, Check, CheckCircle, Copy, ChevronDown, Info,
  Camera, BookOpen, Calculator, Compass, LayoutTemplate, Terminal,
  Tag, Layers, KeyRound, Loader2, Lock, XCircle,
  ChevronLeft, ChevronRight, RotateCw
} from 'lucide-react';
import { HeroBackground } from '../components/HeroBackground';
import { DiscordIcon } from '../components/DiscordIcon';
import useDebounce from '../hooks/useDebounce';
import { useArNSAvailability } from '../features/arns/hooks/useArNSAvailability';
import { isValidArNSName, lowerCaseDomain } from '../features/arns/utils';
import { useArNSPricing } from '../hooks/useArNSPricing';

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
  const [arnsQuery, setArnsQuery] = useState('');

  // The ArNS handle shown in the preview's address bar — matches the template
  // being rendered (reported up by ArNSResolvedPreview), so URL and content
  // agree. Deliberately NOT tied to the search box.
  const [heroName, setHeroName] = useState('yourname');

  // Defer loading the hero template preview (and its template-registry chunk)
  // until the browser is idle, so it never competes with the initial/critical
  // render. Falls back to a short timeout where requestIdleCallback is absent.
  const [heroPreviewReady, setHeroPreviewReady] = useState(false);
  useEffect(() => {
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setHeroPreviewReady(true), { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setHeroPreviewReady(true), 800);
    return () => window.clearTimeout(id);
  }, []);

  const handleArnsSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = arnsQuery.trim();
    navigate(q ? `/arns?q=${encodeURIComponent(q)}` : '/arns');
  };

  // Live ArNS availability for the homepage search (debounced, index-backed).
  const debounced = useDebounce(arnsQuery);
  const normalized = lowerCaseDomain(debounced);
  const validName = normalized.length > 0 && isValidArNSName(normalized);
  const { data: avail, isFetching } = useArNSAvailability(debounced);
  const { pricingTiers } = useArNSPricing();

  // "from ~$X/yr" figure: first-year lease USD for the typed name's length tier
  // (character length bucketed at 13+ to match the pricing tier structure).
  const year1USD = useMemo(() => {
    if (!validName || pricingTiers.length === 0) return undefined;
    const bucket = normalized.length > 12 ? 13 : normalized.length;
    const tier = pricingTiers.find((t) => t.characterLength === bucket);
    const usd = tier?.pricesInUSD.year1;
    return typeof usd === 'number' && usd > 0 ? usd : undefined;
  }, [validName, normalized, pricingTiers]);

  const formatUsd = (n: number) =>
    n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`;

  // Example ArNS domain price for the pricing section: an 8-character permabuy
  // (own it forever). Falls back to a dash while pricing loads.
  const domainPermabuyUSD = useMemo(() => {
    const tier = pricingTiers.find((t) => t.characterLength === 8);
    const usd = tier?.pricesInUSD?.permabuy;
    return typeof usd === 'number' && usd > 0 ? usd : undefined;
  }, [pricingTiers]);

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
      title: 'Register & Manage ArNS Names',
      description: 'Get a permanent, human-readable name — then do everything with it in-console: register and renew, point it at any content, add undernames, edit records, transfer or reassign, set it as your primary name, or grab one from a returned-name auction.',
      benefits: ['Register, renew & upgrade', 'Undernames & records', 'Transfer & primary names', 'Returned-name auctions'],
      action: 'domains',
      loginText: 'Explore Domains',
      connectText: 'Explore Domains'
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
      {/*
        Brand kit `framed-dark-hero`: deep-dark frame at 2.5rem radius, white
        copy, lavender emphasis, media, pill CTAs. `on-dark` switches the global
        focus outline to accent lavender — primary only reaches ~1.9:1 here.
      */}
      {/* rounded-panel on mobile: a 2.5rem radius on a ~340px-wide frame eats
          the corners and crowds the headline. Full 2.5rem from sm up. */}
      <div className="on-dark relative flex w-full flex-col items-center rounded-panel sm:rounded-hero bg-deep-dark px-6 sm:px-12 py-14 sm:py-20 overflow-hidden">
        {/* Memoized background to prevent flickering from parent re-renders */}
        <HeroBackground />
        {/* Main headline */}
        <h1 className="relative z-10 font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-center max-w-5xl leading-tight text-white">
          Scale on a <span className="italic text-accent-lavender">permanent</span> cloud
        </h1>

        {/* Subheadline */}
        <p className="relative z-10 mt-5 text-base sm:text-lg text-center max-w-3xl text-white/75 leading-relaxed">
          Storage, hosting, and domains for devs and teams.
        </p>

        {/* CTA Section */}
        <div className="relative z-10 mt-7 flex flex-col sm:flex-row items-center gap-4">
          {/* Pill CTAs, brand kit `primary_dark` / `secondary_dark`. Copy uses
              the kit's approved labels — "Read the documentation" is on its
              do-not-use list. */}
          <button
            onClick={() => navigate('/try')}
            className="group relative rounded-full bg-white px-8 py-4 font-bold text-foreground hover:opacity-90 transition-opacity shadow-lg flex items-center gap-2 text-lg cursor-pointer"
          >
            <Upload className="w-5 h-5" />
            <span>Try the app</span>
          </button>

          <a
            href="https://docs.ar.io/build/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-white/25 bg-white/10 px-8 py-4 font-medium text-white flex items-center gap-2 hover:bg-white/20 transition-colors group"
          >
            <BookOpen className="w-5 h-5" />
            <span>Read docs</span>
          </a>
        </div>

        {/* Terminal snippet - more integrated. On the deep-dark hero, bg-code-surface
            (#23232D) sits too close to the ground, so the panel is a tinted black
            with a white hairline instead. */}
        <div className="relative z-10 mt-8 w-full max-w-2xl">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-2 text-center">Quick Start</div>
          <div className="bg-black/40 border border-white/15 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
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
          <h2 className="font-heading font-extrabold text-2xl mb-2 text-foreground">How does it work?</h2>
          <p className="text-lg text-foreground/80 max-w-3xl mx-auto">
            Ar.io handles the complexity so you don't have to. Fund instantly, upload in one step, and access your permanent data through a decentralized CDN.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {/* Step 1: Fund */}
          <div className="bg-card border border-border/20 rounded-2xl p-6 hover:border-primary/50 transition-colors group">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-2xl font-bold text-foreground">1.</div>
              <h3 className="font-heading font-extrabold text-xl text-foreground">Fund</h3>
            </div>
            <p className="text-sm text-foreground/80">
              Buy Credits instantly with a card or crypto like ETH, SOL, ARIO, Stablecoins (via x402), and more — ready to upload in seconds.
            </p>
          </div>

          {/* Step 2: Bundle */}
          <div className="bg-card border border-border/20 rounded-2xl p-6 hover:border-primary/50 transition-colors group">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-2xl font-bold text-foreground">2.</div>
              <h3 className="font-heading font-extrabold text-xl text-foreground">Upload</h3>
            </div>
            <p className="text-sm text-foreground/80">
              Use your favorite Arweave, Ethereum, or Solana wallet to cryptographically sign and upload data.
            </p>
          </div>

          {/* Step 3: Settle */}
          <div className="bg-card border border-border/20 rounded-2xl p-6 hover:border-primary/50 transition-colors group">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-2xl font-bold text-foreground">3.</div>
              <h3 className="font-heading font-extrabold text-xl text-foreground">Settle</h3>
            </div>
            <p className="text-sm text-foreground/80">
              Your files are bundled and permanently stored on Arweave — timestamped, tamper-proof, and verifiable forever.
            </p>
          </div>

          {/* Step 4: Access */}
          <div className="bg-card border border-border/20 rounded-2xl p-6 hover:border-primary/50 transition-colors group">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-2xl font-bold text-foreground">4.</div>
              <h3 className="font-heading font-extrabold text-xl text-foreground">Access</h3>
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

      {/*
        Consecutive bands are wrapped as ONE child of the page root so they abut.
        The root uses `space-y-12`, which puts margin-top on every sibling after
        the first — between two full-bleed bands that renders as a white stripe
        cutting across them. Grouping them means space-y sees a single child and
        the lavender and warm-neutral bands meet edge to edge, which is the point
        of the kit's section rhythm. Note a plain `-mt-12` would NOT fix this:
        space-y's `.space-y-12 > :not([hidden]) ~ :not([hidden])` selector
        outranks a single utility class.
      */}
      <div>
      {/* ArNS spotlight — dedicated, conversion-focused domain section.
          Brand kit `lavender-wash-section`: a SECTION BACKGROUND, so it runs
          edge to edge rather than floating as a rounded card. (The hero is the
          opposite case — `framed-dark-hero` is deliberately inset at 2.5rem.) */}
      <div className="full-bleed bg-lavender-wash py-14 sm:py-20">
        <div className="mx-auto w-full max-w-site px-4 sm:px-6 lg:px-8">
          {/* SPLIT: copy + live search on the left, resolved-page mockup on the right */}
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            {/* LEFT — headline, subhead, live availability search */}
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                ArNS · Domains
              </div>
              <h2 className="mb-3 font-heading text-3xl font-extrabold text-foreground sm:text-4xl">
                One name. Every gateway.
              </h2>
              <p className="text-base leading-relaxed text-foreground/80 sm:text-lg">
                A &ldquo;dot-anything&rdquo; name — no registrar, no ICANN. <span className="font-mono text-foreground">yourname.ar.io</span> resolves across every ar.io gateway to your content on Arweave (IPFS coming soon), and stays reachable by the same name even if a host goes offline. Point it at an app deployment, a Pages site, or any TX ID / CID.
              </p>

              {/* Live availability search (primary conversion action) */}
              <form onSubmit={handleArnsSearch} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <label htmlFor="arns-home-search" className="sr-only">Search for an ArNS name</label>
                <div className="field flex flex-1 items-center rounded-full border border-primary/30 bg-background pl-5 pr-3 transition-colors focus-within:border-primary">
                  <input
                    id="arns-home-search"
                    type="text"
                    value={arnsQuery}
                    onChange={(e) => setArnsQuery(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="yourname"
                    className="min-w-0 flex-1 bg-transparent py-3 text-foreground placeholder:text-foreground/40"
                  />
                  <span className="select-none pl-1 font-medium text-foreground/60">.ar.io</span>
                </div>
                {/* One button that IS the live status + action — availability and
                    price are folded in, so there's no separate result row. */}
                {!validName ? (
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <Search className="h-4 w-4" /> Search names
                  </button>
                ) : isFetching || !avail ? (
                  <button
                    type="submit"
                    disabled
                    className="inline-flex cursor-wait items-center justify-center gap-2 whitespace-nowrap rounded-full bg-primary/60 px-6 py-3 font-semibold text-primary-foreground"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" /> Checking…
                  </button>
                ) : avail.available ? (
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <CheckCircle className="h-4 w-4" /> Register
                    {year1USD !== undefined && (
                      <span className="font-normal opacity-90">· ~{formatUsd(year1USD)}/yr</span>
                    )}
                  </button>
                ) : avail.reserved ? (
                  <button
                    type="button"
                    disabled
                    className="inline-flex cursor-not-allowed items-center justify-center gap-2 whitespace-nowrap rounded-full bg-foreground/10 px-6 py-3 font-semibold text-foreground/50"
                  >
                    Reserved
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-foreground/10 px-6 py-3 font-semibold text-foreground/80 transition-colors hover:bg-foreground/15"
                  >
                    <XCircle className="h-4 w-4 text-foreground/40" /> Taken · see options
                  </button>
                )}
              </form>

              {/* Screen-reader-only live status (the visual status lives in the button). */}
              <span className="sr-only" aria-live="polite">
                {validName && !isFetching && avail
                  ? avail.available
                    ? `${normalized}.ar.io is available`
                    : avail.reserved
                      ? `${normalized}.ar.io is reserved`
                      : `${normalized}.ar.io is taken`
                  : ''}
              </span>
            </div>

            {/* RIGHT — browser-frame mockup of a resolved ArNS page */}
            <div className="overflow-hidden rounded-2xl border border-primary/15 bg-background shadow-xl">
              {/* Title bar: traffic lights + nav buttons + live address bar */}
              <div className="flex items-center gap-2 border-b border-border/10 bg-card px-4 py-2.5">
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-error" />
                  <span className="h-3 w-3 rounded-full bg-warning" />
                  <span className="h-3 w-3 rounded-full bg-success" />
                </div>
                <div className="hidden flex-shrink-0 items-center gap-1 text-foreground/30 sm:flex">
                  <ChevronLeft className="h-4 w-4" />
                  <ChevronRight className="h-4 w-4" />
                  <RotateCw className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-1 items-center gap-1.5 truncate rounded-full border border-border/20 bg-background px-3 py-1 text-xs font-mono text-foreground/70">
                  <Lock className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{heroName}.ar.io</span>
                </div>
              </div>

              {/* Body — a REAL Pages template rendered exactly as it resolves at a
                  name (same renderPageHtml + iframe path as the Pages thumbnails).
                  Lazy-loaded AND deferred to idle (heroPreviewReady) so the
                  template-registry chunk never competes with the initial/critical
                  render — it only fetches once the page is interactive. A
                  decorative scrollbar sells it as a real, scrollable page. */}
              <div className="relative">
                {heroPreviewReady ? (
                  <Suspense
                    fallback={
                      <div className="h-[340px] animate-pulse bg-gradient-to-br from-primary/5 to-lavender/40" />
                    }
                  >
                    <ArNSResolvedPreview onHandle={setHeroName} />
                  </Suspense>
                ) : (
                  <div className="h-[340px] animate-pulse bg-gradient-to-br from-primary/5 to-lavender/40" />
                )}
                {/* Decorative scrollbar — thumb near the top (we show the top of the page) */}
                <div className="pointer-events-none absolute bottom-1.5 right-1 top-1.5 w-1.5 rounded-full bg-foreground/[0.06]">
                  <div className="h-1/3 w-full rounded-full bg-foreground/25" />
                </div>
              </div>
            </div>
          </div>

          {/* Value props — 3 compact cards + a "host anything" card */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5">
            {[
              { icon: Tag, label: 'Human-readable', copy: 'a name, not a 43-character TX ID or CID.' },
              { icon: Globe2, label: 'Resolves everywhere', copy: 'served by every ar.io gateway, with cryptographic verification.' },
              { icon: KeyRound, label: 'Own or lease', copy: 'you hold the ANT (an NFT you control); buy it outright or lease by the year.' },
            ].map(({ icon: Icon, label, copy }) => (
              <div key={label} className="flex items-start gap-3 rounded-2xl border border-primary/10 bg-background/60 p-4">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">{label}</div>
                  <div className="text-sm leading-snug text-foreground/70">{copy}</div>
                </div>
              </div>
            ))}

            {/* What you can host — replaces the old use-case pills */}
            <div className="rounded-2xl border border-primary/10 bg-background/60 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Layers className="h-5 w-5 text-primary" />
                </div>
                <div className="font-semibold text-foreground">Point it at anything</div>
              </div>
              <ul className="space-y-2 text-sm leading-snug text-foreground/70">
                <li className="flex items-baseline gap-2">
                  <span className="font-mono text-xs text-primary/80">yourname.ar.io</span>
                  <span className="text-foreground/40">—</span> a Pages site
                </li>
                <li className="flex items-baseline gap-2">
                  <span className="font-mono text-xs text-primary/80">app.yourname.ar.io</span>
                  <span className="text-foreground/40">—</span> a deployed app
                </li>
                <li className="flex items-baseline gap-2">
                  <span className="font-mono text-xs text-primary/80">agent.yourname.ar.io</span>
                  <span className="text-foreground/40">—</span> your agent&rsquo;s dataset
                </li>
              </ul>
            </div>
          </div>

          {/* Secondary links */}
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <button
              onClick={() => navigate('/pricing?type=domains')}
              className="inline-flex items-center gap-1.5 font-semibold text-primary transition-opacity hover:opacity-80"
            >
              See name prices <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <a
              href="https://docs.ar.io/learn/arns"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-foreground/70 transition-colors hover:text-foreground"
            >
              Learn about ArNS <BookOpen className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Pricing Section — Warm Neutral band (#F6F4EF). The kit files this
          surface under "softer explanatory sections and transitions between
          high-contrast bands", which is exactly this slot: it sits between the
          lavender-wash ArNS band and the white feature explorer. Content is
          unchanged; only the band around it is new. */}
      <div className="full-bleed bg-warm-neutral py-14 sm:py-20">
        <div className="mx-auto w-full max-w-site px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="font-heading font-extrabold text-2xl text-foreground mb-2">Transparent Pricing</h2>
          <p className="text-foreground/80">Pay-as-you-go storage with no subscriptions, now with x402</p>
        </div>

        {/*
          Border-divided rows rather than a 3-card grid. Brand kit: "Prefer rules
          and dividers over cards. Border-divided rows read as editorial; boxes
          in a grid read as generated." Rows sit on the warm-neutral band, a
          light surface, so the divider is the brand's Subtle Border rather than
          border-border/20.
        */}
        <div className="mx-auto max-w-4xl border-t border-subtle-border">
          {/* Free tier */}
          <div className="grid grid-cols-1 items-baseline gap-x-6 gap-y-1 border-b border-subtle-border py-6 sm:grid-cols-[minmax(9rem,11rem)_1fr_auto]">
            <div className="font-heading text-4xl font-extrabold leading-none text-success">FREE</div>
            <div>
              <div className="font-semibold text-foreground">
                {freeUploadLimitBytes > 0 ? `Up to ${formatFreeLimit(freeUploadLimitBytes)} per file` : 'Small files'}
              </div>
              <div className="text-sm text-foreground/70">
                {freeTier.lifetimeBytes > 0
                  ? `${formatFreeLimit(freeTier.lifetimeBytes)} lifetime limit`
                  : 'No wallet or credits required'}
              </div>
            </div>
            <button
              onClick={() => navigate('/try')}
              className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-success transition-opacity hover:opacity-80 justify-self-start sm:justify-self-end"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Try it now</span>
            </button>
          </div>

          {/* Per GiB */}
          <div className="grid grid-cols-1 items-baseline gap-x-6 gap-y-1 border-b border-subtle-border py-6 sm:grid-cols-[minmax(9rem,11rem)_1fr_auto]">
            <div className="font-heading text-4xl font-extrabold leading-none tabular-nums text-primary">${pricePerGiB}</div>
            <div>
              <div className="font-semibold text-foreground">Per GiB</div>
              <div className="text-sm text-foreground/70">Larger files &amp; bulk storage</div>
            </div>
            <button
              onClick={() => navigate('/pricing')}
              className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-foreground/80 transition-colors hover:text-foreground justify-self-start sm:justify-self-end"
            >
              <Calculator className="h-3.5 w-3.5" />
              <span>Calculate your costs</span>
            </button>
          </div>

          {/* Domain name — an 8-char permabuy (own it forever) */}
          <div className="grid grid-cols-1 items-baseline gap-x-6 gap-y-1 border-b border-subtle-border py-6 sm:grid-cols-[minmax(9rem,11rem)_1fr_auto]">
            <div className="font-heading text-4xl font-extrabold leading-none tabular-nums text-primary">
              {domainPermabuyUSD !== undefined ? formatUsd(domainPermabuyUSD) : '—'}
            </div>
            <div>
              <div className="font-semibold text-foreground">Domain name</div>
              <div className="text-sm text-foreground/70">8-character name, no renewals</div>
            </div>
            <button
              onClick={() => navigate('/pricing?type=domains')}
              className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-primary transition-opacity hover:opacity-80 justify-self-start sm:justify-self-end"
            >
              <Tag className="h-3.5 w-3.5" />
              <span>See name prices</span>
            </button>
          </div>
        </div>
        </div>
      </div>
      </div>{/* end grouped ArNS + Pricing bands */}

      {/* Interactive Feature Explorer */}
      <div className="mb-12">
        {/* Section Header */}
        <div className="text-center mb-6">
          <h2 className="font-heading font-extrabold text-2xl text-foreground mb-2">What's in the Console</h2>
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
                <h3 className="font-heading font-extrabold text-xl text-foreground mb-2">{features[selectedFeatureIndex].title}</h3>
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
                <h3 className="font-heading font-extrabold text-xl text-foreground mb-2">{features[selectedFeatureIndex].title}</h3>
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

      {/* Builder's Journey Section — Lavender Wash band (#f1ecff), the kit's
          surface for "system diagrams" and how-it-works content, which is
          exactly what the snake-line grid is. The diagram, its cells, the SVG
          path and every interaction are untouched; the cells are already
          bg-white, so they read as the kit's "white cards on lavender wash"
          without any change. This band also breaks up what would otherwise be
          three consecutive white sections (pricing → explorer → journey). */}
      {/* Grouped with the charcoal agents band below so the two abut — see the
          note on the ArNS + Pricing group for why space-y-12 forces this. */}
      <div>
      <section className="full-bleed bg-lavender-wash py-14 sm:py-20">
        <div className="mx-auto w-full max-w-site px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="font-heading font-extrabold text-2xl text-foreground mb-2">Builder's Journey</h2>
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
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-heading font-extrabold text-sm shadow-md">
                  1
                </div>
                <p className="text-xs text-foreground/80 text-center mb-3 leading-snug">Learn the fundamentals of ar.io</p>
                <a
                  href="https://docs.ar.io/learn/what-is-ario/"
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
                  <div className="w-24 h-24 bg-card border-2 border-primary/20 rounded-2xl p-3 transition-all duration-200 group-hover:-translate-y-1 group-hover:border-primary group-hover:shadow-lg relative flex items-center justify-center">
                    <div className="absolute -top-2.5 -left-2.5 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-heading font-extrabold text-xs shadow-md">
                      {step.num}
                    </div>
                    <p className="text-[11px] text-foreground/70 leading-snug text-center">{step.desc}</p>
                  </div>
                </a>
              ))}

              {/* Cell 9: Join Community - solid purple background (larger) */}
              <div className="h-36 bg-primary rounded-xl p-4 relative flex flex-col items-center justify-center shadow-lg">
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-white text-primary flex items-center justify-center font-heading font-extrabold text-sm shadow-md">
                  9
                </div>
                <p className="text-xs text-white/90 text-center mb-3 leading-snug">Join the ar.io open source community</p>
                <div className="flex flex-col gap-2 w-full">
                  <a href="https://discord.com/invite/HGG52EtTc2" target="_blank" rel="noopener noreferrer"
                     className="flex items-center justify-center gap-1.5 bg-white text-primary rounded-lg px-3 py-2 hover:bg-white/90 transition-all text-xs font-medium">
                    <DiscordIcon className="w-4 h-4" />
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
              <a href="https://docs.ar.io/learn/what-is-ario/" target="_blank" rel="noopener noreferrer" className="block group">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-heading font-extrabold text-xs shadow-md shrink-0">
                    1
                  </div>
                  <div className="flex-1 bg-white border-2 border-primary/30 rounded-lg px-3 py-3 group-hover:border-primary/50 transition-colors">
                    <p className="text-xs text-foreground/80 mb-2"><strong className="text-foreground">Learn</strong> the fundamentals of ar.io</p>
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
                    <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-heading font-extrabold text-xs shadow-md shrink-0">
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
                <div className="w-7 h-7 rounded-full bg-white text-primary flex items-center justify-center font-heading font-extrabold text-xs shadow-md shrink-0">
                  9
                </div>
                <div className="flex-1 bg-primary rounded-lg px-3 py-3">
                  <p className="text-xs text-white/90 mb-2"><strong className="text-white">Join</strong> the community</p>
                  <div className="flex gap-2">
                    <a href="https://discord.com/invite/HGG52EtTc2" target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-1.5 bg-white text-primary rounded-lg px-3 py-1.5 hover:bg-white/90 transition-all text-xs font-medium">
                      <DiscordIcon className="w-3.5 h-3.5" />
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
        </div>
      </section>

      {/* For AI agents & LLMs — full-bleed charcoal band */}
      <AgentDocsSection />
      </div>{/* end grouped Journey + agents bands */}

      {/* ArDrive — sibling consumer app for permanent file storage. A compact
          horizontal strip so it reads as a footer cross-link, not a second
          feature card stacked under the dark agents section above. */}
      <section className="flex flex-col gap-4 rounded-2xl border border-border/20 bg-gradient-to-r from-primary/[0.06] to-card p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        <img src={`${import.meta.env.BASE_URL}ardrive-logo.png`} alt="ArDrive" loading="lazy" decoding="async" className="h-14 w-14 flex-shrink-0" />
        <div className="flex-1 text-center sm:text-left">
          <h3 className="font-heading text-lg font-extrabold text-foreground">Just want to store files?</h3>
          <p className="mt-1 text-sm leading-relaxed text-foreground/70">
            ArDrive is a permanent file drive — drag, drop, organize, and share files and
            folders that last forever. All the permanence of the permaweb, in a friendly app
            anyone can use.
          </p>
        </div>
        <a
          href="https://app.ardrive.io"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex flex-shrink-0 items-center justify-center gap-2 self-center rounded-full border border-border/30 bg-background px-5 py-2.5 font-semibold text-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          Try ArDrive
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </a>
      </section>

      {/*
        Final CTA — brand kit `dark-radial-section`: deep dark ground, white
        copy, lavender accents, radial purple glow, pill CTAs, and extra vertical
        breathing room. Anchors the page so it doesn't trail off on the ArDrive
        cross-link.
      */}
      <section className="on-dark relative overflow-hidden rounded-panel sm:rounded-hero bg-deep-dark px-5 py-16 text-center sm:px-10 sm:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(55% 60% at 50% 0%, rgb(84 39 200 / 0.5), transparent 70%)',
          }}
        />
        <div className="relative z-10">
          <h2 className="mx-auto max-w-[18ch] font-heading text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl">
            Put something permanent on the network
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-white/75 sm:text-lg">
            Your first upload is free. No wallet required.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={() => navigate('/try')}
              className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-bold text-foreground transition-opacity hover:opacity-90"
            >
              <Upload className="h-5 w-5" />
              <span>Try the app</span>
            </button>
            <a
              href="https://docs.ar.io/build/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-8 py-4 font-medium text-white transition-colors hover:bg-white/20"
            >
              <Terminal className="h-5 w-5" />
              <span>Start building</span>
            </a>
          </div>
        </div>
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
    /*
     * Charcoal (#23232D) is one of the kit's `section_backgrounds` — "trust,
     * proof, and high-emphasis sections" — so this is a full-bleed BAND, not a
     * dark card floating on white. Same reasoning as the ArNS lavender band.
     * `on-dark` switches the global focus outline to accent lavender, since
     * primary doesn't clear contrast on this ground.
     */
    <section className="full-bleed on-dark bg-foreground text-white">
      <div className="mx-auto grid w-full max-w-site items-center gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:px-8">
        {/* Pitch */}
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1">
            <Terminal className="h-3.5 w-3.5 text-lavender" />
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">
              For AI agents &amp; LLMs
            </span>
          </div>
          <h2 className="mb-3 font-heading text-2xl font-extrabold sm:text-3xl">Point your agent at ar.io</h2>
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
