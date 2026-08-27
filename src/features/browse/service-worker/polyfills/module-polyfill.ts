/**
 * CommonJS compatibility polyfill for service worker
 * Some dependencies use CommonJS exports/module.exports which don't exist in ES modules
 * Must be imported FIRST before any other imports
 */

declare const self: ServiceWorkerGlobalScope;

// Create CommonJS-like module/exports objects
const moduleShim = { exports: {} };
const exportsShim = moduleShim.exports;

// Install on globalThis and self
(globalThis as Record<string, unknown>).module = moduleShim;
(globalThis as Record<string, unknown>).exports = exportsShim;
(self as unknown as Record<string, unknown>).module = moduleShim;
(self as unknown as Record<string, unknown>).exports = exportsShim;

export {};
