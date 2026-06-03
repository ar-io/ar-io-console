/**
 * Buffer polyfill for service worker
 * crypto-browserify and other dependencies need Buffer available globally
 * Must be imported before any code that might reference Buffer
 */

import { Buffer } from 'buffer';

declare const self: ServiceWorkerGlobalScope;

// Install Buffer on globalThis so it's available everywhere
(globalThis as Record<string, unknown>).Buffer = Buffer;
(self as unknown as Record<string, unknown>).Buffer = Buffer;

export { Buffer };
