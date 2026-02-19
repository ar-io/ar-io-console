/**
 * Service Worker Fetch Polyfill
 *
 * IMPORTANT: This file must be imported FIRST in service-worker.ts
 *
 * Zone.js (loaded by OpenTelemetry for context propagation) patches the global
 * `fetch` function. However, in service workers, the patched version loses its
 * binding to `WorkerGlobalScope`, causing "Illegal invocation" errors.
 *
 * This polyfill captures the native fetch before Zone.js can patch it and
 * restores it to ensure fetch works correctly in the service worker context.
 */

declare const self: ServiceWorkerGlobalScope;

// Capture the native fetch immediately, before any other code runs
// This happens at module evaluation time, before Zone.js loads
const nativeFetch = self.fetch.bind(self);

// Override the global fetch with our bound version
// This ensures that even if Zone.js tries to patch it, our version persists
Object.defineProperty(self, 'fetch', {
  value: nativeFetch,
  writable: true,
  configurable: true,
});

// Also export it for direct use if needed
export { nativeFetch };
