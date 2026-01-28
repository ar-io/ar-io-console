import { ExternalLink, Globe, Wrench, Edit3, Info, Settings } from 'lucide-react';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { useStore } from '../../store/useStore';
import CopyButton from '../CopyButton';

export default function ConfigurationPanel() {
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

  return (
    <div className="max-w-4xl mx-auto">
      {/* Panel Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card">
          <Settings className="h-5 w-5 text-foreground" />
        </div>
        <div>
          <h3 className="font-heading text-2xl font-extrabold text-foreground mb-1">Configuration</h3>
          <p className="text-sm text-foreground/80">Manage environment settings and service endpoints</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Environment Configuration Panel */}
        <div className="rounded-2xl border border-border/20 bg-card p-6">
          <h4 className="text-lg font-semibold font-heading text-foreground mb-4">Environment Configuration</h4>
          <p className="text-sm text-foreground/80 mb-2">
            Switch between environments or configure custom endpoints for development and testing
          </p>

          {/* Mode Selection */}
          <div className="flex justify-center mb-4 sm:mb-6">
            <div className="inline-flex bg-background rounded-2xl p-1 border border-border/20">
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
                  className="w-full px-3 py-2 bg-background border border-border/20 rounded-2xl text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed"
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
                      x402OnlyMode ? 'bg-primary' : 'bg-background border border-border/20'
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
                  className="w-full px-3 py-2 bg-background border border-border/20 rounded-2xl text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
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
                  className="w-full px-3 py-2 bg-background border border-border/20 rounded-2xl text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
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
                  className="w-full px-3 py-2 bg-background border border-border/20 rounded-2xl text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
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
                  className="w-full px-3 py-2 bg-background border border-border/20 rounded-2xl text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
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
                  className="w-full px-3 py-2 bg-background border border-border/20 rounded-2xl text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 p-4 bg-background/50 rounded-2xl">
              {Object.entries(currentConfig.tokenMap).map(([token, url]) => (
                <div key={token}>
                  <label className="block text-xs font-medium text-foreground/80 mb-1 uppercase">{token}</label>
                  {configMode === 'custom' ? (
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => updateTokenMap(token as any, e.target.value)}
                      className="w-full px-2 py-1 bg-background border border-border/20 rounded text-foreground text-xs focus:ring-1 focus:ring-primary focus:border-transparent"
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
                className="px-4 py-2 border border-border/20 text-foreground/80 rounded-full hover:bg-background transition-colors text-sm"
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

        {/* Documentation Link */}
        <div className="text-center">
          <a
            href="https://docs.ar.io"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-foreground/80 hover:text-foreground transition-colors"
          >
            <span>View full documentation</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
