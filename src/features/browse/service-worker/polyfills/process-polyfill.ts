/**
 * Process polyfill for service worker
 * Some dependencies check for `process` or `process.env` which don't exist in service workers
 * Must be imported before any code that might reference process
 */

declare const self: ServiceWorkerGlobalScope;

// Create a minimal process shim
const processShim = {
  env: {},
  browser: true,
  version: '',
  versions: {},
  nextTick: (fn: () => void) => setTimeout(fn, 0),
};

// Install on globalThis so it's available everywhere
(globalThis as Record<string, unknown>).process = processShim;
(self as unknown as Record<string, unknown>).process = processShim;

export {};
