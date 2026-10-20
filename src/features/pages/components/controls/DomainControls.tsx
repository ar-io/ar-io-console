import { Info } from 'lucide-react';
import ArNSAssociationPanel from '@/components/ArNSAssociationPanel';
import DocsLink from '@/components/DocsLink';

interface DomainControlsProps {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  selectedName: string;
  onNameChange: (v: string) => void;
  selectedUndername: string;
  onUndernameChange: (v: string) => void;
  showUndername: boolean;
  onShowUndernameChange: (v: boolean) => void;
  /** Page title, used to prefill the register search when the user goes to get
   *  a name. See ArNSGetNameLinks. */
  suggestedName?: string;
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
  suggestedName,
}: DomainControlsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg bg-primary/5 px-3 py-2 text-xs text-foreground/70">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
        <span>
          Optional — add a domain now, or anytime after you publish.{' '}
          <DocsLink href="https://docs.ar.io/learn/arns">How ArNS works</DocsLink>
        </span>
      </div>
      <ArNSAssociationPanel
        suggestedName={suggestedName}
        bare
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
