import { Info } from 'lucide-react';
import ArNSAssociationPanel from '@/components/ArNSAssociationPanel';
import { useLinkedSolanaWallet } from '@/hooks/useLinkedSolanaWallet';

interface DomainControlsProps {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  selectedName: string;
  onNameChange: (v: string) => void;
  selectedUndername: string;
  onUndernameChange: (v: string) => void;
  showUndername: boolean;
  onShowUndernameChange: (v: boolean) => void;
}

/**
 * Wraps the shared ArNSAssociationPanel for Pages. Publishing never requires a
 * domain — only *attaching* one needs a Solana wallet — so we frame the whole
 * section as optional and let the panel surface its own "link wallet" banner
 * (via useLinkedSolanaWallet) when linking is needed (PRD §7.8 / §13).
 */
export default function DomainControls({
  enabled,
  onEnabledChange,
  selectedName,
  onNameChange,
  selectedUndername,
  onUndernameChange,
  showUndername,
  onShowUndernameChange,
}: DomainControlsProps) {
  const { needsLinking } = useLinkedSolanaWallet();

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg bg-primary/5 px-3 py-2 text-xs text-foreground/70">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
        <span>
          {needsLinking
            ? 'You can publish now and attach a name later — assigning an ArNS domain needs a linked Solana wallet.'
            : 'Point an ArNS name (or undername) at your page. Optional — you can always add one later.'}
        </span>
      </div>
      <ArNSAssociationPanel
        enabled={enabled}
        onEnabledChange={onEnabledChange}
        selectedName={selectedName}
        onNameChange={onNameChange}
        selectedUndername={selectedUndername}
        onUndernameChange={onUndernameChange}
        showUndername={showUndername}
        onShowUndernameChange={onShowUndernameChange}
      />
    </div>
  );
}
