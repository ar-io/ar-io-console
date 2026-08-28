import { useEffect, useRef } from 'react';
import { getWallets } from '@wallet-standard/app';
import { useStandardWallets } from '@privy-io/react-auth/solana';

/**
 * Makes Privy's embedded Solana wallet visible to `@solana/wallet-adapter-react`.
 *
 * Privy builds a genuine Wallet Standard wallet — `PrivyStandardWallet`
 * exposes `StandardConnect`, `SolanaSignTransaction` and `SolanaSignMessage`
 * — but it never calls `registerWallet`, so nothing announces it to the page.
 * The adapter discovers wallets purely through that registry, which is why an
 * email user's Solana wallet would otherwise be invisible to every ArNS
 * surface even though it exists and can sign.
 *
 * Registering it here means Phantom, Solflare and the Privy wallet all arrive
 * through the same `useWallet()`, so `useArNSTurboSigner` and the linked-wallet
 * flow need no Privy-specific branch. An email user gets a Solana signer they
 * never had to install.
 *
 * Registration is idempotent per wallet: `register` returns an unregister
 * callback, and re-registering the same object would leave a duplicate in the
 * adapter's list, so each is tracked and released on unmount.
 */
export function PrivySolanaBridge() {
  const { ready, wallets } = useStandardWallets();
  const registered = useRef(new Map<unknown, () => void>());

  useEffect(() => {
    if (!ready) return;
    const api = getWallets();
    const seen = registered.current;

    for (const wallet of wallets) {
      if (seen.has(wallet)) continue;
      try {
        seen.set(wallet, api.register(wallet));
      } catch {
        /*
          A duplicate or malformed registration must never take the app down —
          the cost of failing here is one missing wallet option, and the user
          can still connect an extension wallet.
        */
      }
    }
  }, [ready, wallets]);

  useEffect(() => {
    const seen = registered.current;
    return () => {
      for (const unregister of seen.values()) {
        try {
          unregister();
        } catch {
          /* nothing useful to do while tearing down */
        }
      }
      seen.clear();
    };
  }, []);

  return null;
}
