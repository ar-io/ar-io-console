/**
 * Build the RenderCtx for publishing a page. The data/tx gateway comes from the
 * active console config (used to resolve `ar://<txId>`), while the ArNS host is the
 * ar.io network's canonical name host for the current mode:
 *   - production → `ar.io`
 *   - development (Testnet) → `ar-io.dev`
 *   - custom → the custom gateway's own hostname (a custom gateway serves its own ArNS)
 *
 * The ArNS host is intentionally NOT derived from the production `arioGatewayUrl`
 * (`turbo-gateway.com`): that is the upload/data gateway and does not serve ArNS
 * names, so `<name>.turbo-gateway.com` would not resolve. This mirrors how the rest
 * of the console renders ArNS URLs, and is mode-correct on Testnet (where Deploy
 * currently hardcodes `.ar.io`).
 *
 * Pure and node-testable — the publish hook is a thin wrapper around it.
 */

import type { RenderCtx } from '../render/renderPageHtml';
import type { PageDef } from '../schema';

export type PagesConfigMode = 'production' | 'development' | 'custom';

/** Canonical ArNS name host per mode. `custom` derives from the gateway hostname. */
const ARNS_HOST_BY_MODE: Record<PagesConfigMode, string | undefined> = {
  production: 'ar.io',
  development: 'ar-io.dev',
  custom: undefined,
};

/** Fallback ArNS host when the mode is unknown and no gateway is configured. */
export const DEFAULT_ARNS_HOST = 'ar.io';

export interface RenderCtxConfig {
  /** e.g. `https://turbo-gateway.com` (production) or `https://ar-io.dev` (dev). */
  arioGatewayUrl?: string;
  /** Active console config mode — selects the ArNS name host. */
  configMode?: PagesConfigMode;
}

export interface RenderCtxOpts {
  /** The page's canonical ArNS label (base `name` or `under_name`). */
  arnsName?: string;
  /** The page's own tx id — only known AFTER upload, so omitted at publish time. */
  selfTxId?: string;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname || DEFAULT_ARNS_HOST;
  } catch {
    const stripped = url
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
      .replace(/[/?#].*$/, '')
      .trim();
    return stripped || DEFAULT_ARNS_HOST;
  }
}

/** Resolve the ArNS name host for the active config/mode. */
export function arnsHostFor(config: RenderCtxConfig): string {
  const byMode = config.configMode ? ARNS_HOST_BY_MODE[config.configMode] : undefined;
  if (byMode) return byMode;
  // Custom mode (or unknown): the configured gateway serves its own ArNS names.
  return config.arioGatewayUrl ? hostnameOf(config.arioGatewayUrl) : DEFAULT_ARNS_HOST;
}

export function renderCtxFor(
  _def: PageDef,
  config: RenderCtxConfig,
  opts: RenderCtxOpts = {},
): RenderCtx {
  const gateway = (config.arioGatewayUrl || 'https://turbo-gateway.com').replace(/\/+$/, '');
  const ctx: RenderCtx = { gateway, arnsHost: arnsHostFor(config) };
  if (opts.arnsName) ctx.arnsName = opts.arnsName;
  if (opts.selfTxId) ctx.selfTxId = opts.selfTxId;
  return ctx;
}
