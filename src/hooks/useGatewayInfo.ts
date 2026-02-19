import { useState, useEffect } from 'react';
import { type AoGateway } from '@ar.io/sdk';
import { TurboFactory } from '@ardrive/turbo-sdk/web';
import { useTurboConfig } from './useTurboConfig';
import { useStore } from '../store/useStore';

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
type ArIOGatewayInfo = AoGateway;

interface PricingInfo {
  wincPerGiB: string;
  usdPerGiB: number;
  baseGatewayPrice?: number;
  turboFeePercentage?: number;
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

const CACHE_KEY_PREFIX = 'turbo-gateway-info';
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
            arIOData = await io.getGateway({ address: gatewayData.wallet });
            setArIOGatewayInfo(arIOData);
          } catch (err) {
            console.warn('Gateway not found in AR.IO network or lookup failed:', err);
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

        // Compare Turbo's rate vs raw Arweave network cost
        try {
          console.log('🔍 Calculating ar.io premium vs raw Arweave network cost...');
          const turbo = TurboFactory.unauthenticated(turboConfig);
          const gigabyteInBytes = 1073741824; // 1 GiB in bytes

          // Step 1: Get Turbo's USD rate for 1 GiB
          console.log('💳 Getting Turbo fiat rates...');
          const fiatRates = await turbo.getFiatRates();
          const turboUSDPerGiB = fiatRates.fiat?.usd || 0;
          console.log('💰 Turbo USD per GiB:', turboUSDPerGiB);

          // Step 2: Get raw Arweave network cost (winston) and AR/USD price
          let arweaveUSDPerGiB = undefined;
          let arweaveWinstonPerGiB = undefined;

          try {
            // Fetch raw Arweave network price (returns winston - smallest AR unit)
            // 1 AR = 10^12 winston
            const arweaveResponse = await fetch(`https://arweave.net/price/${gigabyteInBytes}`);
            arweaveWinstonPerGiB = Number(await arweaveResponse.text());
            console.log('🌐 Raw Arweave winston for 1 GiB:', arweaveWinstonPerGiB);

            // Fetch AR/USD price from CoinGecko
            const cgResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd');
            const cgData = await cgResponse.json();
            const arUSDPrice = cgData.arweave?.usd;
            console.log('📈 AR/USD price:', arUSDPrice);

            if (arweaveWinstonPerGiB && arUSDPrice) {
              // Convert winston to AR, then to USD
              // winston / 10^12 = AR, AR * USD/AR = USD
              const arPerGiB = arweaveWinstonPerGiB / 1e12;
              arweaveUSDPerGiB = arPerGiB * arUSDPrice;
              console.log('💵 Raw Arweave USD per GiB:', arweaveUSDPerGiB);
            }
          } catch (err) {
            console.warn('❌ Arweave network pricing fetch failed:', err);
          }

          // Step 3: Calculate the premium (Turbo vs raw Arweave)
          let turboFeePercentage = undefined;

          if (turboUSDPerGiB > 0 && arweaveUSDPerGiB && arweaveUSDPerGiB > 0) {
            // Premium = (Turbo price - Arweave price) / Arweave price * 100
            turboFeePercentage = ((turboUSDPerGiB - arweaveUSDPerGiB) / arweaveUSDPerGiB) * 100;

            console.log('🧮 ar.io Premium calculation:', {
              turboUSDPerGiB,
              arweaveUSDPerGiB,
              premiumPercentage: turboFeePercentage
            });
          }

          pricingData = {
            wincPerGiB: arweaveWinstonPerGiB?.toString() || '0',
            usdPerGiB: turboUSDPerGiB || 0,
            baseGatewayPrice: arweaveUSDPerGiB,
            turboFeePercentage: turboFeePercentage,
          };

          console.log('💾 Final pricing data:', pricingData);
          setPricingInfo(pricingData);
        } catch (err) {
          console.warn('❌ Pricing calculation failed:', err);
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
        console.log('Gateway info cached for 10 minutes');

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
          arIOData = await io.getGateway({ address: gatewayData.wallet });
          setArIOGatewayInfo(arIOData);
        } catch (err) {
          console.warn('Gateway not found in AR.IO network or lookup failed:', err);
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

      // Fetch pricing information - compare Turbo vs raw Arweave network cost
      try {
        const turbo = TurboFactory.unauthenticated(turboConfig);
        const gigabyteInBytes = 1073741824; // 1 GiB in bytes

        // Step 1: Get Turbo's USD rate for 1 GiB
        const fiatRates = await turbo.getFiatRates();
        const turboUSDPerGiB = fiatRates.fiat?.usd || 0;

        // Step 2: Get raw Arweave network cost (winston) and AR/USD price
        let arweaveUSDPerGiB = undefined;
        let arweaveWinstonPerGiB = undefined;

        try {
          // Fetch raw Arweave network price (returns winston)
          const arweaveResponse = await fetch(`https://arweave.net/price/${gigabyteInBytes}`);
          arweaveWinstonPerGiB = Number(await arweaveResponse.text());

          // Fetch AR/USD price from CoinGecko
          const cgResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd');
          const cgData = await cgResponse.json();
          const arUSDPrice = cgData.arweave?.usd;

          if (arweaveWinstonPerGiB && arUSDPrice) {
            const arPerGiB = arweaveWinstonPerGiB / 1e12;
            arweaveUSDPerGiB = arPerGiB * arUSDPrice;
          }
        } catch (err) {
          console.warn('Arweave network pricing fetch failed:', err);
        }

        // Step 3: Calculate the premium
        let turboFeePercentage = undefined;

        if (turboUSDPerGiB > 0 && arweaveUSDPerGiB && arweaveUSDPerGiB > 0) {
          turboFeePercentage = ((turboUSDPerGiB - arweaveUSDPerGiB) / arweaveUSDPerGiB) * 100;
        }

        pricingDataRefresh = {
          wincPerGiB: arweaveWinstonPerGiB?.toString() || '0',
          usdPerGiB: turboUSDPerGiB || 0,
          baseGatewayPrice: arweaveUSDPerGiB,
          turboFeePercentage: turboFeePercentage,
        };
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