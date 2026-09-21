import { useState, useEffect } from 'react';
import { type Gateway } from '@ar.io/sdk';
import { TurboFactory, USD } from '@ardrive/turbo-sdk/web';
import { useTurboConfig } from './useTurboConfig';
import { useStore } from '../store/useStore';
import { infraFeePercent } from '../utils/infraFee';
import { wincPerCredit } from '../constants';

interface UploadServiceInfo {
  version: string;
  addresses: {
    arweave: string;
    ethereum: string;
    solana: string;
    pol: string;
    kyve: string;
  };
  gateway: string;
  freeUploadLimitBytes: number;
  freeTier?: {
    maxItemBytes: number;
    lifetimeBytes: number;
    ipBytes: number;
  };
}

interface X402Pricing {
  perBytePrice: string;
  minPrice: string;
  maxPrice: string;
  currency: string;
  exampleCosts: {
    '1KB': number;
    '1MB': number;
    '1GB': number;
  };
}

interface GatewayInfo {
  wallet: string;
  processId: string;
  release: string;
  ans104UnbundleFilter: any;
  ans104IndexFilter: any;
  supportedManifestVersions: string[];
  x402?: {
    enabled: boolean;
    network: string;
    walletAddress: string;
    dataEgress?: {
      pricing: X402Pricing;
    };
  };
}

// Use the actual AR.IO SDK type
type ArIOGatewayInfo = Gateway;

interface PricingInfo {
  /** Turbo's card rate for 1 GiB, in USD. The infrastructure fee is inside it. */
  usdPerGiB: number;
  /**
   * What an upload actually deducts: credits per GiB, from the same rates
   * response as `usdPerGiB`.
   *
   * Deliberately NOT called AR per GiB, though credits are AR-denominated.
   * Funding a GiB with AR costs this divided by 0.65, because AR top-ups carry
   * the fee — so the two numbers differ by half again and labelling this one
   * "AR" would quote a price nobody is charged.
   */
  creditsPerGiB?: number;
  /**
   * The flat per-item fee, in credits, charged once per uploaded file on top
   * of the byte cost. Every cost estimate in the app adds it, so the pricing
   * panel has to name it too.
   */
  creditsPerItem?: number;
  /** Share of every top-up Turbo keeps as its infrastructure fee, e.g. 35. */
  infraFeePercent?: number;
}

/**
 * The ar.io rate, and the infrastructure fee included in it.
 *
 * The fee is read from Turbo's own fiat quote rather than reconstructed by
 * setting the rate against a raw Arweave price converted at a CoinGecko spot
 * rate. That reconstruction drifted with a third-party price, failed whenever
 * CoinGecko rate-limited, and was labelled "+X% vs raw Arweave" — a markup —
 * while computing X as a share of the rate — a margin. The true markup at the
 * time was +53.8%, not +35%.
 */
async function fetchPricingInfo(
  turboConfig: Parameters<typeof TurboFactory.unauthenticated>[0],
): Promise<PricingInfo> {
  const turbo = TurboFactory.unauthenticated(turboConfig);
  const [fiatRates, quote] = await Promise.all([
    turbo.getFiatRates(),
    // Any amount carries the same fee; the fee is all this is read for.
    turbo.getWincForFiat({ amount: USD(10) }).catch((err) => {
      console.warn('[GatewayInfo] Infrastructure fee lookup failed:', err);
      return undefined;
    }),
  ]);
  const wincPerGiB = Number(fiatRates.winc);
  // Same shape `usePerDataItemFee` reads: the rates response carries it, the
  // SDK's type does not declare it.
  const wincPerItem = Number((fiatRates as any)?.perDataItemFeeWinc);
  return {
    usdPerGiB: fiatRates.fiat?.usd || 0,
    creditsPerGiB: Number.isFinite(wincPerGiB) && wincPerGiB > 0
      ? wincPerGiB / wincPerCredit
      : undefined,
    creditsPerItem: Number.isFinite(wincPerItem) && wincPerItem > 0
      ? wincPerItem / wincPerCredit
      : undefined,
    infraFeePercent: infraFeePercent(quote?.fees),
  };
}

interface ArweaveNodeInfo {
  version: number;
  release: number;
  queue_length: number;
  peers: number;
  node_state_latency: number;
  network: string;
  height: number;
  current: string;
  blocks: number;
}

interface PeersInfo {
  gatewayCount: number;
  arweaveNodeCount: number;
}

// v2: pricingInfo dropped the raw-Arweave fields for `infraFeePercent`. v3
// added `creditsPerGiB`. A versioned key keeps an old entry from rendering a
// new field as "—" until it expires.
const CACHE_KEY_PREFIX = 'turbo-gateway-info-v3';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

interface CachedGatewayInfo {
  data: {
    uploadServiceInfo: UploadServiceInfo | null;
    gatewayInfo: GatewayInfo | null;
    arIOGatewayInfo: ArIOGatewayInfo | null;
    pricingInfo: PricingInfo | null;
    arweaveNodeInfo: ArweaveNodeInfo | null;
    peersInfo: PeersInfo | null;
  };
  timestamp: number;
}

export function useGatewayInfo() {
  const [uploadServiceInfo, setUploadServiceInfo] = useState<UploadServiceInfo | null>(null);
  const [gatewayInfo, setGatewayInfo] = useState<GatewayInfo | null>(null);
  const [arIOGatewayInfo, setArIOGatewayInfo] = useState<ArIOGatewayInfo | null>(null);
  const [pricingInfo, setPricingInfo] = useState<PricingInfo | null>(null);
  const [arweaveNodeInfo, setArweaveNodeInfo] = useState<ArweaveNodeInfo | null>(null);
  const [peersInfo, setPeersInfo] = useState<PeersInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const turboConfig = useTurboConfig();
  const getCurrentConfig = useStore((state) => state.getCurrentConfig);
  const configMode = useStore((state) => state.configMode);

  // Create config-aware cache key
  const cacheKey = `${CACHE_KEY_PREFIX}-${configMode}`;

  useEffect(() => {
    const fetchGatewayInfo = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check cache first
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsedCache: CachedGatewayInfo = JSON.parse(cached);
            const isExpired = Date.now() - parsedCache.timestamp > CACHE_DURATION;

            if (!isExpired) {
              // Using cached gateway info
              setUploadServiceInfo(parsedCache.data.uploadServiceInfo);
              setGatewayInfo(parsedCache.data.gatewayInfo);
              setArIOGatewayInfo(parsedCache.data.arIOGatewayInfo);
              setPricingInfo(parsedCache.data.pricingInfo);
              setArweaveNodeInfo(parsedCache.data.arweaveNodeInfo);
              setPeersInfo(parsedCache.data.peersInfo);
              setLoading(false);
              return;
            }
          } catch (err) {
            console.warn('Failed to parse cached gateway info:', err);
          }
        }

        // Fetch all data
        let uploadData = null;
        let gatewayData = null;
        let arIOData = null;
        let pricingData = null;
        let arweaveNodeData = null;
        let peersData: PeersInfo | null = null;

        // Fetch upload service info from upload service URL
        try {
          const config = getCurrentConfig();
          const uploadResponse = await fetch(config.uploadServiceUrl);
          uploadData = await uploadResponse.json();
          setUploadServiceInfo(uploadData);
        } catch (err) {
          console.warn('Failed to fetch upload service info:', err);
        }

        // Fetch gateway info from configured AR.IO gateway
        const config = getCurrentConfig();
        const gatewayUrl = config.arioGatewayUrl.replace(/\/$/, ''); // Remove trailing slash
        try {
          const gatewayResponse = await fetch(`${gatewayUrl}/ar-io/info`);
          gatewayData = await gatewayResponse.json();
          setGatewayInfo(gatewayData);
        } catch (err) {
          console.warn('Failed to fetch gateway info:', err);
        }

        // Fetch peers info from configured gateway
        try {
          const peersResponse = await fetch(`${gatewayUrl}/ar-io/peers`);
          const peersRaw = await peersResponse.json();
          peersData = {
            gatewayCount: Object.keys(peersRaw.gateways || {}).length,
            arweaveNodeCount: Object.keys(peersRaw.arweaveNodes || {}).length,
          };
          setPeersInfo(peersData);
        } catch (err) {
          console.warn('Failed to fetch peers info:', err);
        }

        // Fetch AR.IO gateway info using SDK (if we have gateway wallet address)
        if (gatewayData?.wallet) {
          try {
            const { getARIO } = await import('../utils');
            const io = getARIO();
            arIOData = await io.getGateway({
              address: gatewayData.wallet,
            });
            setArIOGatewayInfo(arIOData);
          } catch (err) {
            console.warn('Gateway not found in ar.io network or lookup failed:', err);
            // This is expected for some gateways - they might not be registered in AR.IO
          }
        }

        // Fetch Arweave node info from gateway
        if (uploadData?.gateway) {
          try {
            const gatewayHost = uploadData.gateway.replace('https://', '');
            const arweaveResponse = await fetch(`https://${gatewayHost}/info`);
            arweaveNodeData = await arweaveResponse.json();
            setArweaveNodeInfo(arweaveNodeData);
          } catch (err) {
            console.warn('Failed to fetch Arweave node info:', err);
          }
        }

        // ar.io rate and the infrastructure fee inside it
        try {
          pricingData = await fetchPricingInfo(turboConfig);
          setPricingInfo(pricingData);
        } catch (err) {
          console.warn('Pricing calculation failed:', err);
        }

        // Cache the results
        const cacheData: CachedGatewayInfo = {
          data: {
            uploadServiceInfo: uploadData,
            gatewayInfo: gatewayData,
            arIOGatewayInfo: arIOData,
            pricingInfo: pricingData,
            arweaveNodeInfo: arweaveNodeData,
            peersInfo: peersData,
          },
          timestamp: Date.now(),
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch gateway information');
      } finally {
        setLoading(false);
      }
    };

    fetchGatewayInfo();
  }, [getCurrentConfig, turboConfig, cacheKey, configMode]);

  const refresh = async () => {
    setRefreshing(true);
    setError(null);

    // Clear cache and refetch
    localStorage.removeItem(cacheKey);

    try {
      // Fetch all data fresh
      let uploadData = null;
      let gatewayData = null;
      let arIOData = null;
      let pricingDataRefresh = null;
      let arweaveNodeDataRefresh = null;
      let peersDataRefresh: PeersInfo | null = null;

      // Fetch upload service info
      try {
        const config = getCurrentConfig();
        const uploadResponse = await fetch(config.uploadServiceUrl);
        uploadData = await uploadResponse.json();
        setUploadServiceInfo(uploadData);
      } catch (err) {
        console.warn('Failed to fetch upload service info:', err);
      }

      // Fetch gateway info from configured AR.IO gateway
      const config = getCurrentConfig();
      const gatewayUrl = config.arioGatewayUrl.replace(/\/$/, ''); // Remove trailing slash
      try {
        const gatewayResponse = await fetch(`${gatewayUrl}/ar-io/info`);
        gatewayData = await gatewayResponse.json();
        setGatewayInfo(gatewayData);
      } catch (err) {
        console.warn('Failed to fetch gateway info:', err);
      }

      // Fetch peers info from configured gateway
      try {
        const peersResponse = await fetch(`${gatewayUrl}/ar-io/peers`);
        const peersRaw = await peersResponse.json();
        peersDataRefresh = {
          gatewayCount: Object.keys(peersRaw.gateways || {}).length,
          arweaveNodeCount: Object.keys(peersRaw.arweaveNodes || {}).length,
        };
        setPeersInfo(peersDataRefresh);
      } catch (err) {
        console.warn('Failed to fetch peers info:', err);
      }

      // Fetch AR.IO gateway info (if we have gateway wallet address)
      if (gatewayData?.wallet) {
        try {
          const { getARIO } = await import('../utils');
          const io = getARIO();
          arIOData = await io.getGateway({
            address: gatewayData.wallet,
          });
          setArIOGatewayInfo(arIOData);
        } catch (err) {
          console.warn('Gateway not found in ar.io network or lookup failed:', err);
          // This is expected for some gateways - they might not be registered in AR.IO
        }
      }

      // Fetch Arweave node info from gateway
      if (uploadData?.gateway) {
        try {
          const gatewayHost = uploadData.gateway.replace('https://', '');
          const arweaveResponse = await fetch(`https://${gatewayHost}/info`);
          arweaveNodeDataRefresh = await arweaveResponse.json();
          setArweaveNodeInfo(arweaveNodeDataRefresh);
        } catch (err) {
          console.warn('Failed to fetch Arweave node info:', err);
        }
      }

      // ar.io rate and the infrastructure fee inside it
      try {
        pricingDataRefresh = await fetchPricingInfo(turboConfig);
        setPricingInfo(pricingDataRefresh);
      } catch (err) {
        console.warn('Failed to fetch pricing info:', err);
      }

      // Cache the fresh results
      const cacheData: CachedGatewayInfo = {
        data: {
          uploadServiceInfo: uploadData,
          gatewayInfo: gatewayData,
          arIOGatewayInfo: arIOData,
          pricingInfo: pricingDataRefresh,
          arweaveNodeInfo: arweaveNodeDataRefresh,
          peersInfo: peersDataRefresh,
        },
        timestamp: Date.now(),
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh gateway information');
    } finally {
      setRefreshing(false);
    }
  };

  return {
    uploadServiceInfo,
    gatewayInfo,
    arIOGatewayInfo,
    pricingInfo,
    arweaveNodeInfo,
    peersInfo,
    loading,
    error,
    refreshing,
    refresh,
  };
}
