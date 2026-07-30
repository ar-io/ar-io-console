import { CheckCircle2, Circle, Coins, Wallet } from 'lucide-react';

import type { ArNSPaymentBalances } from '../hooks/useArNSPaymentBalances';

export type ArNSPaymentMethod = 'credits' | 'ario';
export type ArNSFundingSource = 'balance' | 'any' | 'stakes';

const fmt = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 2 });

interface Props {
  method: ArNSPaymentMethod;
  fundingSource: ArNSFundingSource;
  balances: ArNSPaymentBalances;
  onMethodChange: (m: ArNSPaymentMethod) => void;
  onSourceChange: (s: ArNSFundingSource) => void;
  disabled?: boolean;
}

function MethodCard({
  active,
  disabled,
  onClick,
  icon,
  title,
  sub,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-start gap-2 p-3 rounded-2xl border text-left transition-colors disabled:opacity-50 ${
        active
          ? 'border-primary bg-primary/10'
          : 'border-border/20 bg-card hover:border-primary/40'
      }`}
    >
      <span className="mt-0.5 text-primary">{icon}</span>
      <span className="min-w-0">
        <span className="block font-medium text-foreground">{title}</span>
        <span className="block text-xs text-foreground/60 truncate">{sub}</span>
      </span>
    </button>
  );
}

function SourceRow({
  active,
  disabled,
  onClick,
  label,
  amount,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  amount: number;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors disabled:opacity-50 ${
        active
          ? 'border-primary bg-primary/10'
          : 'border-border/20 bg-card hover:border-primary/40'
      }`}
    >
      {active ? (
        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
      ) : (
        <Circle className="h-4 w-4 text-foreground/40 flex-shrink-0" />
      )}
      <span className="font-medium text-foreground">{label}</span>
      <span className="ml-auto font-mono text-xs text-foreground/60">
        {fmt(amount)} ARIO
      </span>
    </button>
  );
}

/**
 * Payment-method picker for an ArNS action: Turbo Credits vs the wallet's ARIO
 * tokens, and — when ARIO is chosen — which ARIO source funds it (liquid /
 * liquid + staked / staked). Mirrors arns-react's funding UX, with balances
 * shown inline so the choice is informed.
 */
export function ArNSPaymentSelector({
  method,
  fundingSource,
  balances,
  onMethodChange,
  onSourceChange,
  disabled,
}: Props) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">Pay with</label>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <MethodCard
          active={method === 'credits'}
          disabled={disabled}
          onClick={() => onMethodChange('credits')}
          icon={<Coins className="h-4 w-4" />}
          title="Turbo Credits"
          sub={`${fmt(balances.credits)} available`}
        />
        <MethodCard
          active={method === 'ario'}
          disabled={disabled}
          onClick={() => onMethodChange('ario')}
          icon={<Wallet className="h-4 w-4" />}
          title="ARIO tokens"
          sub={`${fmt(balances.totalArio)} ARIO available`}
        />
      </div>

      {method === 'ario' && (
        <div className="mb-3 space-y-2">
          <p className="text-xs font-medium text-foreground/70">Funding source</p>
          <SourceRow
            active={fundingSource === 'balance'}
            disabled={disabled}
            onClick={() => onSourceChange('balance')}
            label="Liquid"
            amount={balances.liquidArio}
          />
          <SourceRow
            active={fundingSource === 'any'}
            disabled={disabled}
            onClick={() => onSourceChange('any')}
            label="Liquid + Staked"
            amount={balances.totalArio}
          />
          <SourceRow
            active={fundingSource === 'stakes'}
            disabled={disabled}
            onClick={() => onSourceChange('stakes')}
            label="Staked"
            amount={balances.stakedArio}
          />
        </div>
      )}
    </div>
  );
}
