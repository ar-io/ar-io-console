import { useId, useState } from 'react';

import type { PaymentOption } from '../purchase/paymentOptions';
import type { ArNSPaymentBalances } from '../hooks/useArNSPaymentBalances';
import type { WalletKind } from '../../../utils/walletTokens';
import { formatHeldBalance } from '../purchase/formatBalance';
import {
  PaymentPicker,
  SegmentedControl,
  type MethodChoice,
} from '../../payments/components/PaymentPicker';
import {
  buildSources,
  cheapestUsd,
  creditsShortReason,
  groupSources,
  isSelectable,
  methodForOption,
  paidFromLine,
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

const usd = (n: number): string =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  /** The wallet note, folded into the picker's status line. */
  note?: string;
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

/**
 * How you want to pay for a name: Credits, Card or Crypto, with every token in
 * one select (SPEC-payment-sources § 7.1, § 7.2).
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
  const fundingHeadingId = useId();
  const selected = options.find((o) => o.id === selectedId);
  const showSources = arioOnly || selected?.token === 'ario';

  const sources =
    sourcesProp ?? buildSources({ tokens: sourceInputsFromOptions(options) });
  const session = sessionWalletType ?? 'solana';
  // ARIO's group first: it is the best price, and on an Ethereum session it
  // would otherwise open below five EVM rows.
  const groups = groupSources(sources, session, { leadToken: 'ario' });

  /*
    The token Crypto opens on: the last one the user picked, kept while it is
    still offered, else the preselection.
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
    // Still selectable when short, as it always has been; dimmed, with the
    // shortfall on hover and in the status line once chosen.
    const shortBy =
      !credits.sufficient
        ? prices?.credits !== undefined
          ? creditsShortReason(balances.credits, prices.credits)
          : 'Not enough credits'
        : undefined;
    choices.push({
      value: 'credits',
      label: 'Credits',
      sub:
        prices?.credits !== undefined
          ? `${formatHeldBalance(prices.credits)} credits`
          : undefined,
      hint: shortBy,
      status: shortBy ?? `You have ${formatHeldBalance(balances.credits)} credits`,
      statusTone: shortBy ? 'error' : 'muted',
    });
  }
  if (card) {
    choices.push({
      value: 'card',
      label: 'Card',
      sub: prices?.cardUsd !== undefined ? usd(prices.cardUsd) : undefined,
      status: card.detail,
    });
  }
  if (sources.length > 0) {
    /*
      "from $X": the cheapest dollar figure known without a new lookup (ARIO
      through its rate, USDC at face value). Failing that, the token Crypto
      would open on, in its own unit. Never a guessed conversion.
    */
    const fromUsd = cheapestUsd(sources, arioUsdRate);
    choices.push({
      value: 'crypto',
      label: 'Crypto',
      sub:
        fromUsd !== undefined
          ? `from ${usd(fromUsd)}`
          : cryptoSource?.price !== undefined
            ? `${formatHeldBalance(cryptoSource.price)} ${cryptoSource.label}`
            : undefined,
    });
  }

  const onMethodChange = (method: PaymentMethod) => {
    if (method === 'credits' && credits) onSelect(credits.id);
    else if (method === 'card' && card) onSelect(card.id);
    else if (method === 'crypto') {
      // Choosing Crypto is one click: it takes the token the select already
      // holds. If that token cannot be paid with, nothing changes; silently
      // swapping in another would pay with something the user did not pick.
      if (cryptoSource && isSelectable(cryptoSource)) onSelect(cryptoSource.id);
    }
  };

  /*
    Said only when the wallet that pays is not the one signed in, which today
    means ARIO on an Arweave or Ethereum session: it comes from the linked
    Solana wallet. Not when the host's wallet note is shown, though: that note
    already names the paying wallet, and one screen says it once.
  */
  const paidFrom =
    cryptoSource && cryptoSource.wallet !== session && !note
      ? paidFromLine(cryptoSource.wallet).replace(/^Paid/, 'paid')
      : undefined;

  const usdFor = (s: PaymentSource) =>
    s.token === 'ario' && arioUsdRate !== undefined && s.price !== undefined
      ? `≈ ${usd(s.price * arioUsdRate)}`
      : undefined;

  return (
    <div>
      {!arioOnly && (
        <div>
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
        <div className={arioOnly ? '' : 'mt-3'}>
          <p id={fundingHeadingId} className="mb-1 text-xs font-medium text-foreground/70">
            Funding source
          </p>
          <SegmentedControl
            labelledBy={fundingHeadingId}
            value={fundingSource}
            onChange={onSourceChange}
            disabled={disabled}
            segments={[
              {
                value: 'balance',
                label: 'Liquid',
                sub: `${formatHeldBalance(balances.liquidArio)} ARIO`,
              },
              {
                value: 'any',
                label: 'Liquid + Staked',
                shortLabel: 'Both',
                sub: `${formatHeldBalance(balances.totalArio)} ARIO`,
              },
              {
                value: 'stakes',
                label: 'Staked',
                sub: `${formatHeldBalance(balances.stakedArio)} ARIO`,
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
