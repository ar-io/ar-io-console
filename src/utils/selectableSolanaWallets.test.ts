import { WalletReadyState } from '@solana/wallet-adapter-base';
import { describe, expect, it } from 'vitest';

import { selectableSolanaWallets } from './selectableSolanaWallets';

const wallet = (name: string, readyState: WalletReadyState) => ({
  adapter: { name },
  readyState,
});

describe('selectableSolanaWallets', () => {
  it('offers MetaMask when its Solana wallet is installed', () => {
    const out = selectableSolanaWallets([
      wallet('Phantom', WalletReadyState.Installed),
      wallet('MetaMask', WalletReadyState.Installed),
    ]);
    expect(out.map((w) => w.adapter.name)).toEqual(['Phantom', 'MetaMask']);
  });

  it('leaves out wallets that are not installed', () => {
    const out = selectableSolanaWallets([
      wallet('Phantom', WalletReadyState.NotDetected),
      wallet('Solflare', WalletReadyState.Loadable),
      wallet('Backpack', WalletReadyState.Installed),
    ]);
    expect(out.map((w) => w.adapter.name)).toEqual(['Backpack']);
  });

  it('lists a name once, keeping the first', () => {
    const first = wallet('MetaMask', WalletReadyState.Installed);
    const out = selectableSolanaWallets([
      first,
      wallet('MetaMask', WalletReadyState.Installed),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(first);
  });
});
