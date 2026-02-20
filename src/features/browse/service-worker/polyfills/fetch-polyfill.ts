/**
 * Service Worker Fetch Polyfill
 *
 * IMPORTANT: This file must be imported FIRST in service-worker.ts
 *
 * Zone.js (loaded by OpenTelemetry for context propagation) patches the global
 * `fetch` function. However, in service workers, the patched version loses its
 * binding to `WorkerGlobalScope`, causing "Illegal invocation" errors.
 *
 * This polyfill captures the native fetch before Zone.js can patch it.
 * All service worker code should import and use `nativeFetch` directly
 * rather than relying on the global `fetch`.
 */

declare const self: ServiceWorkerGlobalScope;

// Capture the native fetch immediately, before any other code runs
// This happens at module evaluation time, before Zone.js loads
const nativeFetch = self.fetch.bind(self);

// Export for direct use - this is the primary way to use native fetch
// All call sites in manifest-verifier.ts and gateway-health.ts should import this
export { nativeFetch };
