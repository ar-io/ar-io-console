import { useState } from 'react';
import { Link2, Loader2, Wallet } from 'lucide-react';

import { useStore } from '../store/useStore';
import { useArNSTurboSigner } from '../features/arns/hooks/useArNSTurboSigner';
import { useLinkedSolanaWallet } from '../hooks/useLinkedSolanaWallet';
import LinkSolanaWalletModal from './modals/LinkSolanaWalletModal';
import WalletSelectionModal from './modals/WalletSelectionModal';

interface SolanaGateButtonProps {
  /** The real action, run only once a live Solana signer is available. */
  onAction: () => void;
  /** Button label when the signer is ready. */
  children: React.ReactNode;
  /** Extra affordability/validation gating for the ready action (price, funds…). */
  disabled?: boolean;
  /** In-flight state for the ready action. */
  busy?: boolean;
  busyLabel?: React.ReactNode;
  /** Class for the READY action button. The gate (not-ready) button always uses
   *  a neutral primary style so a destructive action's red button never bleeds
   *  into the "link wallet" step. */
  className?: string;
  /** Short verb phrase for the gate copy, e.g. "buy this name", "manage this name". */
  actionVerb?: string;
}

const PRIMARY_BTN =
  'flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50';

/**
 * A primary action button that gates on a live Solana signer — the signer every
 * ArNS write needs. When ready it runs `onAction`; otherwise it transforms in
 * place into the right wallet step and never leaves the console:
 *   - no wallet at all → "Connect a wallet" (WalletSelectionModal)
 *   - non-Solana wallet, none linked → "Link a Solana wallet" (keeps the primary
 *     identity; ArNS names live on Solana)
 *   - linked but the session's signer went cold → "Reconnect Solana wallet"
 * Once the signer becomes ready the button re-renders as the real action, so the
 * user meets the Solana step at the moment they commit — not as an upfront wall.
 */
export default function SolanaGateButton({
  onAction,
  children,
  disabled,
  busy,
  busyLabel,
  className,
  actionVerb = 'continue',
}: SolanaGateButtonProps) {
  const address = useStore((s) => s.address);
  const signer = useArNSTurboSigner();
  const { needsLinking } = useLinkedSolanaWallet();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [reconnect, setReconnect] = useState(false);

  if (signer.isReady) {
    return (
      <button
        onClick={onAction}
        disabled={disabled || busy}
        className={className ?? PRIMARY_BTN}
      >
        {busy ? (
          busyLabel ?? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Working…
            </>
          )
        ) : (
          children
        )}
      </button>
    );
  }

  const state = !address
    ? 'no-wallet'
    : needsLinking
      ? 'needs-link'
      : 'needs-reconnect';

  const open = () => {
    if (state === 'no-wallet') {
      setShowWalletModal(true);
    } else {
      setReconnect(state === 'needs-reconnect');
      setShowLinkModal(true);
    }
  };

  const label =
    state === 'no-wallet'
      ? 'Connect a wallet'
      : state === 'needs-link'
        ? 'Link a Solana wallet'
        : 'Reconnect Solana wallet';
  const Icon = state === 'needs-link' ? Link2 : Wallet;

  const hint =
    state === 'no-wallet'
      ? `Connect a wallet to ${actionVerb}. ArNS names are signed with a Solana wallet.`
      : state === 'needs-link'
        ? `ArNS names live on Solana. Link a Solana wallet to ${actionVerb} — your main account stays the same.`
        : `Your Solana session ended. Reconnect to ${actionVerb}.`;

  return (
    <>
      <button onClick={open} className={PRIMARY_BTN}>
        <Icon className="h-4 w-4" /> {label}
      </button>
      <p className="mt-2 text-center text-xs text-foreground/60">{hint}</p>

      {showWalletModal && (
        <WalletSelectionModal onClose={() => setShowWalletModal(false)} />
      )}
      {showLinkModal && (
        <LinkSolanaWalletModal
          isReconnect={reconnect}
          onClose={() => setShowLinkModal(false)}
        />
      )}
    </>
  );
}
