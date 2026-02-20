import { useState, useEffect, useCallback } from 'react';
import { X, Shield, Route, Compass } from 'lucide-react';
import { useStore, type BrowseConfig } from '@/store/useStore';
import { ROUTING_STRATEGY_OPTIONS } from '../utils/constants';
import { getTopStakedGateways, getAllJoinedGateways } from '../utils/trustedGateways';
import { GatewayCombobox } from './GatewayCombobox';
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
  const [allGateways, setAllGateways] = useState<GatewayWithStake[]>([]);
  const [isLoadingGateways, setIsLoadingGateways] = useState(false);

  // Draft state for staged settings - changes only apply when "Done" is clicked
  const [draftConfig, setDraftConfig] = useState<BrowseConfig>(browseConfig);

  // Reset draft to current config when flyout opens
  useEffect(() => {
    if (isOpen) {
      setDraftConfig(browseConfig);
    }
  }, [isOpen, browseConfig]);

  // Update draft config (does not persist until Done is clicked)
  const updateDraft = useCallback((updates: Partial<BrowseConfig>) => {
    setDraftConfig(prev => ({ ...prev, ...updates }));
  }, []);

  // Apply draft to store and close
  const handleDone = useCallback(() => {
    setBrowseConfig(draftConfig);
    onClose();
  }, [draftConfig, setBrowseConfig, onClose]);

  // Load gateways for display and selection
  useEffect(() => {
    if (isOpen && topGateways.length === 0) {
      setIsLoadingGateways(true);
      Promise.all([
        getTopStakedGateways(),
        getAllJoinedGateways(),
      ])
        .then(([top, all]) => {
          setTopGateways(top);
          setAllGateways(all);
        })
        .finally(() => setIsLoadingGateways(false));
    }
  }, [isOpen, topGateways.length]);

  // Lock body scroll when flyout is open to prevent layout shifts
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

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
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Compass className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Browse Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-foreground/60 hover:text-foreground hover:bg-card rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6" style={{ scrollbarGutter: 'stable' }}>
          {/* Routing Strategy */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
              <Route className="w-4 h-4 text-primary" />
              Gateway Routing Strategy
            </label>
            <div className="space-y-2">
              {ROUTING_STRATEGY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    draftConfig.routingStrategy === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border/20 hover:border-border/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="routingStrategy"
                    value={option.value}
                    checked={draftConfig.routingStrategy === option.value}
                    onChange={() => updateDraft({ routingStrategy: option.value })}
                    className="mt-1 text-primary focus:ring-primary"
                  />
                  <div>
                    <div className="font-medium text-foreground">{option.label}</div>
                    <div className="text-sm text-foreground/60">{option.description}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* Preferred Gateway Selector */}
            {draftConfig.routingStrategy === 'preferred' && (
              <div className="mt-4">
                <label className="block text-sm text-foreground/60 mb-2">
                  Select Gateway
                </label>
                <GatewayCombobox
                  value={draftConfig.preferredGateway || null}
                  onChange={(url) => updateDraft({ preferredGateway: url })}
                  gateways={allGateways}
                  isLoading={isLoadingGateways}
                />
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
                checked={draftConfig.verificationEnabled}
                onChange={(e) => updateDraft({ verificationEnabled: e.target.checked })}
                className="w-5 h-5 text-primary rounded focus:ring-primary"
              />
            </label>

            {draftConfig.verificationEnabled && (
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
                    checked={draftConfig.strictVerification}
                    onChange={(e) => updateDraft({ strictVerification: e.target.checked })}
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
                        onClick={() => updateDraft({ verificationMethod: 'hash' })}
                        className={`p-3 rounded-xl border text-left transition-colors ${
                          draftConfig.verificationMethod === 'hash'
                            ? 'border-primary bg-primary/5'
                            : 'border-border/20 hover:border-border/40'
                        }`}
                      >
                        <div className="font-medium text-foreground">Hash</div>
                        <div className="text-xs text-foreground/60">Fast, compares hashes</div>
                      </button>
                      <button
                        onClick={() => updateDraft({ verificationMethod: 'signature' })}
                        className={`p-3 rounded-xl border text-left transition-colors ${
                          draftConfig.verificationMethod === 'signature'
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

                {/* Gateway Consensus Count */}
                <div>
                  <label className="block text-sm text-foreground/60 mb-2">
                    Gateway Consensus: {draftConfig.trustedGatewayCount}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={draftConfig.trustedGatewayCount}
                    onChange={(e) => updateDraft({ trustedGatewayCount: parseInt(e.target.value) })}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-foreground/40 mt-1">
                    <span>1 (faster)</span>
                    <span>20 (more secure)</span>
                  </div>
                </div>

                {/* Concurrency */}
                <div>
                  <label className="block text-sm text-foreground/60 mb-2">
                    Verification Concurrency: {draftConfig.verificationConcurrency}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={draftConfig.verificationConcurrency}
                    onChange={(e) => updateDraft({ verificationConcurrency: parseInt(e.target.value) })}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-foreground/40 mt-1">
                    <span>1 (slower)</span>
                    <span>20 (faster)</span>
                  </div>
                </div>

                {/* Display consensus gateways */}
                <div className="pt-4 border-t border-border/20">
                  <div className="text-xs font-semibold text-foreground/60 mb-2 uppercase tracking-wide">
                    Consensus Gateways
                  </div>
                  {isLoadingGateways ? (
                    <div className="text-xs text-foreground/50">Loading gateways...</div>
                  ) : topGateways.length > 0 ? (
                    <div className="space-y-1.5">
                      {topGateways.slice(0, draftConfig.trustedGatewayCount).map((gateway, index) => (
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
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/20">
          <button
            onClick={handleDone}
            className="w-full py-2.5 bg-primary text-white rounded-full font-medium hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
