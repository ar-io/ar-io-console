import { useGatewayInfo } from '../../hooks/useGatewayInfo';
import {
  Server,
  Globe,
  TrendingUp,
  Database,
  Coins,
  Upload,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import CopyButton from '../CopyButton';
import { formatWalletAddress } from '../../utils';
import { useStore } from '../../store/useStore';

export default function GatewayInfoPanel() {
  const { uploadServiceInfo, gatewayInfo, arIOGatewayInfo, pricingInfo, arweaveNodeInfo, loading, error, refreshing, refresh } = useGatewayInfo();
  const { getCurrentConfig } = useStore();
  const currentConfig = getCurrentConfig();

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-foreground/80">Loading gateway information...</p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6">
      {/* Inline Header with Description */}
      <div className="flex items-start gap-3 mb-4 sm:mb-6">
        <div className="w-10 h-10 bg-primary/20 rounded-2xl flex items-center justify-center flex-shrink-0 mt-1">
          <Server className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-2xl font-bold font-heading text-foreground mb-1">Service Info</h3>
          <p className="text-sm text-foreground/80">
            Real-time gateway service configuration, performance metrics, and technical details
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing || loading}
          className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-border/20 text-foreground/80 hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={refreshing ? 'Refreshing...' : 'Refresh gateway data'}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-primary' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="bg-error/10 border border-error/20 rounded-2xl p-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 text-error">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Main Content Container with Gradient */}
      <div className="bg-gradient-to-br from-primary/5 to-primary/3 rounded-2xl border border-border/20 p-4 sm:p-6 mb-4 sm:mb-6">

        {/* Service Overview */}
        {uploadServiceInfo && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5 text-primary" />
              <h4 className="text-lg font-bold font-heading text-foreground">Service Overview</h4>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 sm:mb-6">
              <div className="bg-card rounded-2xl p-4">
                <div className="text-xs text-foreground/80 uppercase tracking-wider mb-1">Version</div>
                <div className="text-lg font-bold text-primary">{uploadServiceInfo.version}</div>
              </div>

              <div className="bg-card rounded-2xl p-4">
                <div className="text-xs text-foreground/80 uppercase tracking-wider mb-1">Free Limit</div>
                <div className="text-lg font-bold text-foreground">
                  {Math.round(uploadServiceInfo.freeUploadLimitBytes / 1024)} KB
                </div>
              </div>

              <div className="bg-card rounded-2xl p-4">
                <div className="text-xs text-foreground/80 uppercase tracking-wider mb-1">Gateway</div>
                <div className="text-sm font-medium text-foreground">
                  {uploadServiceInfo.gateway.replace('https://', '')}
                </div>
              </div>

              <div className="bg-card rounded-2xl p-4">
                <div className="text-xs text-foreground/80 uppercase tracking-wider mb-1">Chains</div>
                <div className="text-sm font-medium text-foreground">
                  {Object.keys(uploadServiceInfo.addresses).length} supported
                </div>
              </div>
            </div>

            {/* Multi-chain Addresses */}
            <div className="bg-card rounded-2xl p-4">
              <h5 className="text-sm font-medium text-foreground/80 mb-3 uppercase tracking-wider">Service Addresses</h5>
              <div className="grid md:grid-cols-2 gap-3">
                {Object.entries(uploadServiceInfo.addresses).map(([chain, address]) => (
                  <div key={chain} className="bg-card rounded-2xl p-3 flex justify-between items-center border border-border/20">
                    <div>
                      <span className="text-xs text-foreground/80 uppercase tracking-wider">{chain}</span>
                      <div className="font-mono text-sm text-foreground">{formatWalletAddress(address, 12)}</div>
                    </div>
                    <CopyButton textToCopy={address} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Pricing Information */}
        {pricingInfo && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Coins className="w-5 h-5 text-primary" />
              <h4 className="text-lg font-bold font-heading text-foreground">Upload Fees & Pricing</h4>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-card rounded-2xl p-4">
                <div className="text-xs text-foreground/80 uppercase tracking-wider mb-1">Free Tier</div>
                <div className="text-lg font-bold text-success">
                  {uploadServiceInfo ? `${Math.round(uploadServiceInfo.freeUploadLimitBytes / 1024)} KiB` : '105 KiB'}
                </div>
                <div className="text-xs text-foreground/80 mt-1">No cost for small files</div>
              </div>

              <div className="bg-card rounded-2xl p-4">
                <div className="text-xs text-foreground/80 uppercase tracking-wider mb-1">ar.io Rate</div>
                <div className="text-lg font-bold text-primary">
                  ${pricingInfo.usdPerGiB.toFixed(4)}
                </div>
                <div className="text-xs text-foreground/80 mt-1">Per GiB via ar.io</div>
              </div>

              <div className="bg-card rounded-2xl p-4">
                <div className="text-xs text-foreground/80 uppercase tracking-wider mb-1">Base Rate</div>
                <div className="text-lg font-bold text-foreground">
                  {pricingInfo.baseGatewayPrice !== undefined
                    ? pricingInfo.baseGatewayPrice === 0
                      ? 'FREE'
                      : `$${pricingInfo.baseGatewayPrice.toFixed(4)}`
                    : 'Unavailable'
                  }
                </div>
                <div className="text-xs text-foreground/80 mt-1">Per GiB direct to gateway</div>
              </div>

              <div className="bg-card rounded-2xl p-4">
                <div className="text-xs text-foreground/80 uppercase tracking-wider mb-1">ar.io Premium</div>
                <div className="text-lg font-bold text-primary">
                  {pricingInfo.turboFeePercentage
                    ? `+${pricingInfo.turboFeePercentage.toFixed(1)}%`
                    : pricingInfo.baseGatewayPrice === 0
                      ? 'N/A'
                      : 'Unavailable'
                  }
                </div>
                <div className="text-xs text-foreground/80 mt-1">
                  {pricingInfo.baseGatewayPrice === 0 ? 'vs free gateway' : 'Convenience fee'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performance & Status */}
        {arIOGatewayInfo && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h4 className="text-lg font-bold font-heading text-foreground">AR.IO Network Status</h4>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 sm:mb-6">
              <div className="bg-card rounded-2xl p-4">
                <div className="text-xs text-foreground/80 uppercase tracking-wider mb-1">Status</div>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="text-lg font-bold text-primary capitalize">{arIOGatewayInfo.status}</span>
                </div>
                <div className="text-xs text-foreground/80">
                  Since {new Date(arIOGatewayInfo.startTimestamp).toLocaleDateString()}
                </div>
              </div>

              <div className="bg-card rounded-2xl p-4">
                <div className="text-xs text-foreground/80 uppercase tracking-wider mb-1">Success Rate</div>
                <div className="text-lg font-bold text-foreground">
                  {((arIOGatewayInfo.stats.passedEpochCount / arIOGatewayInfo.stats.totalEpochCount) * 100).toFixed(1)}%
                </div>
              </div>

              <div className="bg-card rounded-2xl p-4">
                <div className="text-xs text-foreground/80 uppercase tracking-wider mb-1">Operator Stake</div>
                <div className="text-lg font-bold text-foreground">
                  {(arIOGatewayInfo.operatorStake / 1e6).toLocaleString()} ARIO
                </div>
              </div>

              <div className="bg-card rounded-2xl p-4">
                <div className="text-xs text-foreground/80 uppercase tracking-wider mb-1">Onchain Performance</div>
                <div className="text-lg font-bold text-foreground">
                  {(arIOGatewayInfo.weights.compositeWeight * 100).toFixed(1)}%
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Arweave Network Info */}
        {arweaveNodeInfo && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-5 h-5 text-primary" />
              <h4 className="text-lg font-bold font-heading text-foreground">Arweave Network Status</h4>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card rounded-2xl p-4">
                <div className="text-xs text-foreground/80 uppercase tracking-wider mb-1">Block Height</div>
                <div className="text-lg font-bold text-primary">
                  {arweaveNodeInfo.height.toLocaleString()}
                </div>
              </div>

              <div className="bg-card rounded-2xl p-4">
                <div className="text-xs text-foreground/80 uppercase tracking-wider mb-1">Version</div>
                <div className="text-lg font-bold text-foreground">
                  v{arweaveNodeInfo.version}.{arweaveNodeInfo.release}
                </div>
                <div className="text-xs text-foreground/80 mt-1">{arweaveNodeInfo.network}</div>
              </div>

              <div className="bg-card rounded-2xl p-4">
                <div className="text-xs text-foreground/80 uppercase tracking-wider mb-1">Peers</div>
                <div className="text-lg font-bold text-foreground">
                  {arweaveNodeInfo.peers}
                </div>
              </div>

              <div className="bg-card rounded-2xl p-4">
                <div className="text-xs text-foreground/80 uppercase tracking-wider mb-1">Queue</div>
                <div className="text-lg font-bold text-foreground">
                  {arweaveNodeInfo.queue_length}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Service Links */}
      <div className="space-y-4">
        <h4 className="text-lg font-bold font-heading text-foreground">Related Services</h4>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <a
            href={currentConfig.uploadServiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-card rounded-2xl p-4 hover:bg-card/80 transition-colors border border-border/20 hover:border-foreground/50"
          >
            <div className="flex items-center justify-between mb-2">
              <Upload className="w-5 h-5 text-foreground/80" />
              <ExternalLink className="w-4 h-4 text-foreground/80" />
            </div>
            <h5 className="font-medium text-foreground mb-1">Upload Service</h5>
            <p className="text-xs text-foreground/80">Live service configuration</p>
          </a>

          <a
            href="https://arweave.net/ar-io/info"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-card rounded-2xl p-4 hover:bg-card/80 transition-colors border border-border/20 hover:border-foreground/50"
          >
            <div className="flex items-center justify-between mb-2">
              <Server className="w-5 h-5 text-foreground/80" />
              <ExternalLink className="w-4 h-4 text-foreground/80" />
            </div>
            <h5 className="font-medium text-foreground mb-1">Gateway Info</h5>
            <p className="text-xs text-foreground/80">Gateway configuration data</p>
          </a>

          {gatewayInfo?.wallet && (
            <a
              href={`https://gateways.ar.io/#/gateways/${gatewayInfo.wallet}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-card rounded-2xl p-4 hover:bg-card/80 transition-colors border border-border/20 hover:border-foreground/50"
            >
              <div className="flex items-center justify-between mb-2">
                <Globe className="w-5 h-5 text-foreground/80" />
                <ExternalLink className="w-4 h-4 text-foreground/80" />
              </div>
              <h5 className="font-medium text-foreground mb-1">Network Portal</h5>
              <p className="text-xs text-foreground/80">AR.IO network gateway details</p>
            </a>
          )}

          {uploadServiceInfo?.gateway && (
            <a
              href={`${uploadServiceInfo.gateway}/info`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-card rounded-2xl p-4 hover:bg-card/80 transition-colors border border-border/20 hover:border-foreground/50"
            >
              <div className="flex items-center justify-between mb-2">
                <Database className="w-5 h-5 text-foreground/80" />
                <ExternalLink className="w-4 h-4 text-foreground/80" />
              </div>
              <h5 className="font-medium text-foreground mb-1">Arweave Node</h5>
              <p className="text-xs text-foreground/80">Live network and node status</p>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
