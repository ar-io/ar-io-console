import { useMemo } from 'react';

import { useStore } from '../../../store/useStore';

/** The config fields that determine which ArNS network reads resolve against. */
interface ArNSRelevantConfig {
  coreProgramId?: string;
  garProgramId?: string;
  arnsProgramId?: string;
  antProgramId?: string;
  arioGatewayUrl?: string;
  tokenMap?: { solana?: string };
}

/**
 * Pure, stable identity string for the ArNS-relevant slice of a console config:
 * the Solana program IDs, gateway URL, and RPC endpoint that `getANT`/`getARIO`
 * resolve at call time. Two configs with the same signature address the same
 * on-chain data, so it is safe to share a cache entry between them.
 */
export function arnsConfigSignature(config: ArNSRelevantConfig): string {
  // JSON (not a delimiter-joined string) so no field value can collide with a
  // boundary — e.g. a program ID that happens to contain the delimiter.
  return JSON.stringify([
    config.coreProgramId ?? '',
    config.garProgramId ?? '',
    config.arnsProgramId ?? '',
    config.antProgramId ?? '',
    config.arioGatewayUrl ?? '',
    config.tokenMap?.solana ?? '',
  ]);
}

/**
 * Non-hook reader of the current ArNS config signature, straight from the store
 * global that `getANT`/`getARIO` already use. For module-level caches
 * (`loadArNSRegistry`) that must bust when the network changes but can't call a
 * hook. Returns `''` when the store isn't mounted (SSR / very early boot).
 */
export function readArNSConfigSignature(): string {
  if (typeof window !== 'undefined' && (window as any).__TURBO_STORE__) {
    const config = (window as any).__TURBO_STORE__.getState().getCurrentConfig();
    return arnsConfigSignature(config);
  }
  return '';
}

/**
 * A stable identity string for the active ArNS network config. Use it as a
 * react-query key segment on every on-chain ArNS read.
 *
 * Because the SDK clients are rebuilt from the live config on each query run,
 * the only thing that pins stale data is the query cache — so switching config
 * mode, OR editing program IDs / gateway / RPC while in custom mode, must change
 * the key to force a refetch against the new network. Selecting `configMode` +
 * `customConfig` covers both axes (they fully determine `getCurrentConfig()`).
 */
export function useArNSConfigKey(): string {
  const configMode = useStore((s) => s.configMode);
  const customConfig = useStore((s) => s.customConfig);
  const getCurrentConfig = useStore((s) => s.getCurrentConfig);

  return useMemo(
    () => arnsConfigSignature(getCurrentConfig()),
    // configMode + customConfig fully determine getCurrentConfig()'s output.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [configMode, customConfig, getCurrentConfig],
  );
}
