import { useId, useState } from 'react';

import type { PaymentOption } from '../purchase/paymentOptions';
import type { ArNSPaymentBalances } from '../hooks/useArNSPaymentBalances';
import type { WalletKind } from '../../../utils/walletTokens';
import type { SupportedTokenType } from '../../../constants';
import { formatHeldBalance } from '../purchase/formatBalance';
import {
  PaymentPicker,
  SegmentedControl,
  type MethodChoice,
} from '../../payments/components/PaymentPicker';
import {
  applyBestPriceBadge,
  DOLLAR_STABLECOINS,
  buildSources,
  cheapestUsd,
  extraCostLabel,
  sourceUsd,
  creditsShortReason,
  formatSourceAmount,
  groupSources,
  isSelectable,
  methodForOption,
  preselectSource,
  resolveSourceSelection,
  sourceInputsFromOptions,
  type PaymentMethod,
  type PaymentSource,
  type UsdRates,
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
  /**
   * Dollars per whole token (`useTokenUsdRates`), so every row can carry a
   * dollar figure and "Best price" is judged against all of them.
   */
  usdRates?: UsdRates;
  /**
   * Dollars a route costs beyond its own price: ARIO's SOL for the name's
   * accounts and fee. ARIO counts toward "from $X" only when this is known.
   */
  extraUsd?: Partial<Record<SupportedTokenType, number | undefined>>;
  /** The same extra cost in SOL, stated on ARIO's row ("+ 0.056 SOL"). */
  extraSol?: Partial<Record<SupportedTokenType, number | undefined>>;
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
  sources: sourcesProp,
  sessionWalletType,
  prices,
  usdRates = {},
  extraUsd,
  extraSol,
}: Props) {
  const fundingHeadingId = useId();
  /*
    Crypto with nothing payable in it still opens its list, so the reasons can
    be read, without touching what the purchase is routed on.
  */
  const [previewCrypto, setPreviewCrypto] = useState(false);
  const selected = options.find((o) => o.id === selectedId);
  /*
    Funding source only matters to someone with ARIO staked: with none, every
    choice draws from the same liquid balance, and three segments would ask a
    question with one answer. Still shown if a source other than liquid is
    already chosen, so the control never disappears from under a choice it
    holds.
  */
  const showSources =
    (arioOnly || selected?.token === 'ario') &&
    (balances.stakedArio > 0 || fundingSource !== 'balance');

  /*
    "Best price" only when it is true for this purchase: ARIO's all-in price
    (its SOL included) is known and nothing payable, card included, is
    cheaper. The option still carries the badge; this decides whether it shows.
  */
  const sources = applyBestPriceBadge(
    sourcesProp ?? buildSources({ tokens: sourceInputsFromOptions(options) }),
    { usdRates, extraUsd: extraUsd ?? {}, cardUsd: prices?.cardUsd },
  );
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
          ? `${formatSourceAmount(prices.credits)} credits`
          : undefined,
      hint: shortBy,
      // Only the shortfall: what you hold is a number, and it sits with the
      // others in the cost summary.
      status: shortBy,
      statusTone: 'error',
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
    const fromUsd = cheapestUsd(sources, usdRates, extraUsd);
    const payable = sources.some(isSelectable);
    choices.push({
      value: 'crypto',
      label: 'Crypto',
      sub: !payable
        ? // Never a silent dead control: say why, and the click opens the
          // list with each token's reason.
          'No token can pay this'
        : fromUsd !== undefined
          ? `from ${usd(fromUsd)}`
          : cryptoSource && isSelectable(cryptoSource) && cryptoSource.price !== undefined
            ? `${formatSourceAmount(cryptoSource.price)} ${cryptoSource.label}`
            : undefined,
      hint: payable ? undefined : 'No token in your wallet can pay for this',
    });
  }

  const onMethodChange = (method: PaymentMethod) => {
    setPreviewCrypto(false);
    if (method === 'credits' && credits) onSelect(credits.id);
    else if (method === 'card' && card) onSelect(card.id);
    else if (method === 'crypto') {
      /*
        One click: the token the select already holds, or, if that one cannot
        pay, the best one that can (it shows in the select, so nothing is
        swapped out of sight). If none can, the list opens to show why, and
        the purchase stays routed where it was.
      */
      const target =
        cryptoSource && isSelectable(cryptoSource)
          ? cryptoSource
          : preselectSource(sources.filter(isSelectable), 'name-checkout');
      if (target) {
        setLastCryptoId(target.id);
        onSelect(target.id);
      } else {
        setPreviewCrypto(true);
      }
    }
  };

  /*
    "≈ $" on every row whose dollar price is known, so the rows compare on one
    scale. ARIO's is its ALL-IN price, SOL included, to sit beside the others
    and the card's charge on equal terms; with its SOL cost unknown there is no
    dollar figure rather than a partial one. A stablecoin's amount already is
    dollars, so repeating it would only add a number.
  */
  const usdFor = (s: PaymentSource) => {
    if (DOLLAR_STABLECOINS.includes(s.token)) return undefined;
    const allIn = sourceUsd(s, usdRates, extraUsd ?? {});
    return allIn !== undefined ? `≈ ${usd(allIn)}` : undefined;
  };

  return (
    <div>
      {!arioOnly && (
        <div>
          <PaymentPicker
            choices={choices}
            value={selected ? methodForOption(selected) : undefined}
            // The segments keep showing what the purchase is routed on; the
            // list opens beside it only to explain why no token can pay.
            cryptoPreview={previewCrypto}
            onChange={onMethodChange}
            disabled={disabled}
            crypto={{
              groups,
              selectedId: cryptoSource?.id,
              onSelect: (id) => {
                setLastCryptoId(id);
                onSelect(id);
              },
              usdFor,
              extraFor: (s) => extraCostLabel(s, extraSol),
            }}
          />
        </div>
      )}

      {showSources && (
        // Auction modal (arioOnly): the same bottom margin it always had.
        <div className={arioOnly ? 'mb-3' : 'mt-3'}>
          <p id={fundingHeadingId} className="mb-2 text-sm font-medium">
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
