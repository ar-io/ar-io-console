import { useEffect, useState } from 'react';
import { useConfig, useDisconnect, usePublicClient } from 'wagmi';
import { mainnet, base, polygon } from 'wagmi/chains';
import { ShieldAlert } from 'lucide-react';
import { useStore } from '../store/useStore';
import { clearEthereumTurboClientCache } from '../hooks/useEthereumTurboClient';
import { clearX402SignerCache } from '../hooks/useX402Upload';
import { isContractWalletCode } from '../utils/contractWallet';
import { SMART_CONTRACT_CONNECTOR_IDS } from '../utils/walletConnectors';
import BaseModal from './modals/BaseModal';
import ModalHeader from './modals/ModalHeader';

// Answers already settled this page load, so a re-render or a store rehydrate
// does not repeat three RPC calls. Only a definite answer is cached: one that
// found contract code, or one where every chain replied. A failed lookup is
// asked again next time rather than remembered as "plain wallet".
const checked = new Map<string, boolean>();

/**
 * Signs out an Ethereum session whose address is a smart-contract wallet.
 *
 * Turbo's Ethereum signer recovers a public key from a plain message
 * signature, which a contract or passkey wallet cannot produce. Such a wallet
 * can connect and even pay, but every signed action fails, so credits it buys
 * land on an address it can never spend from.
 *
 * Two signals, either of which signs out:
 * - contract code on a chain the console's wallets pay on (EIP-7702
 *   delegations excepted, see `isContractWalletCode`);
 * - a session restored from a connector this app no longer offers (Base
 *   Account, Safe). wagmi skips such a connector on reconnect without clearing
 *   our store, which would otherwise leave a signed-in session that can sign
 *   nothing.
 *
 * A lookup that fails counts as a plain wallet: a flaky RPC must not sign
 * anyone out. Privy sessions never reach the sign-out: Privy is not a wagmi
 * connector here and creates EOAs. If Privy smart wallets are ever enabled,
 * this must call Privy's logout too, or its login effect re-sets the address.
 */
export default function ContractWalletGuard() {
  const address = useStore((s) => s.address);
  const walletType = useStore((s) => s.walletType);
  const clearAddress = useStore((s) => s.clearAddress);
  const clearAllPaymentState = useStore((s) => s.clearAllPaymentState);
  const wagmiConfig = useConfig();
  const { disconnectAsync } = useDisconnect();
  const mainnetClient = usePublicClient({ chainId: mainnet.id });
  const baseClient = usePublicClient({ chainId: base.id });
  const polygonClient = usePublicClient({ chainId: polygon.id });
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (walletType !== 'ethereum' || !address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return;
    let cancelled = false;
    const key = address.toLowerCase();

    const fromRetiredConnector = async (): Promise<boolean> => {
      try {
        const id = await wagmiConfig.storage?.getItem('recentConnectorId');
        return typeof id === 'string' && SMART_CONTRACT_CONNECTOR_IDS.has(id);
      } catch {
        return false;
      }
    };

    const hasContractCode = async (): Promise<boolean> => {
      const cached = checked.get(key);
      if (cached !== undefined) return cached;
      const clients = [mainnetClient, baseClient, polygonClient].filter(
        (c): c is NonNullable<typeof c> => c !== undefined,
      );
      const results = await Promise.all(
        clients.map((c) =>
          c.getCode({ address: key as `0x${string}` }).then(
            (code) => ({ ok: true, code }),
            () => ({ ok: false, code: undefined }),
          ),
        ),
      );
      const isContract = results.some((r) => isContractWalletCode(r.code));
      if (isContract || results.every((r) => r.ok)) checked.set(key, isContract);
      return isContract;
    };

    (async () => {
      const unsupported = (await fromRetiredConnector()) || (await hasContractCode());
      if (cancelled || !unsupported) return;
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
    })();

    return () => {
      cancelled = true;
    };
  }, [address, walletType, wagmiConfig, mainnetClient, baseClient, polygonClient, disconnectAsync, clearAddress, clearAllPaymentState]);

  if (!blocked) return null;

  return (
    <BaseModal onClose={() => setBlocked(false)}>
      <div
        className="flex flex-col p-4 text-foreground sm:p-5"
        style={{ minWidth: 'min(85vw, 400px)', maxWidth: 'min(95vw, 440px)' }}
      >
        <ModalHeader
          icon={ShieldAlert}
          title="Wallet not supported"
          description="Smart-contract wallets can't sign on ar.io"
        />
        <p className="text-sm text-foreground/80">
          This is a smart-contract wallet. Uploading and spending credits need a
          signature from a standard wallet, which this kind of wallet cannot give,
          so it has been signed out. Connect a standard wallet, or sign in with
          email.
        </p>
        <div className="mt-5 flex justify-end">
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
