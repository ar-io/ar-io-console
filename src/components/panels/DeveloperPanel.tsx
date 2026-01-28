import { useState } from 'react';
import { ExternalLink, Code, Copy, Check, Database, Zap, Rss, Globe, Wrench, Edit3, Info } from 'lucide-react';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { useStore } from '../../store/useStore';
import CopyButton from '../CopyButton';

export default function DeveloperPanel() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'quickstart' | 'api' | 'guides' | 'horizon' | 'configuration'>('quickstart');

  // Developer configuration state
  const {
    configMode,
    setConfigMode,
    updateCustomConfig,
    updateTokenMap,
    getCurrentConfig,
    resetToDefaults,
    x402OnlyMode,
    setX402OnlyMode
  } = useStore();

  const currentConfig = getCurrentConfig();
  const handleModeChange = (mode: 'production' | 'development' | 'custom') => {
    setConfigMode(mode);
    // Reset x402-only mode when switching to production
    if (mode === 'production') {
      setX402OnlyMode(false);
    }
  };

  const applyConfiguration = () => {
    // Force a page reload to ensure all components reinitialize with new config
    window.location.reload();
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const codeExamples = {
    install: `npm install @ardrive/turbo-sdk`,
    quickStart: `import { TurboFactory } from '@ardrive/turbo-sdk';

// Initialize Turbo client
const turbo = TurboFactory.authenticated({
  privateKey: process.env.PRIVATE_KEY,
});

// Upload a file
const uploadResult = await turbo.uploadFile({
  fileStreamFactory: () => fs.createReadStream('./my-file.pdf'),
  fileSizeFactory: () => fs.statSync('./my-file.pdf').size,
});

console.log('Upload ID:', uploadResult.id);`,

    topUp: `// Top up with fiat currency
const checkout = await turbo.createCheckoutSession({
  amount: 10.00, // USD
  currency: 'usd',
  email: 'user@example.com',
});

// Top up with crypto
const payment = await turbo.submitFundTransaction({
  txId: 'your-transaction-id',
});`,

    upload: `// Upload data directly
const dataItem = await turbo.uploadSignedDataItem({
  dataItemStreamFactory: () => fs.createReadStream('./data.json'),
  dataItemSizeFactory: () => fs.statSync('./data.json').size,
});

// Check upload status
const status = await turbo.getUploadStatus({ id: dataItem.id });
console.log('Status:', status);`,

    folder: `// Upload a folder
const folderUpload = await turbo.uploadFolder({
  folderPath: './my-folder',
  dataItemOpts: {
    tags: [
      { name: 'Content-Type', value: 'application/x-directory' },
      { name: 'App-Name', value: 'MyApp' }
    ]
  }
});

console.log('Folder manifest ID:', folderUpload.id);`,
  };

  return (
    <div className="px-4 sm:px-6">
      {/* Inline Header with Description */}
      <div className="flex items-start gap-3 mb-4 sm:mb-6">
        <div className="w-10 h-10 bg-primary/20 rounded-2xl flex items-center justify-center flex-shrink-0 mt-1">
          <Code className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-2xl font-heading font-bold text-foreground mb-1">Developer Resources</h3>
          <p className="text-sm text-foreground/80">
            Integrate ar.io into your applications with our SDK, APIs, and developer tools
          </p>
        </div>
      </div>

      {/* Main Content Container with Gradient */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl border border-primary/30 p-4 sm:p-6 mb-4 sm:mb-6">

      {/* Tab Navigation */}
      <div className="flex gap-2 sm:gap-4 mb-4 sm:mb-6 border-b border-border/20 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveTab('quickstart')}
          className={`pb-2 px-2 sm:px-1 transition-colors whitespace-nowrap ${
            activeTab === 'quickstart'
              ? 'text-foreground border-b-2 border-primary'
              : 'text-foreground/80 hover:text-foreground'
          }`}
        >
          <span className="hidden sm:inline">Quick Start</span>
          <span className="sm:hidden">Start</span>
        </button>
        <button
          onClick={() => setActiveTab('api')}
          className={`pb-2 px-2 sm:px-1 transition-colors whitespace-nowrap ${
            activeTab === 'api'
              ? 'text-foreground border-b-2 border-primary'
              : 'text-foreground/80 hover:text-foreground'
          }`}
        >
          <span className="hidden sm:inline">API Endpoints</span>
          <span className="sm:hidden">API</span>
        </button>
        <button
          onClick={() => setActiveTab('guides')}
          className={`pb-2 px-2 sm:px-1 transition-colors whitespace-nowrap ${
            activeTab === 'guides'
              ? 'text-foreground border-b-2 border-primary'
              : 'text-foreground/80 hover:text-foreground'
          }`}
        >
          Guides
        </button>
        <button
          onClick={() => setActiveTab('configuration')}
          className={`pb-2 px-2 sm:px-1 transition-colors whitespace-nowrap ${
            activeTab === 'configuration'
              ? 'text-foreground border-b-2 border-primary'
              : 'text-foreground/80 hover:text-foreground'
          }`}
        >
          <span className="hidden sm:inline">Configuration</span>
          <span className="sm:hidden">Config</span>
        </button>
        <button
          onClick={() => setActiveTab('horizon')}
          className={`pb-2 px-2 sm:px-1 transition-colors whitespace-nowrap ${
            activeTab === 'horizon'
              ? 'text-foreground border-b-2 border-primary'
              : 'text-foreground/80 hover:text-foreground'
          }`}
        >
          <span className="hidden sm:inline">On the Horizon</span>
          <span className="sm:hidden">Future</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'quickstart' && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Installation</h4>
              <button
                onClick={() => copyToClipboard(codeExamples.install, 'install')}
                className="text-foreground/80 hover:text-primary transition-colors p-1 rounded"
              >
                {copiedCode === 'install' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="bg-black rounded-2xl p-4 border border-border/20">
              <pre className="text-xs overflow-x-auto font-mono text-gray-100">
                <code>{codeExamples.install}</code>
              </pre>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Basic Upload</h4>
              <button
                onClick={() => copyToClipboard(codeExamples.quickStart, 'quickstart')}
                className="text-foreground/80 hover:text-primary transition-colors p-1 rounded"
              >
                {copiedCode === 'quickstart' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="bg-black rounded-2xl p-4 border border-border/20">
              <pre className="text-xs overflow-x-auto font-mono text-gray-100">
                <code>{codeExamples.quickStart}</code>
              </pre>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Create Top-Up</h4>
              <button
                onClick={() => copyToClipboard(codeExamples.topUp, 'topup')}
                className="text-foreground/80 hover:text-primary transition-colors p-1 rounded"
              >
                {copiedCode === 'topup' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="bg-black rounded-2xl p-4 border border-border/20">
              <pre className="text-xs overflow-x-auto font-mono text-gray-100">
                <code>{codeExamples.topUp}</code>
              </pre>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Upload Folder</h4>
              <button
                onClick={() => copyToClipboard(codeExamples.folder, 'folder')}
                className="text-foreground/80 hover:text-primary transition-colors p-1 rounded"
              >
                {copiedCode === 'folder' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="bg-black rounded-2xl p-4 border border-border/20">
              <pre className="text-xs overflow-x-auto font-mono text-gray-100">
                <code>{codeExamples.folder}</code>
              </pre>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'api' && (
        <div className="space-y-4">
          {/* Upload Service API */}
          <div className="bg-card rounded-2xl p-4 border border-border/20">
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-medium text-foreground">Upload Service API</h5>
              <a href="https://upload.ardrive.io/api-docs" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 text-foreground/80 hover:text-primary transition-colors" />
              </a>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-primary/20 text-primary text-xs font-semibold rounded">POST</span>
                <code className="text-sm text-foreground">/tx</code>
                <span className="text-xs text-foreground/80">Upload signed data item</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-primary/15 text-primary text-xs font-semibold rounded">GET</span>
                <code className="text-sm text-foreground">/tx/:id/status</code>
                <span className="text-xs text-foreground/80">Check upload status</span>
              </div>
            </div>
          </div>

          {/* Payment Service API */}
          <div className="bg-card rounded-2xl p-4 border border-border/20">
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-medium text-foreground">Payment Service API</h5>
              <a href="https://payment.ardrive.io/api-docs" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 text-foreground/80 hover:text-primary transition-colors" />
              </a>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-primary/15 text-primary text-xs font-semibold rounded">GET</span>
                <code className="text-sm text-foreground">/price/{"{currency}/{amount}"}</code>
                <span className="text-xs text-foreground/80">Get fiat conversion rates</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-primary/20 text-primary text-xs font-semibold rounded">POST</span>
                <code className="text-sm text-foreground">/top-up/payment-intent</code>
                <span className="text-xs text-foreground/80">Create payment session</span>
              </div>
            </div>
          </div>

          {/* Gateway Services API */}
          <div className="bg-card rounded-2xl p-4 border border-border/20">
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-medium text-foreground">Gateway Services API</h5>
              <a href="https://turbo-gateway.com/api-docs" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 text-foreground/80 hover:text-primary transition-colors" />
              </a>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-primary/15 text-primary text-xs font-semibold rounded">GET</span>
                <code className="text-sm text-foreground">/{"{txId}"}</code>
                <span className="text-xs text-foreground/80">Retrieve data by transaction ID</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-primary/20 text-primary text-xs font-semibold rounded">POST</span>
                <code className="text-sm text-foreground">/tx</code>
                <span className="text-xs text-foreground/80">Submit transaction to network</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-primary/15 text-primary text-xs font-semibold rounded">GET</span>
                <code className="text-sm text-foreground">/ar-io/resolver/{"{name}"}</code>
                <span className="text-xs text-foreground/80">Resolve ArNS name</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-primary/20 text-primary text-xs font-semibold rounded">POST</span>
                <code className="text-sm text-foreground">/graphql</code>
                <span className="text-xs text-foreground/80">GraphQL query interface</span>
              </div>
            </div>
          </div>

          {/* Capture Service API */}
          <div className="bg-card rounded-2xl p-4 border border-border/20">
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-medium text-foreground">Capture Service API</h5>
              <a href={`${currentConfig.captureServiceUrl}/api-docs/`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 text-foreground/80 hover:text-primary transition-colors" />
              </a>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-primary/20 text-primary text-xs font-semibold rounded">POST</span>
                <code className="text-sm text-foreground">/screenshot</code>
                <span className="text-xs text-foreground/80">Capture full-page screenshot</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'guides' && (
        <div className="grid md:grid-cols-2 gap-4">
          <a href="https://docs.ar.io/build/upload/bundling-services" target="_blank" rel="noopener noreferrer"
             className="bg-card rounded-2xl p-4 hover:bg-card/80 transition-colors border border-border/20 hover:border-primary/50">
            <div className="text-xs text-foreground/80 uppercase tracking-wider mb-2">START</div>
            <h5 className="font-bold mb-2 text-foreground">Getting Started</h5>
            <p className="text-xs text-foreground/80">Build your first upload integration.</p>
          </a>

          <a href="https://docs.ar.io/build/upload/turbo-credits" target="_blank" rel="noopener noreferrer"
             className="bg-card rounded-2xl p-4 hover:bg-card/80 transition-colors border border-border/20 hover:border-primary/50">
            <div className="text-xs text-foreground/80 uppercase tracking-wider mb-2">PAY</div>
            <h5 className="font-bold mb-2 text-foreground">Paying for Uploads</h5>
            <p className="text-xs text-foreground/80">Credits are the payment medium used by the upload service.</p>
          </a>

          <a href="https://docs.ar.io/build/guides/hosting-decentralized-websites" target="_blank" rel="noopener noreferrer"
             className="bg-card rounded-2xl p-4 hover:bg-card/80 transition-colors border border-border/20 hover:border-primary/50">
            <div className="text-xs text-foreground/80 uppercase tracking-wider mb-2">DEPLOY</div>
            <h5 className="font-bold mb-2 text-foreground">Host Decentralized Websites</h5>
            <p className="text-xs text-foreground/80">Deploy your webpage or app Arweave with ArNS.</p>
          </a>

          <a href="https://docs.ar.io/build/access" target="_blank" rel="noopener noreferrer"
             className="bg-card rounded-2xl p-4 hover:bg-card/80 transition-colors border border-border/20 hover:border-primary/50">
            <div className="text-xs text-foreground/80 uppercase tracking-wider mb-2">ACCESS</div>
            <h5 className="font-bold mb-2 text-foreground">Accessing Data</h5>
            <p className="text-xs text-foreground/80">Resilient and decentralized access for your apps.</p>
          </a>

          <a href="https://docs.ar.io/build/upload/advanced-uploading-with-turbo" target="_blank" rel="noopener noreferrer"
             className="bg-card rounded-2xl p-4 hover:bg-card/80 transition-colors border border-border/20 hover:border-primary/50">
            <div className="text-xs text-foreground/80 uppercase tracking-wider mb-2">ADVANCED</div>
            <h5 className="font-bold mb-2 text-foreground">Advanced Uploading</h5>
            <p className="text-xs text-foreground/80">Code-first examples for paying for and uploading files.</p>
          </a>

          <a href="https://docs.ar.io/build/run-a-gateway" target="_blank" rel="noopener noreferrer"
             className="bg-card rounded-2xl p-4 hover:bg-card/80 transition-colors border border-border/20 hover:border-primary/50">
            <div className="text-xs text-foreground/80 uppercase tracking-wider mb-2">OPERATE</div>
            <h5 className="font-bold mb-2 text-foreground">Run a Gateway</h5>
            <p className="text-xs text-foreground/80">Join the decentralized network that powers permanent data.</p>
          </a>
        </div>
      )}

      {activeTab === 'horizon' && (
        <div className="space-y-4">
          <p className="text-sm text-foreground/80 mb-4 sm:mb-6">
            We're expanding the ar.io platform with new services to enhance your development experience
          </p>

          <div className="space-y-4">
            <div className="bg-card rounded-2xl p-4 border border-border/20">
              <div className="flex items-start gap-3">
                <Database className="w-6 h-6 text-foreground/80 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-bold text-foreground text-lg mb-1">Data Indexer</div>
                  <div className="text-sm text-foreground/80">Register custom on-chain indexes of Arweave data using AR.IO gateways</div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-4 border border-border/20">
              <div className="flex items-start gap-3">
                <Zap className="w-6 h-6 text-foreground/80 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-bold text-foreground text-lg mb-1">Fast Lane</div>
                  <div className="text-sm text-foreground/80">
                    Avoid rate limits for you and your data with priority access and dedicated bandwidth with{' '}
                    <a
                      href="https://www.coinbase.com/developer-platform/products/x402"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground hover:text-primary transition-colors underline"
                    >
                      x402
                    </a>
                    .
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-4 border border-border/20">
              <div className="flex items-start gap-3">
                <Rss className="w-6 h-6 text-foreground/80 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-bold text-foreground text-lg mb-1">Data Feeds</div>
                  <div className="text-sm text-foreground/80">Subscribe to real-time notifications for new data uploads</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 sm:mt-6 pt-4 border-t border-border/20 text-center">
            <div className="text-xs text-foreground/80">
              Stay tuned for updates on these upcoming features
            </div>
          </div>
        </div>
      )}

      {activeTab === 'configuration' && (
        <div className="space-y-6">
          {/* Environment Configuration Panel */}
          <div>
            <h4 className="text-lg font-semibold font-heading text-foreground mb-4">Environment Configuration</h4>
            <p className="text-sm text-foreground/80 mb-2">
              Switch between environments or configure custom endpoints for development and testing
            </p>

            {/* Mode Selection */}
            <div className="flex justify-center mb-4 sm:mb-6">
              <div className="inline-flex bg-card rounded-2xl p-1 border border-border/20">
                <button
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    configMode === 'production'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground/80 hover:text-foreground'
                  }`}
                  onClick={() => handleModeChange('production')}
                >
                  <Globe className="w-4 h-4 inline mr-2" />
                  Production
                </button>
                <button
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    configMode === 'development'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground/80 hover:text-foreground'
                  }`}
                  onClick={() => handleModeChange('development')}
                >
                  <Wrench className="w-4 h-4 inline mr-2" />
                  Development
                </button>
                <button
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    configMode === 'custom'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground/80 hover:text-foreground'
                  }`}
                  onClick={() => handleModeChange('custom')}
                >
                  <Edit3 className="w-4 h-4 inline mr-2" />
                  Custom
                </button>
              </div>
            </div>

            {/* Configuration Fields */}
            <div className="space-y-4 mb-4 sm:mb-6">
              {/* Payment Service URL - Greyed out when x402-only mode is enabled */}
              <div className={x402OnlyMode ? 'opacity-40' : ''}>
                <label className="block text-sm font-medium text-foreground/80 mb-2">
                  Payment Service URL
                  {x402OnlyMode && (
                    <span className="ml-2 text-xs text-foreground/60">(disabled in x402-only mode)</span>
                  )}
                </label>
                {configMode === 'custom' ? (
                  <input
                    type="text"
                    value={currentConfig.paymentServiceUrl}
                    onChange={(e) => updateCustomConfig('paymentServiceUrl', e.target.value)}
                    disabled={x402OnlyMode}
                    className="w-full px-3 py-2 bg-card border border-border/20 rounded-2xl text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-black rounded-2xl text-sm text-gray-100 font-mono">
                      {currentConfig.paymentServiceUrl}
                    </code>
                    <CopyButton textToCopy={currentConfig.paymentServiceUrl} />
                  </div>
                )}
              </div>

              {/* Upload Service URL with X402-Only Mode Toggle */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-foreground/80">Upload Service URL</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-foreground/80">X402-Only</span>
                    <button
                      onClick={() => setX402OnlyMode(!x402OnlyMode)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card ${
                        x402OnlyMode ? 'bg-primary' : 'bg-card border border-border/20'
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-foreground transition-transform ${
                          x402OnlyMode ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <Popover className="relative">
                      <PopoverButton className="text-foreground/80 hover:text-foreground transition-colors focus:outline-none">
                        <Info className="w-4 h-4" />
                      </PopoverButton>
                      <PopoverPanel className="absolute right-0 z-10 mt-2 w-72 rounded-2xl bg-card border border-border/20 shadow-lg p-3">
                        <div className="text-xs">
                          <div className="font-medium text-foreground mb-1">X402-Only Mode</div>
                          <p className="text-foreground/80 leading-relaxed">
                            Enable for bundlers that only support x402 payments (BASE-USDC microtransactions).
                            Disables all payment service features: credits, fiat top-ups, gifts, and balance checking.
                            Only crypto payments via x402 will be available.
                          </p>
                        </div>
                      </PopoverPanel>
                    </Popover>
                  </div>
                </div>
                {configMode === 'custom' ? (
                  <input
                    type="text"
                    value={currentConfig.uploadServiceUrl}
                    onChange={(e) => updateCustomConfig('uploadServiceUrl', e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border/20 rounded-2xl text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-black rounded-2xl text-sm text-gray-100 font-mono">
                      {currentConfig.uploadServiceUrl}
                    </code>
                    <CopyButton textToCopy={currentConfig.uploadServiceUrl} />
                  </div>
                )}
              </div>

              {/* Capture Service URL */}
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-2">Capture Service URL</label>
                {configMode === 'custom' ? (
                  <input
                    type="text"
                    value={currentConfig.captureServiceUrl}
                    onChange={(e) => updateCustomConfig('captureServiceUrl', e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border/20 rounded-2xl text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-black rounded-2xl text-sm text-gray-100 font-mono">
                      {currentConfig.captureServiceUrl}
                    </code>
                    <CopyButton textToCopy={currentConfig.captureServiceUrl} />
                  </div>
                )}
              </div>

              {/* AR.IO Gateway URL */}
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-2">AR.IO Gateway URL</label>
                {configMode === 'custom' ? (
                  <input
                    type="text"
                    value={currentConfig.arioGatewayUrl}
                    onChange={(e) => updateCustomConfig('arioGatewayUrl', e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border/20 rounded-2xl text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-black rounded-2xl text-sm text-gray-100 font-mono">
                      {currentConfig.arioGatewayUrl}
                    </code>
                    <CopyButton textToCopy={currentConfig.arioGatewayUrl} />
                  </div>
                )}
              </div>

              {/* Stripe Key */}
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-2">Stripe Publishable Key</label>
                {configMode === 'custom' ? (
                  <input
                    type="text"
                    value={currentConfig.stripeKey}
                    onChange={(e) => updateCustomConfig('stripeKey', e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border/20 rounded-2xl text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-black rounded-2xl text-sm text-gray-100 font-mono">
                      {currentConfig.stripeKey.substring(0, 20)}...{currentConfig.stripeKey.substring(currentConfig.stripeKey.length - 4)}
                    </code>
                    <CopyButton textToCopy={currentConfig.stripeKey} />
                  </div>
                )}
              </div>

              {/* Process ID */}
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-2">AR.IO Process ID</label>
                {configMode === 'custom' ? (
                  <input
                    type="text"
                    value={currentConfig.processId}
                    onChange={(e) => updateCustomConfig('processId', e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border/20 rounded-2xl text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-black rounded-2xl text-sm text-gray-100 font-mono break-all overflow-hidden">
                      {currentConfig.processId}
                    </code>
                    <CopyButton textToCopy={currentConfig.processId} />
                  </div>
                )}
              </div>
            </div>

            {/* Token Gateway Map (collapsible) */}
            <details className="mb-4 sm:mb-6">
              <summary className="cursor-pointer text-sm font-medium text-foreground/80 mb-3 hover:text-foreground">
                Token Gateway Configuration ({Object.keys(currentConfig.tokenMap).length} networks)
              </summary>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 p-4 bg-card/50 rounded-2xl">
                {Object.entries(currentConfig.tokenMap).map(([token, url]) => (
                  <div key={token}>
                    <label className="block text-xs font-medium text-foreground/80 mb-1 uppercase">{token}</label>
                    {configMode === 'custom' ? (
                      <input
                        type="text"
                        value={url}
                        onChange={(e) => updateTokenMap(token as any, e.target.value)}
                        className="w-full px-2 py-1 bg-card border border-border/20 rounded text-foreground text-xs focus:ring-1 focus:ring-primary focus:border-transparent"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-2 py-1 bg-black rounded text-xs text-gray-100 font-mono truncate">
                          {url}
                        </code>
                        <CopyButton textToCopy={url} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </details>

            {configMode !== 'production' && (
              <p className="text-sm text-warning mb-4 sm:mb-6">
                Non-production endpoint services may not work as expected
              </p>
            )}

            {/* Actions */}
            <div className="flex justify-center gap-3 pt-6 border-t border-border/20">
              {configMode === 'custom' && (
                <button
                  onClick={resetToDefaults}
                  className="px-4 py-2 border border-border/20 text-foreground/80 rounded-full hover:bg-card transition-colors text-sm"
                >
                  Reset to Production
                </button>
              )}

              <button
                onClick={applyConfiguration}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/80 transition-colors text-sm font-medium"
              >
                Apply Changes
              </button>
            </div>

          </div>
        </div>
      )}
      </div>
    </div>
  );
}
