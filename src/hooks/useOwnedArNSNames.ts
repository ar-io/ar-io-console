import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../store/useStore';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { getARIO, getANT, getWritableANT, createWalletAdapterTransactionSendingSigner } from '../utils';
import { ArNSName } from '@/types';
// Decode ArNS punycode (xn--) names to their Unicode form for display. The browser
// URL/hostname APIs do NOT decode xn--, so we use a proper RFC 3492 decoder.
import { toUnicodeName as decodePunycode } from '../utils/punycode';
import { useTurboNameCustody } from '../features/arns/hooks/useNameCustody';
import { useCustodyOwnerClient } from '../features/arns/hooks/useCustodyOwnerClient';
import { mergeCustodialNames } from '../features/arns/custody/mergeCustodialNames';
import {
  turboRecordWriter,
  type TurboRecordClient,
} from '../features/arns/custody/writers';

interface ArNSUpdateResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

/** Structural view of the ANT writeable's record setters (v4.1.1 API). */
type ANTRecordWriteable = {
  setBaseNameRecord(p: {
    transactionId: string;
    ttlSeconds: number;
    targetProtocol: number;
  }): Promise<{ id: string }>;
  setUndernameRecord(p: {
    undername: string;
    transactionId: string;
    ttlSeconds: number;
    targetProtocol: number;
  }): Promise<{ id: string }>;
};

export function useOwnedArNSNames() {
  const { setOwnedArNSNames, getOwnedArNSNames, getArNSAddress } = useStore();
  const arnsAddress = getArNSAddress();
  const [names, setNames] = useState<ArNSName[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  // Monotonic request counter — only the latest fetchOwnedNames call may
  // update state, preventing a slow earlier request from overwriting a newer one.
  const fetchSeqRef = useRef(0);
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});
  const { connection: solanaConnection } = useConnection();
  const { publicKey: solanaPublicKey, signTransaction: solanaSignTransaction } = useWallet();

  /*
    Custodial names are invisible to everything above.

    `names` is derived from the ANT ACL, which indexes each ANT's OWNER — and
    for a Turbo-held name that is Turbo. So a name bought by card was missing
    from every picker built on this hook: Deploy Site, Capture and Assign
    Domain all offered a list that could not contain it. Pointing a name at a
    deployment is the main thing anyone does with one, so the buyer this route
    exists for could not do the main thing.
  */
  const { custodyOf, rows: custodyRows } = useTurboNameCustody();
  const { getClient: getOwnerClient } = useCustodyOwnerClient();

  /*
    Folded in at the boundary so every consumer sees them, rather than each
    picker remembering to merge — MyDomainsPage already had to do this by hand.
  */
  const namesWithCustodial = useMemo(
    () => mergeCustodialNames(names, custodyRows),
    [names, custodyRows],
  ) as ArNSName[];


  // Fetch names owned by the ArNS address (primary Solana or linked Solana)
  const fetchOwnedNames = useCallback(
    async (forceRefresh: boolean = false): Promise<ArNSName[]> => {
      if (!arnsAddress) return [];

      // Check cache first (unless forcing refresh)
      if (!forceRefresh) {
        const cached = getOwnedArNSNames(arnsAddress!);
        if (cached) {
          const arnsNames: ArNSName[] = cached.map((cached) => ({
            name: cached.name,
            displayName: decodePunycode(cached.name),
            processId: cached.processId,
            currentTarget: cached.currentTarget,
            lastUpdated: undefined,
            undernames: cached.undernames || [],
            type: cached.type,
            endTimestamp: cached.endTimestamp,
          }));
          setNames(arnsNames);
          return arnsNames;
        }
      }

      const seq = ++fetchSeqRef.current;
      const isCurrent = () => seq === fetchSeqRef.current;

      setLoading(true);
      setFetchError(false);
      try {
        // Use AR.IO SDK to get owned names with custom CU
        const ario = getARIO();
        const records = await ario.getArNSRecordsForAddress({
          address: arnsAddress!,
          limit: 100, // Get up to 100 names
          sortBy: 'startTimestamp',
          sortOrder: 'desc', // Most recent first
        });

        // Process names WITHOUT fetching ANT details (lazy loading approach).
        // `type`/`endTimestamp` come free in this batch response (no per-name call),
        // powering the expiry warnings on the account page.
        const processedNames: ArNSName[] = (records.items || []).map((record) => ({
          name: record.name,
          displayName: decodePunycode(record.name),
          processId: record.processId,
          currentTarget: undefined, // Will be fetched on-demand
          lastUpdated: record.startTimestamp ? new Date(record.startTimestamp) : undefined,
          undernames: undefined, // Will be fetched on-demand
          type: (record as any).type,
          endTimestamp: (record as any).endTimestamp,
        }));

        // Check if we have cached ANT details for any of these names
        const cached = getOwnedArNSNames(arnsAddress!);
        if (cached) {
          // Merge cached ANT details with fresh name list
          processedNames.forEach((name) => {
            const cachedName = cached.find((c) => c.name === name.name);
            if (cachedName) {
              name.currentTarget = cachedName.currentTarget;
              name.undernames = cachedName.undernames || [];
            }
          });
        }

        // Prepare cache data (only basic info, ANT details added on-demand)
        const cacheData = processedNames.map((name) => ({
          name: name.name,
          processId: name.processId,
          currentTarget: name.currentTarget,
          undernames: name.undernames,
          type: name.type,
          endTimestamp: name.endTimestamp,
        }));

        // Cache the results — only if this is still the latest request
        if (isCurrent()) {
          setOwnedArNSNames(arnsAddress!, cacheData);
          setNames(processedNames);
        }
        return processedNames;
      } catch (error) {
        console.error('Failed to fetch owned ArNS names:', error);
        if (isCurrent()) setFetchError(true);

        // If fetch fails, still try to use any cached data
        const cached = getOwnedArNSNames(arnsAddress!);
        if (cached && isCurrent()) {
          const fallbackNames: ArNSName[] = cached.map((cached) => ({
            name: cached.name,
            displayName: decodePunycode(cached.name),
            processId: cached.processId,
            currentTarget: cached.currentTarget,
            lastUpdated: undefined,
            undernames: cached.undernames || [],
            type: cached.type,
            endTimestamp: cached.endTimestamp,
          }));
          setNames(fallbackNames);
          return fallbackNames;
        }

        return [];
      } finally {
        if (isCurrent()) setLoading(false);
      }
    },
    [arnsAddress, getOwnedArNSNames, setOwnedArNSNames]
  );

  // Update ArNS name to point to new manifest
  const updateArNSRecord = useCallback(
    async (name: string, manifestId: string, undername?: string, customTTL?: number): Promise<ArNSUpdateResult> => {
      const nameRecord = namesWithCustodial.find((n) => n.name === name);
      if (!nameRecord) {
        return {
          success: false,
          error: 'ArNS name not found in your owned names',
        };
      }

      setUpdating((prev) => ({ ...prev, [name]: true }));

      try {
        /*
          A Turbo-held name cannot be written this way at all: the ANT belongs
          to Turbo, so signing the transaction with the user's wallet is
          rejected on-chain — and the buyer may hold no Solana wallet to sign
          with, that being why they are on this route. Turbo performs the write
          on their behalf instead, authenticated by the owner's signature.
        */
        if (custodyOf(name) === 'turbo-custodial') {
          const antId = nameRecord.processId;
          const turbo = (await getOwnerClient()) as unknown as TurboRecordClient;
          const writer = turboRecordWriter(antId, turbo);
          const ttlForTurbo =
            customTTL ??
            (undername ? nameRecord.undernameTTLs?.[undername] : nameRecord.ttl) ??
            600;
          const res = await writer.setRecord({
            // The base name is '@' on the wire; the callers pass '' for it.
            undername: undername || '@',
            transactionId: manifestId,
            ttlSeconds: ttlForTurbo,
          });
          return { success: true, transactionId: res.id };
        }

        if (!solanaPublicKey || !solanaSignTransaction) {
          return {
            success: false,
            error: 'Solana wallet not connected. Please reconnect to update ArNS records.',
          };
        }

        const signer = createWalletAdapterTransactionSendingSigner(
          solanaPublicKey.toBase58(),
          solanaConnection,
          undefined,
          solanaSignTransaction
        );

        const ant = await getWritableANT(nameRecord.processId, signer) as unknown as ANTRecordWriteable;

        // Determine TTL to use: custom > existing > default (600)
        let ttlToUse: number;
        if (customTTL !== undefined) {
          // User explicitly set a custom TTL
          ttlToUse = customTTL;
        } else if (undername && nameRecord.undernameTTLs?.[undername]) {
          // Preserve existing undername TTL
          ttlToUse = nameRecord.undernameTTLs[undername];
        } else if (!undername && nameRecord.ttl) {
          // Preserve existing base name TTL
          ttlToUse = nameRecord.ttl;
        } else {
          // Default for new records
          ttlToUse = 600;
        }

        let result;
        if (undername) {
          // Update undername record
          result = await ant.setUndernameRecord({
            undername,
            transactionId: manifestId,
            ttlSeconds: ttlToUse,
            targetProtocol: 0, // Arweave
          });
        } else {
          // Update base name record (@)
          result = await ant.setBaseNameRecord({
            transactionId: manifestId,
            ttlSeconds: ttlToUse,
            targetProtocol: 0, // Arweave
          });
        }

        // Refresh only the updated name's state for efficiency
        if (arnsAddress) {
          console.log('Refreshing ArNS state for updated name:', name);
          setTimeout(async () => {
            try {
              // Get fresh ANT state for just this name
              const nameRecord = namesWithCustodial.find((n) => n.name === name);
              if (nameRecord) {
                const ant = await getANT(nameRecord.processId);
                const freshState = await ant.getState();

                const updatedTarget = freshState.Records?.['@']?.transactionId;
                const updatedUndernames = Object.keys(freshState.Records || {}).filter((key) => key !== '@');

                // Update just this name in our local state
                setNames((prevNames) =>
                  prevNames.map((prevName) =>
                    prevName.name === name
                      ? {
                          ...prevName,
                          currentTarget: updatedTarget,
                          undernames: updatedUndernames,
                        }
                      : prevName
                  )
                );

                // Also update the cache with the refreshed data
                const cachedNames = getOwnedArNSNames(arnsAddress!) || [];
                const updatedCacheNames = cachedNames.map((cachedName) =>
                  cachedName.name === name
                    ? {
                        ...cachedName,
                        currentTarget: updatedTarget,
                        undernames: updatedUndernames,
                      }
                    : cachedName
                );

                // If the name wasn't in cache (shouldn't happen), add it
                if (!cachedNames.find((n) => n.name === name)) {
                  updatedCacheNames.push({
                    name: nameRecord.name,
                    processId: nameRecord.processId,
                    currentTarget: updatedTarget,
                    undernames: updatedUndernames,
                  });
                }

                setOwnedArNSNames(arnsAddress!, updatedCacheNames);
                console.log('Refreshed ANT state and cache for', name, ':', freshState);
              }
            } catch (error) {
              console.warn('Failed to refresh ANT state after update:', error);
              // Fallback to full refresh if selective refresh fails
              fetchOwnedNames(true);
            }
          }, 2000); // Small delay to allow network propagation
        }

        return {
          success: true,
          transactionId: result.id,
        };
      } catch (error) {
        console.error('Failed to update ArNS record:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update ArNS record. Please try again.',
        };
      } finally {
        setUpdating((prev) => ({ ...prev, [name]: false }));
      }
    },
    [
      namesWithCustodial,
      custodyOf,
      getOwnerClient,
      arnsAddress,
      fetchOwnedNames,
      getOwnedArNSNames,
      setOwnedArNSNames,
      solanaPublicKey,
      solanaConnection,
      solanaSignTransaction,
    ]
  );

  // Fetch ANT details for a specific name (on-demand)
  const fetchNameDetails = useCallback(
    async (name: string): Promise<ArNSName | null> => {
      const nameRecord = namesWithCustodial.find((n) => n.name === name);
      if (!nameRecord) return null;

      // Check if we already have complete details (both currentTarget and undernames defined)
      if (nameRecord.currentTarget !== undefined && nameRecord.undernames !== undefined) {
        console.log('Already have complete ANT details for:', name);
        return nameRecord;
      }

      setLoadingDetails((prev) => ({ ...prev, [name]: true }));

      try {
        console.log('Fetching ANT details on-demand for:', name);
        const ant = await getANT(nameRecord.processId);
        const state = await ant.getState();

        const currentTarget = state.Records?.['@']?.transactionId;
        const ttl = state.Records?.['@']?.ttlSeconds;
        const undernames = Object.keys(state.Records || {}).filter((key) => key !== '@');

        // Extract TTL for each undername
        const undernameTTLs: Record<string, number> = {};
        undernames.forEach((undername) => {
          const ttlSeconds = state.Records?.[undername]?.ttlSeconds;
          if (ttlSeconds !== undefined) {
            undernameTTLs[undername] = ttlSeconds;
          }
        });

        const updatedName: ArNSName = {
          ...nameRecord,
          currentTarget: currentTarget || undefined,
          ttl: ttl || 600, // Default to 600 if not set
          undernames,
          undernameTTLs,
        };

        // Update local state
        setNames((prevNames) => prevNames.map((n) => (n.name === name ? updatedName : n)));

        // Update cache with the new details
        if (arnsAddress) {
          const cachedNames = getOwnedArNSNames(arnsAddress!) || [];
          let updatedCache;

          // Check if this name is already in cache
          const existingIndex = cachedNames.findIndex((c) => c.name === name);
          if (existingIndex >= 0) {
            // Update existing cache entry
            updatedCache = [...cachedNames];
            updatedCache[existingIndex] = {
              name: nameRecord.name,
              processId: nameRecord.processId,
              currentTarget: currentTarget || undefined,
              undernames,
              ttl: ttl || 600,
              undernameTTLs,
              // Preserve expiry metadata so a detail fetch doesn't wipe the
              // expiry warnings on the next cache-backed render.
              type: nameRecord.type,
              endTimestamp: nameRecord.endTimestamp,
            };
          } else {
            // Add new cache entry
            updatedCache = [
              ...cachedNames,
              {
                name: nameRecord.name,
                processId: nameRecord.processId,
                currentTarget: currentTarget || undefined,
                undernames,
                ttl: ttl || 600,
                undernameTTLs,
                type: nameRecord.type,
                endTimestamp: nameRecord.endTimestamp,
              },
            ];
          }

          setOwnedArNSNames(arnsAddress!, updatedCache);
          console.log('Updated cache with ANT details for:', name);
        }

        console.log('Fetched ANT details for', name, ':', {
          currentTarget,
          undernames,
        });
        return updatedName;
      } catch (error) {
        console.error('Failed to fetch ANT details for', name, ':', error);

        // Even on error, mark as attempted by setting empty values
        const failedName: ArNSName = {
          ...nameRecord,
          currentTarget: undefined,
          undernames: [],
        };

        setNames((prevNames) => prevNames.map((n) => (n.name === name ? failedName : n)));

        return failedName;
      } finally {
        setLoadingDetails((prev) => ({ ...prev, [name]: false }));
      }
    },
    [namesWithCustodial, arnsAddress, getOwnedArNSNames, setOwnedArNSNames]
  );

  // Refresh a specific ArNS name's state
  const refreshSpecificName = useCallback(
    async (name: string): Promise<boolean> => {
      if (!arnsAddress) return false;

      console.log('Refreshing specific ArNS name:', name);
      const nameRecord = namesWithCustodial.find((n) => n.name === name);

      if (!nameRecord) {
        console.warn('Name not found in local state:', name);
        return false;
      }

      try {
        const ant = await getANT(nameRecord.processId);
        const freshState = await ant.getState();

        const updatedTarget = freshState.Records?.['@']?.transactionId;
        const updatedTTL = freshState.Records?.['@']?.ttlSeconds;
        const updatedUndernames = Object.keys(freshState.Records || {}).filter((key) => key !== '@');

        // Extract TTL for each undername
        const updatedUndernameTTLs: Record<string, number> = {};
        updatedUndernames.forEach((undername) => {
          const ttlSeconds = freshState.Records?.[undername]?.ttlSeconds;
          if (ttlSeconds !== undefined) {
            updatedUndernameTTLs[undername] = ttlSeconds;
          }
        });

        // Update local state
        setNames((prevNames) =>
          prevNames.map((prevName) =>
            prevName.name === name
              ? {
                  ...prevName,
                  currentTarget: updatedTarget,
                  ttl: updatedTTL || 600,
                  undernames: updatedUndernames,
                  undernameTTLs: updatedUndernameTTLs,
                }
              : prevName
          )
        );

        // Update cache
        const cachedNames = getOwnedArNSNames(arnsAddress!) || [];
        const updatedCacheNames = cachedNames.map((cachedName) =>
          cachedName.name === name
            ? {
                ...cachedName,
                currentTarget: updatedTarget,
                ttl: updatedTTL || 600,
                undernames: updatedUndernames,
                undernameTTLs: updatedUndernameTTLs,
              }
            : cachedName
        );

        // If the name wasn't in cache, add it
        if (!cachedNames.find((n) => n.name === name)) {
          updatedCacheNames.push({
            name: nameRecord.name,
            processId: nameRecord.processId,
            currentTarget: updatedTarget,
            ttl: updatedTTL || 600,
            undernames: updatedUndernames,
            undernameTTLs: updatedUndernameTTLs,
          });
        }

        setOwnedArNSNames(arnsAddress!, updatedCacheNames);
        console.log('Successfully refreshed ArNS name:', name, freshState);
        return true;
      } catch (error) {
        console.error('Failed to refresh specific ArNS name:', error);
        return false;
      }
    },
    [namesWithCustodial, arnsAddress, getOwnedArNSNames, setOwnedArNSNames]
  );

  // Auto-fetch when ArNS address is available (primary Solana or linked wallet)
  useEffect(() => {
    if (arnsAddress) {
      fetchOwnedNames();
    }
  }, [arnsAddress, fetchOwnedNames]);

  return {
    names: namesWithCustodial,
    loading,
    fetchError,
    updating,
    loadingDetails,
    fetchOwnedNames,
    fetchNameDetails,
    updateArNSRecord,
    refreshSpecificName,
  };
}
