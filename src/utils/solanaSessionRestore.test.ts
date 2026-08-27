import { describe, expect, it } from 'vitest';

import { canRestoreSolanaSession } from './solanaSessionRestore';

const base = {
  walletType: 'solana' as string | null,
  address: 'SoLaNaAddr',
  solanaPublicKey: null as string | null,
  solanaWalletName: 'Phantom' as string | null,
  installedWalletNames: ['Phantom', 'Solflare'],
};

describe('canRestoreSolanaSession', () => {
  it('defers to auto-reconnect when the remembered wallet is installed', () => {
    // The regression this fix exists for: previously this case signed the user
    // out on every reload.
    expect(canRestoreSolanaSession(base).action).toBe('defer-to-reconnect');
  });

  it('clears a session saved before the adapter name was persisted', () => {
    // Pre-fix sessions have no name — one final sign-out, then it stops.
    expect(canRestoreSolanaSession({ ...base, solanaWalletName: null }).action).toBe('clear');
  });

  it('clears when the remembered wallet is no longer installed', () => {
    expect(
      canRestoreSolanaSession({ ...base, installedWalletNames: ['Solflare'] }).action,
    ).toBe('clear');
  });

  it('does nothing when the adapter is already live', () => {
    expect(canRestoreSolanaSession({ ...base, solanaPublicKey: 'SoLaNaAddr' }).action).toBe('none');
  });

  it('does nothing for non-Solana identities', () => {
    for (const walletType of ['arweave', 'ethereum', null]) {
      expect(canRestoreSolanaSession({ ...base, walletType }).action).toBe('none');
    }
  });

  it('does nothing when there is no persisted session at all', () => {
    expect(canRestoreSolanaSession({ ...base, address: null }).action).toBe('none');
  });

  it('never clears a live session, even with no remembered name', () => {
    expect(
      canRestoreSolanaSession({
        ...base, solanaPublicKey: 'X', solanaWalletName: null, installedWalletNames: [],
      }).action,
    ).toBe('none');
  });
});
