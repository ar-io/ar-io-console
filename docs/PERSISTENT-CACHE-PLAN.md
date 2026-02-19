# Persistent Verification Cache Implementation Plan

## Overview

Enable verified Arweave content to persist across browser sessions, allowing instant loading on subsequent visits without re-verification. Since Arweave content is immutable (same txId = same bytes), cached verified content remains valid indefinitely.

## Current State

- **In-memory LRU cache** (`verified-cache.ts`) - 100MB limit
- Resources cached after verification passes
- Cache lost when service worker terminates
- Every new session requires full re-verification

## Proposed Solution

Use the browser's **Cache API** for response storage and **IndexedDB** for verification metadata tracking.

### Why This Approach

| Storage | Purpose | Persistence | Size Limit |
|---------|---------|-------------|------------|
| Cache API | Store verified Response objects | Survives SW restart | Browser-managed (usually % of disk) |
| IndexedDB | Track verification metadata | Survives SW restart | ~50% of free disk |
| Memory cache | Hot cache for active session | Lost on SW termination | 100MB (our limit) |

---

## Architecture

### Data Flow

```
User visits ar://ardrive
    │
    ▼
┌─────────────────────────────────────┐
│ 1. Resolve ArNS → manifest txId     │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 2. Check IndexedDB: Is this         │
│    manifest txId verified?          │
└─────────────────────────────────────┘
    │
    ├─── YES ──► Serve all resources from Cache API (instant)
    │
    └─── NO ───► Full verification flow
                    │
                    ▼
              ┌─────────────────────────────────────┐
              │ 3. Verify each resource             │
              │ 4. Store in Cache API               │
              │ 5. Record in IndexedDB              │
              └─────────────────────────────────────┘
```

### Cache Key Strategy

```
Cache API keys (URL-based):
  - arweave-verified://{txId}

IndexedDB structure:
  - manifests: { manifestTxId, arnsName, verifiedAt, resourceCount, totalBytes }
  - resources: { txId, manifestTxId, path, contentType, size, verifiedAt }
```

---

## Implementation Details

### Phase 1: IndexedDB Schema

**File:** `src/features/browse/service-worker/persistent-cache-db.ts`

```typescript
interface ManifestRecord {
  manifestTxId: string;        // Primary key
  arnsName?: string;           // ArNS name that resolved to this
  verifiedAt: number;          // Timestamp
  resourceCount: number;       // Number of resources in manifest
  totalBytes: number;          // Total size cached
  version: number;             // Schema version for migrations
}

interface ResourceRecord {
  txId: string;                // Primary key
  manifestTxId: string;        // Foreign key (indexed)
  path: string;                // Path within manifest
  contentType: string;
  size: number;
  verifiedAt: number;
}

// Database operations
class PersistentCacheDB {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'ar-io-console-verified-cache';
  private readonly DB_VERSION = 1;

  async open(): Promise<void>;
  async getManifest(txId: string): Promise<ManifestRecord | null>;
  async setManifest(record: ManifestRecord): Promise<void>;
  async getResourcesForManifest(manifestTxId: string): Promise<ResourceRecord[]>;
  async addResource(record: ResourceRecord): Promise<void>;
  async deleteManifest(manifestTxId: string): Promise<void>;
  async getAllManifests(): Promise<ManifestRecord[]>;
  async getTotalCacheSize(): Promise<number>;
  async clearAll(): Promise<void>;
}
```

### Phase 2: Cache API Integration

**File:** `src/features/browse/service-worker/persistent-cache-storage.ts`

```typescript
const CACHE_NAME = 'ar-io-verified-v1';

class PersistentCacheStorage {
  /**
   * Store a verified response in Cache API
   */
  async store(txId: string, response: Response, contentType: string): Promise<void> {
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = `arweave-verified://${txId}`;

    // Clone response and add verification headers
    const headers = new Headers(response.headers);
    headers.set('x-ar-io-verified', 'true');
    headers.set('x-ar-io-cached-at', Date.now().toString());

    const cachedResponse = new Response(await response.arrayBuffer(), {
      status: 200,
      headers,
    });

    await cache.put(cacheKey, cachedResponse);
  }

  /**
   * Retrieve a cached response
   */
  async get(txId: string): Promise<Response | null> {
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = `arweave-verified://${txId}`;
    return cache.match(cacheKey) || null;
  }

  /**
   * Check if resource is cached
   */
  async has(txId: string): Promise<boolean> {
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = `arweave-verified://${txId}`;
    const response = await cache.match(cacheKey);
    return response !== null;
  }

  /**
   * Delete cached resources for a manifest
   */
  async deleteForManifest(txIds: string[]): Promise<void> {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(txIds.map(txId =>
      cache.delete(`arweave-verified://${txId}`)
    ));
  }

  /**
   * Clear entire cache
   */
  async clearAll(): Promise<void> {
    await caches.delete(CACHE_NAME);
  }
}
```

### Phase 3: Unified Cache Manager

**File:** `src/features/browse/service-worker/cache-manager.ts`

```typescript
import { verifiedCache } from './verified-cache';  // In-memory
import { persistentCacheDB } from './persistent-cache-db';
import { persistentCacheStorage } from './persistent-cache-storage';

class CacheManager {
  /**
   * Check if a manifest is fully cached and verified
   */
  async isManifestCached(manifestTxId: string): Promise<boolean> {
    const record = await persistentCacheDB.getManifest(manifestTxId);
    return record !== null;
  }

  /**
   * Get a resource - checks memory first, then persistent cache
   */
  async getResource(txId: string): Promise<Response | null> {
    // 1. Check in-memory cache (fastest)
    const memCached = verifiedCache.get(txId);
    if (memCached) {
      return verifiedCache.toResponse(memCached);
    }

    // 2. Check persistent cache
    const persistentResponse = await persistentCacheStorage.get(txId);
    if (persistentResponse) {
      // Promote to memory cache for faster subsequent access
      const data = await persistentResponse.clone().arrayBuffer();
      verifiedCache.set(txId, {
        contentType: persistentResponse.headers.get('content-type') || 'application/octet-stream',
        data,
        headers: Object.fromEntries(persistentResponse.headers.entries()),
      });
      return persistentResponse;
    }

    return null;
  }

  /**
   * Store a verified resource in both caches
   */
  async storeResource(
    txId: string,
    manifestTxId: string,
    path: string,
    response: Response,
    contentType: string
  ): Promise<void> {
    const data = await response.clone().arrayBuffer();

    // Store in memory cache
    verifiedCache.set(txId, {
      contentType,
      data,
      headers: Object.fromEntries(response.headers.entries()),
    });

    // Store in persistent cache
    await persistentCacheStorage.store(txId, response.clone(), contentType);

    // Record in IndexedDB
    await persistentCacheDB.addResource({
      txId,
      manifestTxId,
      path,
      contentType,
      size: data.byteLength,
      verifiedAt: Date.now(),
    });
  }

  /**
   * Mark a manifest as fully verified and cached
   */
  async finalizeManifest(
    manifestTxId: string,
    arnsName: string | undefined,
    resourceCount: number,
    totalBytes: number
  ): Promise<void> {
    await persistentCacheDB.setManifest({
      manifestTxId,
      arnsName,
      verifiedAt: Date.now(),
      resourceCount,
      totalBytes,
      version: 1,
    });
  }

  /**
   * Delete a cached manifest and all its resources
   */
  async deleteManifest(manifestTxId: string): Promise<void> {
    const resources = await persistentCacheDB.getResourcesForManifest(manifestTxId);
    const txIds = resources.map(r => r.txId);

    // Clear from all caches
    verifiedCache.clearForManifest(txIds);
    await persistentCacheStorage.deleteForManifest(txIds);
    await persistentCacheDB.deleteManifest(manifestTxId);
  }

  /**
   * Get cache statistics for UI
   */
  async getStats(): Promise<CacheStats> {
    const manifests = await persistentCacheDB.getAllManifests();
    const totalBytes = await persistentCacheDB.getTotalCacheSize();

    return {
      manifestCount: manifests.length,
      totalBytes,
      manifests: manifests.map(m => ({
        name: m.arnsName || m.manifestTxId.slice(0, 8) + '...',
        manifestTxId: m.manifestTxId,
        resourceCount: m.resourceCount,
        size: m.totalBytes,
        verifiedAt: m.verifiedAt,
      })),
    };
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    verifiedCache.clear();
    await persistentCacheStorage.clearAll();
    await persistentCacheDB.clearAll();
  }
}

export const cacheManager = new CacheManager();
```

### Phase 4: Modify Manifest Verifier

**File:** `src/features/browse/service-worker/manifest-verifier.ts`

Changes needed:

```typescript
// In verifyAndCacheManifest():

// Before verification, check if already cached
const isCached = await cacheManager.isManifestCached(manifestTxId);
if (isCached) {
  logger.info(TAG, `Manifest ${manifestTxId} already verified, serving from cache`);
  broadcastEvent({ type: 'cache-hit', identifier, manifestTxId });
  return; // Skip verification, resources will be served from cache
}

// After successful verification of each resource:
await cacheManager.storeResource(txId, manifestTxId, path, response, contentType);

// After all resources verified:
await cacheManager.finalizeManifest(manifestTxId, arnsName, resourceCount, totalBytes);
```

### Phase 5: UI Integration

#### 5.1 Settings Panel Addition

**File:** `src/features/browse/components/BrowseSettingsFlyout.tsx`

Add a "Cache" section:

```tsx
{/* Cache Section */}
<div className="pt-4 border-t border-border/20">
  <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
    <Database className="w-4 h-4 text-primary" />
    Offline Cache
  </label>

  {/* Enable persistent caching */}
  <label className="flex items-center justify-between p-3 rounded-xl border border-border/20 cursor-pointer hover:border-border/40 transition-colors mb-3">
    <div>
      <div className="font-medium text-foreground">Enable Offline Cache</div>
      <div className="text-sm text-foreground/60">
        Store verified content for instant loading on future visits
      </div>
    </div>
    <input
      type="checkbox"
      checked={browseConfig.persistentCacheEnabled}
      onChange={(e) => setBrowseConfig({ persistentCacheEnabled: e.target.checked })}
      className="w-5 h-5 text-primary rounded focus:ring-primary"
    />
  </label>

  {/* Cache stats */}
  {cacheStats && (
    <div className="bg-card rounded-xl p-4 border border-border/20">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-foreground/60">Cached Sites</span>
        <span className="font-mono text-sm">{cacheStats.manifestCount}</span>
      </div>
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm text-foreground/60">Storage Used</span>
        <span className="font-mono text-sm">{formatBytes(cacheStats.totalBytes)}</span>
      </div>

      {/* List of cached manifests with delete buttons */}
      {cacheStats.manifests.length > 0 && (
        <div className="space-y-2 mt-3 pt-3 border-t border-border/20">
          {cacheStats.manifests.map((m) => (
            <div key={m.manifestTxId} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono text-foreground">{m.name}</span>
                <span className="text-foreground/40">{formatBytes(m.size)}</span>
              </div>
              <button
                onClick={() => handleDeleteCachedManifest(m.manifestTxId)}
                className="text-foreground/40 hover:text-red-600 transition-colors"
                title="Remove from cache"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleClearCache}
        className="w-full mt-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
      >
        Clear All Cache
      </button>
    </div>
  )}
</div>
```

#### 5.2 Cache Hit Indicator

When serving from cache, show a subtle indicator:

```tsx
// In the floating toolbar or verification badge area
{isCacheHit && (
  <div className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs">
    <Zap className="w-3 h-3" />
    <span>Cached</span>
  </div>
)}
```

### Phase 6: Service Worker Messages

Add new message types for cache management:

```typescript
// In service-worker.ts message handler:

case 'GET_CACHE_STATS':
  const stats = await cacheManager.getStats();
  event.ports[0]?.postMessage({ type: 'CACHE_STATS', stats });
  break;

case 'DELETE_CACHED_MANIFEST':
  await cacheManager.deleteManifest(data.manifestTxId);
  event.ports[0]?.postMessage({ type: 'MANIFEST_DELETED' });
  break;

case 'CLEAR_ALL_CACHE':
  await cacheManager.clearAll();
  event.ports[0]?.postMessage({ type: 'CACHE_CLEARED' });
  break;

case 'SET_PERSISTENT_CACHE_ENABLED':
  config.persistentCacheEnabled = data.enabled;
  break;
```

---

## Store Updates

**File:** `src/store/useStore.ts`

Add to BrowseConfig:

```typescript
interface BrowseConfig {
  // ... existing fields
  persistentCacheEnabled: boolean;  // Default: true
}

const DEFAULT_BROWSE_CONFIG: BrowseConfig = {
  // ... existing defaults
  persistentCacheEnabled: true,
};
```

---

## New Events

Broadcast these events for UI feedback:

```typescript
interface CacheHitEvent {
  type: 'cache-hit';
  identifier: string;
  manifestTxId: string;
  resourceCount: number;
  loadTimeMs: number;
}

interface CacheMissEvent {
  type: 'cache-miss';
  identifier: string;
  reason: 'not-cached' | 'stale' | 'disabled';
}

interface CacheStoredEvent {
  type: 'cache-stored';
  manifestTxId: string;
  resourceCount: number;
  totalBytes: number;
}
```

---

## File Summary

### New Files (6)

| File | Purpose |
|------|---------|
| `service-worker/persistent-cache-db.ts` | IndexedDB operations for metadata |
| `service-worker/persistent-cache-storage.ts` | Cache API operations for responses |
| `service-worker/cache-manager.ts` | Unified cache manager |
| `utils/cacheMessaging.ts` | UI ↔ SW cache communication |
| `hooks/useBrowseCache.ts` | React hook for cache stats/actions |
| `components/CacheStatsPanel.tsx` | Optional: dedicated cache management UI |

### Modified Files (5)

| File | Changes |
|------|---------|
| `service-worker/manifest-verifier.ts` | Check cache before verifying, store after |
| `service-worker/service-worker.ts` | Add cache message handlers |
| `components/BrowseSettingsFlyout.tsx` | Add cache settings section |
| `components/BrowsePanel.tsx` | Handle cache-hit events, show indicator |
| `store/useStore.ts` | Add `persistentCacheEnabled` config |

---

## Security Considerations

1. **Immutable content**: Arweave txIds are content-addressed (hash of content), so same txId = same bytes. Cached content cannot be "stale" in the traditional sense.

2. **ArNS updates**: An ArNS name might point to a new manifest txId. We detect this by checking if the resolved manifest txId matches what's cached. If different → re-verify.

3. **Cache poisoning**: Content is only cached AFTER successful hash verification. Unverified content is never persisted.

4. **Storage limits**: Browser manages Cache API limits. We should handle quota exceeded errors gracefully.

---

## Testing Checklist

- [ ] First visit: full verification, content cached
- [ ] Second visit: instant load from cache (no verification)
- [ ] ArNS update: new manifest detected, re-verification triggered
- [ ] Cache disabled: always verifies, never persists
- [ ] Delete single manifest: removes from all caches
- [ ] Clear all cache: empties everything
- [ ] Storage quota exceeded: graceful fallback to verify-only mode
- [ ] Service worker restart: cache survives, loads correctly
- [ ] Browser restart: cache survives, loads correctly
- [ ] Incognito mode: works but cache not persisted (expected)

---

## Future Enhancements

1. **Cache size limit setting**: Let users set max cache size
2. **Auto-cleanup**: Remove least-recently-used manifests when approaching limit
3. **Cache warming**: Pre-cache linked sites in background
4. **Export/import**: Backup cache to file for portability
5. **Sync across devices**: Optional cloud sync of verification metadata (not content)

---

## Implementation Order

1. **Phase 1-2**: IndexedDB + Cache API foundations
2. **Phase 3**: Cache manager unifying the layers
3. **Phase 4**: Manifest verifier integration
4. **Phase 5**: UI for settings and cache management
5. **Phase 6**: Service worker message handlers
6. **Testing**: Full test coverage
