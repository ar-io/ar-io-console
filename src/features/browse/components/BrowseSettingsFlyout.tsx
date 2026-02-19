import { useState, useEffect } from 'react';
import { X, ChevronDown, Shield, Zap, Info } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { ROUTING_STRATEGY_OPTIONS } from '../utils/constants';
import { getTopStakedGateways } from '../utils/trustedGateways';
import type { GatewayWithStake } from '../types';

// Feature flag: Signature verification is hidden until SDK fixes ANS-104 data item support
// The SDK's SignatureVerificationStrategy uses /tx/{txId} which only works for L1 transactions
const SHOW_VERIFICATION_METHOD_SELECTOR = false;

interface BrowseSettingsFlyoutProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BrowseSettingsFlyout({ isOpen, onClose }: BrowseSettingsFlyoutProps) {
  const browseConfig = useStore((state) => state.browseConfig);
  const setBrowseConfig = useStore((state) => state.setBrowseConfig);

  const [topGateways, setTopGateways] = useState<GatewayWithStake[]>([]);
  const [isLoadingGateways, setIsLoadingGateways] = useState(false);

  // Load top gateways for preferred gateway dropdown and verification display
  useEffect(() => {
    if (isOpen && topGateways.length === 0) {
      setIsLoadingGateways(true);
      getTopStakedGateways()
        .then(setTopGateways)
        .finally(() => setIsLoadingGateways(false));
    }
  }, [isOpen, topGateways.length]);

  if (!isOpen) return null;

  /** Format stake amount for display. Stake is in mARIO (1 ARIO = 1,000,000 mARIO) */
  const formatStake = (marioStake: number): string => {
    const arioStake = marioStake / 1_000_000; // Convert mARIO to ARIO
    if (arioStake >= 1_000_000) {
      return `${(arioStake / 1_000_000).toFixed(1)}M`;
    } else if (arioStake >= 1_000) {
      return `${(arioStake / 1_000).toFixed(1)}K`;
    } else if (arioStake >= 1) {
      return `${arioStake.toFixed(0)}`;
    }
    return '<1';
  };

  return (
    <div className="fixed inset-0 z-[110]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-background shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/20">
          <h2 className="text-lg font-semibold text-foreground">Browse Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-foreground/60 hover:text-foreground hover:bg-card rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Routing Strategy */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
              <Zap className="w-4 h-4 text-primary" />
              Gateway Routing Strategy
            </label>
            <div className="space-y-2">
              {ROUTING_STRATEGY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    browseConfig.routingStrategy === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border/20 hover:border-border/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="routingStrategy"
                    value={option.value}
                    checked={browseConfig.routingStrategy === option.value}
                    onChange={() => setBrowseConfig({ routingStrategy: option.value })}
                    className="mt-1 text-primary focus:ring-primary"
                  />
                  <div>
                    <div className="font-medium text-foreground">{option.label}</div>
                    <div className="text-sm text-foreground/60">{option.description}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* Preferred Gateway Dropdown */}
            {browseConfig.routingStrategy === 'preferred' && (
              <div className="mt-4">
                <label className="block text-sm text-foreground/60 mb-2">
                  Select Gateway
                </label>
                <div className="relative">
                  <select
                    value={browseConfig.preferredGateway || ''}
                    onChange={(e) => setBrowseConfig({ preferredGateway: e.target.value })}
                    className="w-full px-3 py-2 bg-card border border-border/20 rounded-lg text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select a gateway...</option>
                    {isLoadingGateways ? (
                      <option disabled>Loading gateways...</option>
                    ) : (
                      topGateways.map((gw) => {
                        let hostname = gw.url;
                        try {
                          hostname = new URL(gw.url).hostname;
                        } catch {
                          // Use raw URL if parsing fails
                        }
                        return (
                          <option key={gw.url} value={gw.url}>
                            {hostname} ({formatStake(gw.totalStake)} ARIO staked)
                          </option>
                        );
                      })
                    )}
                    <option value="https://turbo-gateway.com">turbo-gateway.com (default)</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {/* Verification Section */}
          <div className="pt-4 border-t border-border/20">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
              <Shield className="w-4 h-4 text-primary" />
              Content Verification
            </label>

            {/* Enable Verification */}
            <label className="flex items-center justify-between p-3 rounded-xl border border-border/20 cursor-pointer hover:border-border/40 transition-colors">
              <div>
                <div className="font-medium text-foreground">Enable Verification</div>
                <div className="text-sm text-foreground/60">
                  Cryptographically verify content before displaying
                </div>
              </div>
              <input
                type="checkbox"
                checked={browseConfig.verificationEnabled}
                onChange={(e) => setBrowseConfig({ verificationEnabled: e.target.checked })}
                className="w-5 h-5 text-primary rounded focus:ring-primary"
              />
            </label>

            {browseConfig.verificationEnabled && (
              <div className="mt-4 space-y-4">
                {/* Strict Mode */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-border/20 cursor-pointer hover:border-border/40 transition-colors">
                  <div>
                    <div className="font-medium text-foreground">Strict Mode</div>
                    <div className="text-sm text-foreground/60">
                      Block content that fails verification
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={browseConfig.strictVerification}
                    onChange={(e) => setBrowseConfig({ strictVerification: e.target.checked })}
                    className="w-5 h-5 text-primary rounded focus:ring-primary"
                  />
                </label>

                {/* Verification Method - controlled by feature flag */}
                {SHOW_VERIFICATION_METHOD_SELECTOR && (
                  <div>
                    <label className="block text-sm text-foreground/60 mb-2">
                      Verification Method
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setBrowseConfig({ verificationMethod: 'hash' })}
                        className={`p-3 rounded-xl border text-left transition-colors ${
                          browseConfig.verificationMethod === 'hash'
                            ? 'border-primary bg-primary/5'
                            : 'border-border/20 hover:border-border/40'
                        }`}
                      >
                        <div className="font-medium text-foreground">Hash</div>
                        <div className="text-xs text-foreground/60">Fast, compares hashes</div>
                      </button>
                      <button
                        onClick={() => setBrowseConfig({ verificationMethod: 'signature' })}
                        className={`p-3 rounded-xl border text-left transition-colors ${
                          browseConfig.verificationMethod === 'signature'
                            ? 'border-primary bg-primary/5'
                            : 'border-border/20 hover:border-border/40'
                        }`}
                      >
                        <div className="font-medium text-foreground">Signature</div>
                        <div className="text-xs text-foreground/60">Cryptographic proof</div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Trusted Gateway Count */}
                <div>
                  <label className="block text-sm text-foreground/60 mb-2">
                    Trusted Gateways: {browseConfig.trustedGatewayCount}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={browseConfig.trustedGatewayCount}
                    onChange={(e) => setBrowseConfig({ trustedGatewayCount: parseInt(e.target.value) })}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-foreground/40 mt-1">
                    <span>1 (faster)</span>
                    <span>10 (more secure)</span>
                  </div>
                </div>

                {/* Concurrency */}
                <div>
                  <label className="block text-sm text-foreground/60 mb-2">
                    Parallel Verifications: {browseConfig.verificationConcurrency}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={browseConfig.verificationConcurrency}
                    onChange={(e) => setBrowseConfig({ verificationConcurrency: parseInt(e.target.value) })}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-foreground/40 mt-1">
                    <span>1 (slower)</span>
                    <span>20 (faster)</span>
                  </div>
                </div>

                {/* Display trusted gateways */}
                <div className="pt-4 border-t border-border/20">
                  <div className="text-xs font-semibold text-foreground/60 mb-2 uppercase tracking-wide">
                    Trusted Gateways (Top {topGateways.length} by Stake)
                  </div>
                  {isLoadingGateways ? (
                    <div className="text-xs text-foreground/50">Loading gateways...</div>
                  ) : topGateways.length > 0 ? (
                    <div className="space-y-1.5">
                      {topGateways.slice(0, browseConfig.trustedGatewayCount).map((gateway, index) => (
                        <div
                          key={gateway.url}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span className="text-primary font-mono w-5 flex-shrink-0">#{index + 1}</span>
                          <a
                            href={gateway.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground/80 hover:text-primary truncate font-mono flex-1 min-w-0"
                            title={gateway.url}
                          >
                            {gateway.url.replace('https://', '')}
                          </a>
                          <span className="text-foreground/50 font-mono whitespace-nowrap flex-shrink-0">
                            {formatStake(gateway.totalStake)} ARIO
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-foreground/50">No gateways available</div>
                  )}
                  <div className="mt-2 text-xs text-foreground/50">
                    {browseConfig.trustedGatewayCount} gateway{browseConfig.trustedGatewayCount > 1 ? 's' : ''} randomly selected from top 10 for each verification.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="pt-4 border-t border-border/20">
            <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-xl">
              <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm text-foreground/80">
                <p className="mb-2">
                  <strong>Verification</strong> ensures content hasn't been tampered with by comparing
                  against multiple trusted gateways.
                </p>
                <p>
                  <strong>Strict mode</strong> blocks any content that can't be verified, preventing
                  potential security risks.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/20">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-primary text-white rounded-full font-medium hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
