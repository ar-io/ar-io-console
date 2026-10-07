import { useStore } from '@/store/useStore';
import { arnsHostFor } from '@/features/pages/publish/renderCtx';

/** `undername_name`, or `name` for the root. */
export function assignedLabel(name: string, undername?: string): string {
  return undername ? `${undername}_${name}` : name;
}

/** The host serving this network's names: ar.io on mainnet, the testnet gateway on devnet. */
export function useArnsHost(): string {
  const configMode = useStore((s) => s.configMode);
  const arioGatewayUrl = useStore((s) => s.getCurrentConfig().arioGatewayUrl);
  return arnsHostFor({ configMode, arioGatewayUrl });
}
