import { useCallback, useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  getARIO,
  getANT,
  getWritableANT,
  createWalletAdapterTransactionSendingSigner,
} from '../utils';
import { ArNSName } from '@/types';
// Decode ArNS punycode (xn--) names to their Unicode form for display. The browser
// URL/hostname APIs do NOT decode xn--, so we use a proper RFC 3492 decoder.
import { toUnicodeName as decodePunycode } from '../utils/punycode';
import { useCustodyOwnerClient } from '../features/arns/hooks/useCustodyOwnerClient';
import { browserArNSOwnerSigner } from '../features/arns/actions/browserOwnerSigner';
import { useAntSummaries } from '../features/arns/hooks/useAntLogos';
import { deriveAntRoleStrict } from '../features/arns/antRole';
import {
  antRecordWriter,
  type ANTRecordWriteable,
} from '../features/arns/records/antWriter';
import { writerForRole } from '../features/arns/records/writerChoice';
import {
  sponsoredRecordWriter,
  type SponsoredRecordClient,
} from '../features/arns/records/sponsoredWriter';

interface ArNSUpdateResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

/** Structural view of the ANT writeable's record setters (v4.1.1 API). */

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
  const { getClient: getOwnerClient } = useCustodyOwnerClient();
  const { connection: solanaConnection } = useConnection();
  /*
    Roles for every name in the list, in one bulk read.

    "Your names" is Owned UNION Controlled, and the two write differently:
    Turbo sponsors the owner's record changes and rejects a controller's, since
    it verifies the owner proof against the current on-chain owner. Deploy Site,
    Capture, Assign Domain and Pages all publish through this hook, so getting
    this wrong breaks "deploy to a name I control" — an ordinary collaboration
    setup that worked before sponsorship.
  */
  const antSummaries = useAntSummaries(names.map((n) => n.processId));
  const {
    publicKey: solanaPublicKey,
    signTransaction: solanaSignTransaction,
    signMessage: solanaSignMessage,
  } = useWallet();

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
      const nameRecord = names.find((n) => n.name === name);
      if (!nameRecord) {
        return {
          success: false,
          error: 'ArNS name not found in your owned names',
        };
      }

      setUpdating((prev) => ({ ...prev, [name]: true }));

      try {
        /*
          Every record write goes through Turbo now, whoever owns the name.

          This used to fork: a Turbo-held name was written by Turbo, a
          user-owned one by the wallet's own ANT transaction. Custody is gone,
          and the sponsored route is strictly better for the surviving case —
          it is free, Turbo pays the Solana fee, and the owner approves a
          message rather than a transaction. So the fork, and the wallet's SOL
          requirement with it, collapses to one path.

          It also fixes a gap the fork had: the custodial branch returned
          early, so a write through Turbo never triggered the refresh below and
          the row kept showing its old target until a full reload.
        */
        if (!solanaPublicKey || !solanaSignTransaction || !solanaSignMessage) {
          return {
            success: false,
            error:
              'Connect the Solana wallet that owns this name to update its records.',
          };
        }

        // Custom > existing > default. Preserving a record's own TTL matters:
        // silently resetting it changes how long the old target stays cached,
        // which reads as the update not having taken effect.
        const ttlToUse =
          customTTL ??
          (undername
            ? nameRecord.undernameTTLs?.[undername]
            : nameRecord.ttl) ??
          600;

        /*
          Owner → Turbo pays the Solana fee. Controller → they sign and pay for
          themselves, which is what they were doing before sponsorship existed.
          An unresolved role waits rather than guessing: the wrong guess either
          burns a wallet prompt on a request that 401s, or charges an owner a
          fee they do not owe.
        */
        const role = deriveAntRoleStrict(
          antSummaries.get(nameRecord.processId),
          solanaPublicKey.toBase58(),
        );
        /*
          An unresolved role falls back to signing rather than blocking.

          The records editor blocks instead, and should: a person is watching,
          the summary resolves in a moment, and a wrong guess there costs a
          wallet prompt. This path is different — it runs mid-deploy, mid-
          capture, mid-publish, with nobody able to "try again in a moment".
          Blocking here would fail a deploy that used to work, which is a worse
          outcome than an owner occasionally paying a fee they could have
          avoided. It is also exactly what this path did before sponsorship.

          ACL drift makes this more than theoretical: "your names" is an
          eventually-consistent index, so a name can legitimately be in the
          list while the summary has not caught up.
        */
        const kind = writerForRole(role);

        let writer;
        if (kind !== 'sponsored') {
          const signer = createWalletAdapterTransactionSendingSigner(
            solanaPublicKey.toBase58(),
            solanaConnection,
            undefined,
            solanaSignTransaction,
          );
          writer = antRecordWriter(
            (await getWritableANT(
              nameRecord.processId,
              signer,
            )) as unknown as ANTRecordWriteable,
          );
        } else {
          const turbo = (await getOwnerClient()) as unknown as SponsoredRecordClient;
          writer = sponsoredRecordWriter(
            nameRecord.processId,
            turbo,
            browserArNSOwnerSigner({
              address: solanaPublicKey.toBase58(),
              signTransaction: solanaSignTransaction,
              signMessage: solanaSignMessage,
            }),
          );
        }

        const result = await writer.setRecord({
          // The base name is '@' on the wire; callers pass '' for it.
          undername: undername || '@',
          transactionId: manifestId,
          ttlSeconds: ttlToUse,
        });

        // Refresh only the updated name's state for efficiency
        if (arnsAddress) {
          console.log('Refreshing ArNS state for updated name:', name);
          setTimeout(async () => {
            try {
              // Get fresh ANT state for just this name
              const nameRecord = names.find((n) => n.name === name);
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
      names,
      getOwnerClient,
      arnsAddress,
      fetchOwnedNames,
      getOwnedArNSNames,
      setOwnedArNSNames,
      solanaPublicKey,
      solanaSignTransaction,
      solanaSignMessage,
      solanaConnection,
      antSummaries,
    ]
  );

  // Fetch ANT details for a specific name (on-demand)
  const fetchNameDetails = useCallback(
    async (name: string): Promise<ArNSName | null> => {
      const nameRecord = names.find((n) => n.name === name);
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
    [names, arnsAddress, getOwnedArNSNames, setOwnedArNSNames]
  );

  // Refresh a specific ArNS name's state
  const refreshSpecificName = useCallback(
    async (name: string): Promise<boolean> => {
      if (!arnsAddress) return false;

      console.log('Refreshing specific ArNS name:', name);
      const nameRecord = names.find((n) => n.name === name);

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
    [names, arnsAddress, getOwnedArNSNames, setOwnedArNSNames]
  );

  // Auto-fetch when ArNS address is available (primary Solana or linked wallet)
  useEffect(() => {
    if (arnsAddress) {
      fetchOwnedNames();
    }
  }, [arnsAddress, fetchOwnedNames]);

  return {
    names: names,
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
