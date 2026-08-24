import { CheckCircle2, Circle, CreditCard, Coins, Wallet } from 'lucide-react';

import type { SupportedTokenType } from '../../../constants';

import type { PaymentOption } from '../purchase/paymentOptions';
import type { ArNSPaymentBalances } from '../hooks/useArNSPaymentBalances';

/**
 * Which unit the price is quoted in. Not a payment method — several methods
 * share a unit (card, balance and a token top-up all resolve to credits).
 */
export type ArNSPriceUnit = 'credits' | 'ario';
export type ArNSFundingSource = 'balance' | 'any' | 'stakes';

const fmt = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 2 });

interface Props {
  options: PaymentOption[];
  selectedId: string;
  fundingSource: ArNSFundingSource;
  balances: ArNSPaymentBalances;
  onSelect: (id: string) => void;
  onSourceChange: (s: ArNSFundingSource) => void;
  disabled?: boolean;
  /**
   * Collapse the picker to just the ARIO funding-source rows. Used where ARIO
   * is the only possible payment (returned-name auctions always settle from the
   * wallet's ARIO at the premium price — see ReturnedNameBuyModal).
   */
  arioOnly?: boolean;
}

/**
 * Brand coins for the tokens people recognise by their mark.
 *
 * Both are drawn on the same dark disc at the same size, so ARIO and SOL read
 * as a matched set rather than two logos that happen to share a row. Anything
 * without its own mark (a card, a credit balance) keeps a line icon — those are
 * categories, not brands, and inventing a logo for them would be noise.
 */
const TOKEN_COIN: Partial<Record<SupportedTokenType, string>> = {
  ario: 'brand/ario-token-logo.svg',
  solana: 'brand/solana-token-logo.svg',
};

function OptionIcon({ option, active }: { option: PaymentOption; active: boolean }) {
  const coin = option.token ? TOKEN_COIN[option.token] : undefined;
  if (coin) {
    return (
      <img
        src={`${import.meta.env.BASE_URL}${coin}`}
        alt=""
        aria-hidden="true"
        // Sized to sit on the same baseline as the 16px line icons beside it.
        className={`h-5 w-5 rounded-full transition-opacity ${
          active ? '' : 'opacity-80'
        }`}
      />
    );
  }
  const Icon =
    option.kind === 'card' ? CreditCard : option.kind === 'balance' ? Coins : Wallet;
  return <Icon className="h-4 w-4" />;
}

function OptionCard({
  option,
  active,
  disabled,
  onClick,
}: {
  option: PaymentOption;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-start gap-2 rounded-2xl border p-3 text-left transition-colors disabled:opacity-50 ${
        active
          ? 'border-primary bg-primary/10'
          : 'border-border/20 bg-card hover:border-primary/40'
      }`}
    >
      <span
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center ${
          active ? 'text-primary' : 'text-foreground/60'
        }`}
      >
        <OptionIcon option={option} active={active} />
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-foreground">{option.label}</span>
        {option.detail && (
          <span className="block truncate text-xs text-foreground/60">
            {option.detail}
          </span>
        )}
        {/* Say it's short here rather than only failing on submit. */}
        {!option.sufficient && (
          <span className="block text-xs text-foreground/60">Not enough</span>
        )}
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
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors disabled:opacity-50 ${
        active
          ? 'border-primary bg-primary/10'
          : 'border-border/20 bg-card hover:border-primary/40'
      }`}
    >
      {active ? (
        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-primary" />
      ) : (
        <Circle className="h-4 w-4 flex-shrink-0 text-foreground/40" />
      )}
      <span className="font-medium text-foreground">{label}</span>
      <span className="ml-auto font-mono text-xs text-foreground/60">
        {fmt(amount)} ARIO
      </span>
    </button>
  );
}

/**
 * How you want to pay for a name — one flat row of equals: a card, whichever
 * tokens this wallet can sign, and your existing balance when you have one.
 *
 * It used to lead with "Turbo Credits vs ARIO tokens", which asked the user to
 * pick our billing subsystem before picking a payment. Choosing credits with an
 * empty balance then opened a modal asking the *same* question again — card or
 * crypto? — one layer down. Turbo is how we settle, not a thing to choose.
 */
export function ArNSPaymentSelector({
  options,
  selectedId,
  fundingSource,
  balances,
  onSelect,
  onSourceChange,
  disabled,
  arioOnly = false,
}: Props) {
  const showSources =
    arioOnly || options.find((o) => o.id === selectedId)?.token === 'ario';

  return (
    <div>
      {!arioOnly && (
        <>
          <label className="mb-2 block text-sm font-medium">Pay with</label>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {options.map((option) => (
              <OptionCard
                key={option.id}
                option={option}
                active={option.id === selectedId}
                disabled={disabled}
                onClick={() => onSelect(option.id)}
              />
            ))}
          </div>
        </>
      )}

      {showSources && (
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
