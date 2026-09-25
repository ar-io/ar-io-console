import { useEffect, useState } from 'react';
import { usePublicClient, useDisconnect } from 'wagmi';
import { mainnet, base, polygon } from 'wagmi/chains';
import { ShieldAlert } from 'lucide-react';
import { useStore } from '../store/useStore';
import { clearEthereumTurboClientCache } from '../hooks/useEthereumTurboClient';
import { clearX402SignerCache } from '../hooks/useX402Upload';
import { isContractWalletCode } from '../utils/contractWallet';
import BaseModal from './modals/BaseModal';
import ModalHeader from './modals/ModalHeader';

// Addresses already checked this page load, so a re-render or a store
// rehydrate does not repeat three RPC calls.
const checked = new Map<string, boolean>();

/**
 * Signs out an Ethereum session whose address is a smart-contract wallet.
 *
 * Turbo's Ethereum signer recovers a public key from a plain message
 * signature, which a contract or passkey wallet cannot produce. Such a wallet
 * can connect and even pay, but every signed action fails, so credits it buys
 * land on an address it can never spend from. Stopping it at connect time is
 * the only point that covers card and crypto top-ups alike.
 *
 * Checked on the three chains the console's wallets pay on. A lookup that
 * fails counts as a plain wallet: a flaky RPC must not sign anyone out.
 */
export default function ContractWalletGuard() {
  const { address, walletType, clearAddress, clearAllPaymentState } = useStore();
  const { disconnectAsync } = useDisconnect();
  const mainnetClient = usePublicClient({ chainId: mainnet.id });
  const baseClient = usePublicClient({ chainId: base.id });
  const polygonClient = usePublicClient({ chainId: polygon.id });
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (walletType !== 'ethereum' || !address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return;
    let cancelled = false;
    const key = address.toLowerCase();

    const check = async (): Promise<boolean> => {
      const cached = checked.get(key);
      if (cached !== undefined) return cached;
      const clients = [mainnetClient, baseClient, polygonClient].filter(
        (c): c is NonNullable<typeof c> => c !== undefined,
      );
      const codes = await Promise.all(
        clients.map((c) =>
          c.getCode({ address: key as `0x${string}` }).catch(() => undefined),
        ),
      );
      const isContract = codes.some((code) => isContractWalletCode(code));
      checked.set(key, isContract);
      return isContract;
    };

    check().then(async (isContract) => {
      if (cancelled || !isContract) return;
      console.warn('[Wallet] Smart-contract wallet detected, signing out:', address);
      try {
        await disconnectAsync();
      } catch {
        // Continue: the app session is cleared either way.
      }
      clearEthereumTurboClientCache();
      clearX402SignerCache();
      clearAllPaymentState();
      clearAddress();
      setBlocked(true);
    });

    return () => {
      cancelled = true;
    };
  }, [address, walletType, mainnetClient, baseClient, polygonClient, disconnectAsync, clearAddress, clearAllPaymentState]);

  if (!blocked) return null;

  return (
    <BaseModal onClose={() => setBlocked(false)}>
      <div className="w-[26rem] max-w-full">
        <ModalHeader
          icon={ShieldAlert}
          title="This wallet can't be used here"
          description="Smart-contract wallets"
        />
        <p className="mt-4 text-sm text-foreground/80">
          This is a smart-contract wallet. Uploads and credit payments on ar.io need a
          signature from a standard wallet, which this kind of wallet cannot give, so
          you have been signed out before anything was paid. Connect a standard
          wallet, or sign in with email.
        </p>
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setBlocked(false)}
            className="inline-flex items-center gap-2 bg-foreground text-white px-5 py-2.5 rounded-full font-semibold hover:opacity-90 transition-opacity"
          >
            OK
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
