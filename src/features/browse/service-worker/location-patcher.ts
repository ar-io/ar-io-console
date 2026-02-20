/**
 * Location Patcher for Verified Content
 *
 * Apps loaded via /ar-proxy/{identifier}/ see a different window.location
 * than they would if loaded directly from a gateway subdomain.
 *
 * This module injects a script into HTML responses that patches window.location
 * to make the app think it's running at {identifier}.{gateway-host}
 */

import { logger } from './logger';

const TAG = 'LocationPatcher';

/**
 * Escape a string for safe embedding in JavaScript.
 * Prevents XSS by escaping characters that could break out of string literals.
 */
function escapeForJs(str: string): string {
  return str
    .replace(/\\/g, '\\\\')     // Backslashes first
    .replace(/'/g, "\\'")        // Single quotes
    .replace(/"/g, '\\"')        // Double quotes
    .replace(/\n/g, '\\n')       // Newlines
    .replace(/\r/g, '\\r')       // Carriage returns
    .replace(/</g, '\\x3c')      // Less than (prevents </script> injection)
    .replace(/>/g, '\\x3e');     // Greater than
}

/**
 * Create the location patching script.
 *
 * Uses history.replaceState() to actually change location.pathname from
 * /ar-proxy/{identifier}/ to /. This works because:
 * 1. replaceState can change the URL to any same-origin path
 * 2. The service worker's absolute path interception still serves resources
 *    from the active identifier's verified cache
 * 3. The app sees location.pathname === '/' and routes correctly
 */
function createLocationPatchScript(identifier: string, gatewayUrl: string): string {
  // Parse the gateway URL to get the host (for debugging/future use)
  let gatewayHost: string;
  try {
    gatewayHost = new URL(gatewayUrl).host;
  } catch {
    gatewayHost = 'turbo-gateway.com';
  }

  // SECURITY: Escape all values to prevent XSS
  const safeIdentifier = escapeForJs(identifier);
  const safeGatewayHost = escapeForJs(gatewayHost);
  const simulatedHost = `${identifier}.${gatewayHost}`;
  const safeSimulatedHost = escapeForJs(simulatedHost);

  // The script to inject - runs before any app code
  // SECURITY: All interpolated values use escaped versions to prevent XSS
  return `<script data-wayfinder-location-patch>
(function() {
  const PROXY_PREFIX = '/ar-proxy/${safeIdentifier}';
  const originalPathname = window.location.pathname;
  const originalHref = window.location.href;

  // Calculate what the pathname should be without the proxy prefix
  let newPathname = '/';
  if (originalPathname.startsWith(PROXY_PREFIX)) {
    newPathname = originalPathname.slice(PROXY_PREFIX.length) || '/';
  }

  // Use history.replaceState to actually change the URL
  // This makes location.pathname return the correct value
  if (originalPathname !== newPathname) {
    try {
      const newUrl = newPathname + window.location.search + window.location.hash;
      history.replaceState(history.state, '', newUrl);
      console.log('[Wayfinder] URL rewritten:', originalPathname, '->', newPathname);
    } catch (e) {
      console.warn('[Wayfinder] Could not rewrite URL:', e);
    }
  }

  // Store debug info
  window.__wayfinderDebug = {
    originalPathname: originalPathname,
    originalHref: originalHref,
    rewrittenPathname: window.location.pathname,
    identifier: '${safeIdentifier}',
    gateway: '${safeGatewayHost}',
    simulatedHost: '${safeSimulatedHost}'
  };

  // Also expose a helper for apps that want gateway info
  window.__wayfinderContext = {
    identifier: '${safeIdentifier}',
    gateway: '${safeGatewayHost}',
    simulatedOrigin: 'https://${safeSimulatedHost}'
  };
})();
</script>`;
}

/**
 * Inject location patch into HTML content.
 * Returns the modified HTML with the patch script injected.
 */
export function injectLocationPatch(
  html: string,
  identifier: string,
  gatewayUrl: string
): string {
  const patchScript = createLocationPatchScript(identifier, gatewayUrl);

  // Try to inject right after <head> tag
  const headMatch = html.match(/<head[^>]*>/i);
  if (headMatch) {
    const insertPos = headMatch.index! + headMatch[0].length;
    const result = html.slice(0, insertPos) + patchScript + html.slice(insertPos);
    logger.debug(TAG, `Injected location patch for ${identifier}`);
    return result;
  }

  // Fallback: inject at the start of <html> content
  const htmlMatch = html.match(/<html[^>]*>/i);
  if (htmlMatch) {
    const insertPos = htmlMatch.index! + htmlMatch[0].length;
    const result = html.slice(0, insertPos) + patchScript + html.slice(insertPos);
    logger.debug(TAG, `Injected location patch for ${identifier} (after html tag)`);
    return result;
  }

  // Last resort: prepend to document
  logger.warn(TAG, `Could not find injection point, prepending patch for ${identifier}`);
  return patchScript + html;
}

/**
 * Check if content type is HTML.
 */
export function isHtmlContent(contentType: string): boolean {
  return contentType.toLowerCase().includes('text/html');
}
