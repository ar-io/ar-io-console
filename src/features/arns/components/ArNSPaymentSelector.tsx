import { useState } from 'react';
import { CheckCircle2, Circle, CreditCard, Coins, Wallet } from 'lucide-react';

import type { PaymentOption } from '../purchase/paymentOptions';
import type { ArNSPaymentBalances } from '../hooks/useArNSPaymentBalances';
import type { WalletKind } from '../../../utils/walletTokens';
import {
  PaymentPicker,
  type MethodChoice,
} from '../../payments/components/PaymentPicker';
import {
  buildSources,
  creditsShortReason,
  formatSourceAmount,
  groupSources,
  isSelectable,
  methodForOption,
  paidFromLine,
  preselectSource,
  resolveSourceSelection,
  sourceInputsFromOptions,
  type PaymentMethod,
  type PaymentSource,
} from '../../payments/paymentSources';

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
  /** Empty while the checkout is still choosing its default: nothing is shown selected. */
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
  /** Optional line explaining the choice, rendered under the heading. */
  note?: React.ReactNode;
  /**
   * The crypto dropdown's rows, from `buildSources`. Built by the host because
   * it holds the balances and quotes, and because the checkout's preselection
   * reads the same rows. Absent, they are derived from `options` with nothing
   * known about them.
   */
  sources?: PaymentSource[];
  /** The session wallet, so its group leads and a foreign source says where it pays from. */
  sessionWalletType?: WalletKind;
  /** What this purchase costs as credits, and as a card charge in dollars. */
  prices?: { credits?: number; cardUsd?: number };
  /** Dollars per ARIO, to put ARIO's saving next to the card's dollar price. */
  arioUsdRate?: number;
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
      /*
        One row on desktop, matching the payment picker directly above. Three
        stacked full-width rows made a sub-choice look like a second decision of
        equal weight to "how do you want to pay", when it only refines the ARIO
        option.
      */
      className={`flex flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors disabled:opacity-50 sm:basis-0 sm:flex-col sm:items-start sm:gap-0.5 ${
        active
          ? 'border-primary bg-primary/10'
          : 'border-border/20 bg-card hover:border-primary/40'
      }`}
    >
      <span className="flex items-center gap-2">
        {active ? (
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-primary" />
        ) : (
          <Circle className="h-4 w-4 flex-shrink-0 text-foreground/40" />
        )}
        <span className="font-medium text-foreground">{label}</span>
      </span>
      {/* Stacked under the label on desktop so a long balance can't squeeze
          the label in a third-width column. */}
      <span className="ml-auto font-mono text-xs text-foreground/60 sm:ml-6">
        {fmt(amount)} ARIO
      </span>
    </button>
  );
}

/**
 * How you want to pay for a name: Credits, Card or Crypto, with every token in
 * one dropdown (SPEC-payment-sources § 7.1, § 7.2).
 *
 * The options are still `buildPaymentOptions`' and the ids the host routes on
 * are unchanged ('balance', 'card', 'token:<token>'). This component only
 * regroups them: which option is selected, and so how the purchase settles, is
 * decided exactly as before.
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
  note,
  sources: sourcesProp,
  sessionWalletType,
  prices,
  arioUsdRate,
}: Props) {
  const selected = options.find((o) => o.id === selectedId);
  const showSources = arioOnly || selected?.token === 'ario';

  const sources =
    sourcesProp ?? buildSources({ tokens: sourceInputsFromOptions(options) });
  const session = sessionWalletType ?? 'solana';
  const groups = groupSources(sources, session);

  /*
    The token the dropdown shows while Card or Credits is selected: the last one
    the user picked, kept while it is still offered, else the preselection.
  */
  const [lastCryptoId, setLastCryptoId] = useState<string | undefined>();
  const cryptoSource = resolveSourceSelection(
    sources,
    selected?.kind === 'token' ? selected.id : lastCryptoId,
    'name-checkout',
  );

  const credits = options.find((o) => o.kind === 'balance');
  const card = options.find((o) => o.kind === 'card');
  const choices: MethodChoice[] = [];
  if (credits) {
    const short = !credits.sufficient;
    choices.push({
      method: 'credits',
      label: 'Credits',
      icon: <Coins className="h-4 w-4" />,
      detail: credits.detail,
      price:
        prices?.credits !== undefined
          ? `${formatSourceAmount(prices.credits)} credits`
          : undefined,
      reason: short
        ? prices?.credits !== undefined
          ? creditsShortReason(balances.credits, prices.credits)
          : 'Not enough'
        : undefined,
    });
  }
  if (card) {
    choices.push({
      method: 'card',
      label: 'Card',
      icon: <CreditCard className="h-4 w-4" />,
      detail: card.detail,
      price:
        prices?.cardUsd !== undefined
          ? `$${prices.cardUsd.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : undefined,
    });
  }
  if (sources.length > 0) {
    choices.push({
      method: 'crypto',
      label: 'Crypto',
      icon: <Wallet className="h-4 w-4" />,
    });
  }

  const onMethodChange = (method: PaymentMethod) => {
    if (method === 'credits' && credits) onSelect(credits.id);
    else if (method === 'card' && card) onSelect(card.id);
    else if (method === 'crypto') {
      // Choosing Crypto is one click: it takes the token the dropdown already
      // shows, or the preselection if that one cannot be paid with.
      const target =
        cryptoSource && isSelectable(cryptoSource)
          ? cryptoSource
          : preselectSource(sources, 'name-checkout');
      if (target) onSelect(target.id);
    }
  };

  // Said only when the wallet that pays is not the one signed in, which today
  // means ARIO on an Arweave or Ethereum session: it comes from the linked
  // Solana wallet.
  const paidFrom =
    cryptoSource && cryptoSource.wallet !== session
      ? paidFromLine(cryptoSource.wallet)
      : undefined;

  const usdFor = (s: PaymentSource) =>
    s.token === 'ario' && arioUsdRate !== undefined && s.price !== undefined
      ? `≈ $${(s.price * arioUsdRate).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : undefined;

  return (
    <div>
      {!arioOnly && (
        <div className="mb-3">
          <PaymentPicker
            choices={choices}
            value={selected ? methodForOption(selected) : undefined}
            onChange={onMethodChange}
            disabled={disabled}
            note={note}
            crypto={{
              groups,
              selectedId: cryptoSource?.id,
              onSelect: (id) => {
                setLastCryptoId(id);
                onSelect(id);
              },
              note: paidFrom,
              usdFor,
            }}
          />
        </div>
      )}

      {showSources && (
        <div className="mb-3">
          <p className="mb-2 text-xs font-medium text-foreground/70">
            Funding source
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
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
        </div>
      )}
    </div>
  );
}
