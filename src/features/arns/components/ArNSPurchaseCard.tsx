import { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CreditCard,
  Infinity as InfinityIcon,
  Loader2,
  Wallet,
} from 'lucide-react';

import type { ArNSRegistrationType } from '../hooks/useArNSPrice';
import { useArNSPrice } from '../hooks/useArNSPrice';
import { useArNSCostDetails, type ArNSFundFrom } from '../hooks/useArNSCostDetails';
import { useArNSPaymentBalances } from '../hooks/useArNSPaymentBalances';
import { useArNSTurboSigner } from '../hooks/useArNSTurboSigner';
import { useCreditsForFiat } from '../../../hooks/useCreditsForFiat';
import { useArNSPricing } from '@/hooks/useArNSPricing';
import type { BuyArNSNameInput } from '../hooks/useBuyArNSName';
import {
  ArNSFundingSource,
  ArNSPaymentSelector,
} from './ArNSPaymentSelector';
import { isTokenSelectable, tokenLabels, type SupportedTokenType } from '../../../constants';
import {
  buildPaymentOptions,
  defaultPaymentOption,
} from '../purchase/paymentOptions';
import { resolveSettlementRoute } from '../purchase/settlementRoute';
import { planCardPurchase } from '../purchase/cardPlan';
import { useLinkedSolanaWallet } from '../../../hooks/useLinkedSolanaWallet';
import LinkSolanaWalletModal from '../../../components/modals/LinkSolanaWalletModal';
import { ArNSCostBreakdown } from './ArNSCostBreakdown';
import ArNSPaymentModal from './ArNSPaymentModal';
import ArNSCardPaymentModal from './ArNSCardPaymentModal';
import { useArNSTokenTopUp } from '../hooks/useArNSTokenTopUp';
import { useCryptoPriceForWinc } from '../../../hooks/useCryptoPrice';
import { useStore } from '../../../store/useStore';
import { stepLabel, failureAdvice } from '../purchase/topUpSteps';
import SolanaGateButton from '../../../components/SolanaGateButton';
import { toUnicodeName } from '@/utils/punycode';

interface ArNSPurchaseCardProps {
  name: string;
  isBusy: boolean;
  onBuy: (input: BuyArNSNameInput) => void | Promise<unknown>;
  /**
   * A card purchase settled server-side. Reported up so the host shows the same
   * receipt a credits/ARIO purchase gets, instead of silently closing.
   */
  onCardSuccess: (messageId: string) => void;
}

const LEASE_YEAR_OPTIONS = [1, 2, 3, 4, 5];

/**
 * Undernames a newly registered name starts with.
 *
 * Set by the ArNS contract, not by us, and not returned in the price response —
 * so it is a documented constant rather than a value we can read. Worth stating
 * on the checkout because it's the part of what you're buying that isn't
 * obvious from the name itself, and it's the answer to "can I use this for more
 * than one site?". `Increase-Undername-Limit` in ManageDomainModal buys more.
 */
const INCLUDED_UNDERNAMES = 10;

/**
 * Renders nothing — just mounts the two price queries for one lease term so its
 * cost is already in the react-query cache before the user selects it. Keyed
 * identically to the visible card's queries (same fundFrom/fromAddress), so a
 * term switch reads from cache instead of firing a fresh Solana RPC.
 */
function PrefetchLeaseTerm({
  name,
  years,
  fundFrom,
  fromAddress,
}: {
  name: string;
  years: number;
  fundFrom: ArNSFundFrom;
  fromAddress?: string;
}) {
  useArNSPrice({ name, type: 'lease', years });
  useArNSCostDetails({
    intent: 'Buy-Name',
    name,
    type: 'lease',
    years,
    fundFrom,
    fromAddress,
  });
  return null;
}

/**
 * Prefetch every lease term up front so switching 1↔5 years is instant. Fixed
 * child count keeps hooks stable; the current term dedupes against the card's
 * own query, so this adds the OTHER terms, not duplicate fetches.
 */
function LeaseTermPrefetcher(props: {
  name: string;
  fundFrom: ArNSFundFrom;
  fromAddress?: string;
}) {
  return (
    <>
      {LEASE_YEAR_OPTIONS.map((y) => (
        <PrefetchLeaseTerm key={y} years={y} {...props} />
      ))}
    </>
  );
}

/**
 * Registration configurator: lease vs permabuy + term, payment method (Turbo
 * Credits or the wallet's ARIO — liquid / staked / any), an itemized cost
 * breakdown (name price + the SOL rent/fee every buy pays), affordability
 * gating, and the buy action.
 */
export function ArNSPurchaseCard({
  name,
  isBusy,
  onBuy,
  onCardSuccess,
}: ArNSPurchaseCardProps) {
  const [type, setType] = useState<ArNSRegistrationType>('lease');
  const [years, setYears] = useState(1);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [fundingSource, setFundingSource] =
    useState<ArNSFundingSource>('balance');
  const [showPayment, setShowPayment] = useState(false);
  /**
   * Card is offered until the service tells us otherwise. The quote route
   * answers 503 when fiat is disabled (the testnet default), so we learn it by
   * asking — and then stop offering an option that cannot work.
   */
  const [cardEnabled, setCardEnabled] = useState(true);
  const [creditsForOneUSD] = useCreditsForFiat(1, () => {});

  const signer = useArNSTurboSigner();
  const address = signer.address ?? undefined;
  const balances = useArNSPaymentBalances(address);

  /**
   * One flat row of ways to pay — card, whatever this wallet can sign, and the
   * existing balance when there is one. `route` is where that choice turns back
   * into machinery; see settlementRoute.ts for why the two differ.
   *
   * `walletType` is hard-coded: ArNS only works on Solana at all, so the menu
   * of ways to pay is a property of the feature, not of who is signed in. A
   * signed-out visitor sees the real menu and SolanaGateButton owns the connect
   * gate — collapsing it to a lone "Card" would understate the page.
   *
   * Built twice, deliberately. Which options EXIST doesn't depend on the price,
   * but whether each one can COVER it does — and the price query's `enabled`
   * flag depends on the route, which depends on the selection. So routing reads
   * the price-free list, and the rendered list (below, once the price is known)
   * adds affordability.
   */
  const routingOptions = useMemo(
    () =>
      buildPaymentOptions({
        walletType: 'solana',
        credits: balances.credits,
        extraTokens: ['ario'],
        isTokenSelectable,
        cardEnabled,
      }),
    [balances.credits, cardEnabled],
  );
  const selectedOption =
    routingOptions.find((o) => o.id === selectedId) ??
    defaultPaymentOption(routingOptions);
  const route = useMemo(
    () =>
      selectedOption
        ? resolveSettlementRoute(selectedOption, fundingSource)
        : ({ kind: 'credits' } as const),
    [selectedOption, fundingSource],
  );

  // Which unit the price is quoted in. Card and token top-ups both land as
  // credits, so they price like credits — only ARIO prices in ARIO.
  const priceUnit = route.kind === 'ario' ? 'ario' : 'credits';
  const fundFrom = route.kind === 'ario' ? route.fundFrom : 'turbo';

  // Credits price (winc → credits) for the credits method display.
  const {
    data: creditsPrice,
    isFetching: creditsLoading,
    error: creditsError,
  } = useArNSPrice({ name, type, years, enabled: priceUnit === 'credits' });

  // Cost details (ARIO price + SOL gas + affordability) for the selected source.
  const {
    data: cost,
    isFetching: costLoading,
    error: costError,
  } = useArNSCostDetails({
    intent: 'Buy-Name',
    name,
    type,
    years,
    fundFrom,
    fromAddress: address,
  });

  const insufficientSol =
    // Only a KNOWN balance can block the action. `undefined` means the lookup
    // failed or never ran — blocking on that told funded users to go buy SOL.
    !!cost &&
    !balances.loading &&
    balances.sol !== undefined &&
    balances.sol < cost.gasTotalSol;
  /**
   * Whether the CHOSEN method is short — not whether some other one is.
   *
   * Card and token routes are sized to the price at payment time, so they are
   * never "insufficient" here; treating them as short (because the *credits*
   * balance is empty) is what used to block a user who had a working card.
   */
  const insufficientFunds = useMemo(() => {
    if (route.kind === 'credits') {
      return creditsPrice ? balances.credits < creditsPrice.credits : false;
    }
    if (route.kind === 'ario') return (cost?.shortfallMARIO ?? 0) > 0;
    return false;
  }, [route.kind, creditsPrice, balances.credits, cost?.shortfallMARIO]);

  const {
    needsLinking,
    isSolanaConnected,
    promptReconnect,
    showLinkModal,
    setShowLinkModal,
  } = useLinkedSolanaWallet();
  /** Set only when the user is offered linking and chooses to go without. */
  const [declinedLink, setDeclinedLink] = useState(false);

  const cardPlan = planCardPurchase({
    needsLinking,
    // A cold adapter is NOT a missing wallet — conflating them is what used to
    // hand Turbo the ANT for a user who only needed to reconnect.
    signerLive: isSolanaConnected && signer.isReady && !!signer.walletAdapter,
    solCoversGas:
      balances.loading || balances.sol === undefined || !cost
        ? undefined
        : balances.sol >= cost.gasTotalSol,
    declinedLink,
  });
  const custodialCard = route.kind === 'card' && cardPlan.kind === 'custodial';
  /** Card is chosen but a cheaper, self-owned route is one click away. */
  const cardNeedsWallet =
    route.kind === 'card' &&
    (cardPlan.kind === 'link' || cardPlan.kind === 'reconnect');

  const paymentOptions = useMemo(
    () =>
      buildPaymentOptions({
        walletType: 'solana',
        credits: balances.credits,
        priceInCredits: creditsPrice?.credits,
        // Signed out, holdings are UNKNOWN, not zero — "0 available" on ARIO
        // next to a silent SOL row states a fact we don't have and reads as
        // "you're broke" to someone who simply hasn't connected yet.
        cardIsCustodial: cardPlan.kind === 'custodial',
        tokenBalances: address
          ? { solana: balances.sol, ario: balances.totalArio }
          : {},
        extraTokens: ['ario'],
        isTokenSelectable,
        cardEnabled,
      }),
    [
      address, balances.credits, balances.sol, balances.totalArio,
      creditsPrice?.credits, cardEnabled, cardPlan.kind,
    ],
  );

  const priceReady =
    priceUnit === 'credits' ? !!creditsPrice : cost?.arioCost != null;
  // Every buy needs the SOL rent/gas estimate from useArNSCostDetails, even the
  // credits path. If that query errored or resolved empty we have no estimate —
  // don't let the user confirm against a missing (and cosmetically ~0) SOL cost.
  const gasUnavailable = !!costError || (!cost && !costLoading);
  const canPay =
    priceReady &&
    !gasUnavailable &&
    !insufficientSol &&
    !insufficientFunds &&
    !isBusy;

  // What a card / token payment has to cover: the whole price when there is no
  // balance to draw on, or just the gap when there is.
  const creditShortfall = creditsPrice
    ? Math.max(0, creditsPrice.credits - balances.credits)
    : 0;
  const topUpUsd =
    creditShortfall > 0 && creditsForOneUSD
      ? Math.ceil(creditShortfall / creditsForOneUSD)
      : undefined;
  // Only offer a credits top-up when SOL gas is sufficient — buying credits
  // can't make the purchase succeed if SOL for rent is also short. Gate on being
  // signed in: a signed-out user has a 0 balance (so credits always read as
  // short), and we want them to hit the connect/sign-in gate first — not a
  // "Buy Turbo Credits" prompt for an account they haven't connected yet.
  /**
   * Card and non-ARIO tokens can't pay the contract, so they buy credits first
   * and then register. Two transactions, one decision — the user already said
   * how they want to pay, so this opens on that method rather than asking again.
   */
  /**
   * Who will own the ANT if they pay by card. Derived, never asked — see
   * `planCardPurchase`. Self-custody keeps the atomic buyRecord (user-owned, no
   * surcharge, but their SOL pays the rent); custodial is the one-step quote
   * that works with no crypto at all.
   */


  /**
   * Card and non-ARIO tokens can't pay the contract directly, so they take a
   * payment step first. The user already said how they want to pay, so it opens
   * on that method rather than asking again.
   *
   * Card deliberately ignores the SOL gate: the payment service does the
   * on-chain write from its own keypair, so the buyer needs no SOL. Blocking it
   * would break the one path that works for someone holding no crypto — which
   * is the entire reason to offer a card.
   */
  /**
   * Only the card still opens a dialog, because a card is the one method with
   * something to type. A token top-up needs no input at all now that the amount
   * is computed, so it runs inline on this card — same feel as paying with
   * ARIO, which was always modal-free.
   */
  const needsPaymentStep = !!address && route.kind === 'card' && !cardNeedsWallet;

  /**
   * SOL (and any non-ARIO token) can't pay the registry, so it buys credits and
   * then registers: two signatures, nothing typed in between.
   */
  const tokenTopUp = useArNSTokenTopUp();
  const tokenAmountForName = useCryptoPriceForWinc(
    route.kind === 'topup' && creditShortfall > 0
      ? creditShortfall * 1e12
      : undefined,
    route.kind === 'topup' ? (route.token as SupportedTokenType) : 'solana',
    // This figure is charged, not displayed — truncating it under-funds the
    // registration it exists to pay for.
    true,
  );

  const tokenStepLabel = stepLabel(tokenTopUp.step);

  const runTokenPurchase = useCallback(async () => {
    if (route.kind !== 'topup' || !tokenAmountForName) return;
    try {
      await tokenTopUp.fund({
        token: route.token as SupportedTokenType,
        tokenAmount: tokenAmountForName,
        creditsNeeded: creditsPrice?.credits ?? 0,
        /*
          Credits live in the store and are refreshed by the app-wide
          `refresh-balance` event, so ask for a refresh and read what landed.
          Polling this rather than trusting the transfer receipt is the point:
          the credits apply server-side a moment after the transfer is accepted,
          and registering into that gap fails for "insufficient credits" having
          already taken the money.
        */
        readCredits: async () => {
          window.dispatchEvent(new CustomEvent('refresh-balance'));
          return useStore.getState().creditBalance ?? 0;
        },
      });
    } catch {
      return; // `fund` already recorded whether any money moved.
    }
    /*
      Hold the funded state until registration actually settles. Resetting here
      would drop the fact that the user has already paid — and "purchase failed"
      after we took their money implies a refund that is never coming, when what
      they actually hold is spendable credits and an unfinished registration.
    */
    try {
      const settled = await onBuy({
        name,
        type,
        years: type === 'lease' ? years : undefined,
        fundFrom: 'turbo',
      });
      /*
        The host catches rejections and resolves `undefined`, so this covers
        EVERY failure, not just the insufficient-credits one — which is what we
        want here: any unregistered outcome after a successful top-up must keep
        the funded state rather than read as a plain failure.
      */
      if (settled === undefined) {
        tokenTopUp.failAfterFunding(
          'Your credits arrived but the name was not registered.',
        );
        return;
      }
      tokenTopUp.reset();
    } catch (err) {
      tokenTopUp.failAfterFunding(
        err instanceof Error ? err.message : String(err),
      );
    }
  }, [
    route, tokenAmountForName, tokenTopUp, creditsPrice?.credits,
    onBuy, name, type, years,
  ]);

  /**
   * Why the buy button is disabled, said next to the button itself.
   *
   * The cost breakdown above already explains every shortfall, but the button is
   * where the user is looking, and a greyed-out control with no adjacent reason
   * reads as a broken app rather than a missing input. The credits path already
   * solves this by swapping the button for the payment step; this covers the cases
   * that don't.
   *
   * The ARIO branch carries an action rather than only a sentence: switching to
   * credits is a genuine in-app remedy that is otherwise never suggested, and it
   * chains — the flat picker's Card and SOL options are pre-seeded with the
   * name's price, so a dead end becomes a complete path without leaving the
   * page.
   *
   * Ordered by which blocker the user must clear first. Signed-out and
   * still-loading states are deliberately silent: SolanaGateButton owns the
   * former and a spinner owns the latter.
   */
  const blockedReason = useMemo((): { text: string; canSwitchToCredits?: boolean } | null => {
    if (!address || isBusy) return null;
    // Only the CUSTODIAL card is settled and funded server-side. A self-custody
    // card buy still needs the user's SOL for rent, so it keeps every blocker
    // below.
    if (custodialCard) return null;
    if (!priceReady) return null;
    if (gasUnavailable) return { text: 'Network cost is unavailable right now.' };
    if (insufficientSol) {
      const need =
        cost && balances.sol !== undefined
          ? Math.max(0, cost.gasTotalSol - balances.sol)
          : 0;
      // Format first, then decide. A shortfall under 0.00005 SOL is real but
      // rounds to "0" at 4dp, and "you need about 0 more SOL" reads as a bug.
      const needText = need.toLocaleString(undefined, { maximumFractionDigits: 4 });
      return {
        text:
          need > 0 && Number(needText) > 0
            ? `You need about ${needText} more SOL for the network deposit.`
            : 'You need a little more SOL for the network deposit.',
      };
    }
    if (insufficientFunds && route.kind === 'ario') {
      return { text: 'Not enough ARIO in this source.', canSwitchToCredits: true };
    }
    return null;
  }, [
    address, isBusy, priceReady, gasUnavailable, insufficientSol,
    insufficientFunds, route.kind, cost, balances.sol, custodialCard,
  ]);

  // Lease-vs-permabuy decision aid: how many years of leasing equal a permabuy.
  // years = 1 + (permabuy − year1) / annualRenewal, where annualRenewal is the
  // marginal (year2 − year1). Ratios cancel the length, so it's stable per name.
  const { pricingTiers } = useArNSPricing();
  const permabuyBreakEvenYears = useMemo(() => {
    if (!name || pricingTiers.length === 0) return undefined;
    const bucket = name.length > 12 ? 13 : name.length;
    const tier = pricingTiers.find((t) => t.characterLength === bucket);
    const y1 = tier?.pricesInARIO?.year1;
    const y2 = tier?.pricesInARIO?.year2;
    const perm = tier?.pricesInARIO?.permabuy;
    if (
      typeof y1 !== 'number' ||
      typeof y2 !== 'number' ||
      typeof perm !== 'number' ||
      y1 <= 0 ||
      y2 <= y1 ||
      perm <= 0
    )
      return undefined;
    return Math.round(1 + (perm - y1) / (y2 - y1));
  }, [name, pricingTiers]);

  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-4 sm:p-6">
      {/* Warm every lease term's price so switching the term is instant (no
          per-term RPC). Only while leasing; renders nothing. */}
      {type === 'lease' && name && (
        <LeaseTermPrefetcher name={name} fundFrom={fundFrom} fromAddress={address} />
      )}
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="font-heading text-lg font-extrabold text-foreground">
          Register <span className="break-all font-mono text-primary">{toUnicodeName(name)}.ar.io</span>
        </h3>
      </div>
      {/* Show the example, not just the number — "10 undernames" means nothing
          until you can see one. */}
      <p className="mb-4 text-xs text-foreground/70">
        Includes {INCLUDED_UNDERNAMES} undernames, like{' '}
        {/* Undernames join with an underscore, not a dot — `blog_name.ar.io`.
            The whole app builds them that way; a dot would be a subdomain of
            .ar.io, which is a different thing entirely and not yours. */}
        <span className="break-all font-mono">
          blog_{toUnicodeName(name)}.ar.io
        </span>
      </p>

      {/* Lease vs permabuy */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => setType('lease')}
          className={`flex items-center gap-2 rounded-2xl border p-3 transition-colors ${
            type === 'lease'
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border/20 bg-card text-foreground/70 hover:border-primary/40'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span className="font-medium">Lease</span>
        </button>
        <button
          onClick={() => setType('permabuy')}
          className={`flex items-center gap-2 rounded-2xl border p-3 transition-colors ${
            type === 'permabuy'
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border/20 bg-card text-foreground/70 hover:border-primary/40'
          }`}
        >
          <InfinityIcon className="h-4 w-4" />
          <span className="font-medium">Permabuy</span>
        </button>
      </div>

      {/* Lease-vs-permabuy decision aid */}
      {permabuyBreakEvenYears !== undefined && (
        <p className="-mt-2 mb-4 text-xs text-foreground/60">
          {type === 'permabuy'
            ? `Own it forever — no renewals, ever. Roughly the cost of ${permabuyBreakEvenYears} years of leasing.`
            : /*
                 Was "Permabuy ≈ N years of leasing — own it forever, never
                 renew", which reads as a DURATION and so contradicts its own
                 second half. It's a price comparison: say "costs about as much
                 as", and never put "≈" next to a span of years.
              */
              `Permabuy costs about as much as ${permabuyBreakEvenYears} years of leasing, and never needs renewing.`}
        </p>
      )}

      {/* Lease term */}
      {type === 'lease' && (
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium">Lease term</label>
          <div className="flex flex-wrap gap-2">
            {LEASE_YEAR_OPTIONS.map((y) => (
              <button
                key={y}
                onClick={() => setYears(y)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  years === y
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border/20 bg-card text-foreground/70 hover:border-primary/40'
                }`}
              >
                {y} {y === 1 ? 'year' : 'years'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Payment method + source */}
      <div className="mb-4">
        <ArNSPaymentSelector
          options={paymentOptions}
          selectedId={selectedOption?.id ?? ''}
          fundingSource={fundingSource}
          balances={balances}
          onSelect={setSelectedId}
          onSourceChange={setFundingSource}
          disabled={isBusy}
        />
      </div>

      {/* Cost breakdown */}
      <div className="mb-4">
        <ArNSCostBreakdown
          priceUnit={priceUnit}
          creditsPrice={creditsPrice?.credits}
          // Card only: the fee-inclusive charge. Every other route settles at
          // the fee-free winc price, so passing it there would overstate.
          cardUsdPrice={
            custodialCard
              ? // Turbo spawns the ANT and recovers its rent — the surcharge is
                // part of the charge, so quoting without it under-quotes by ~2x.
                creditsPrice?.usdWithAntSpawn ?? creditsPrice?.usd
              : undefined
          }
          arioPrice={cost?.arioCost}
          priceLoading={priceUnit === 'credits' ? creditsLoading : costLoading}
          priceError={!!(priceUnit === 'credits' ? creditsError : costError)}
          gasTotalSol={cost?.gasTotalSol ?? 0}
          gasRentSol={cost?.gasRentSol ?? 0}
          gasFeeSol={cost?.gasFeeSol ?? 0}
          gasLoading={costLoading}
          gasError={gasUnavailable}
          solBalance={balances.sol}
          insufficientFunds={insufficientFunds}
          insufficientSol={insufficientSol}
          networkCostCovered={custodialCard}
          custodialAnt={custodialCard}
        />
      </div>

      {/*
        Custody is the last rung, not the default. A user with a Solana wallet
        gets a cheaper, self-owned name — so offer that before Turbo holds it.
      */}
      {cardNeedsWallet ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="mb-3 text-sm text-foreground/80">
            {cardPlan.kind === 'reconnect' ? (
              <>
                Reconnect your Solana wallet to buy this name outright — you
                &apos;ll own it directly and skip the setup fee.
              </>
            ) : (
              <>
                Connect a Solana wallet to own this name directly. Without one,
                Turbo can hold it for you instead — that costs a little more and
                limits what you can change.
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                cardPlan.kind === 'reconnect'
                  ? promptReconnect()
                  : setShowLinkModal(true)
              }
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Wallet className="h-4 w-4" />
              {cardPlan.kind === 'reconnect'
                ? 'Reconnect wallet'
                : 'Connect a Solana wallet'}
            </button>
            {/* Taking no for an answer — custody exists for people who
                genuinely have no Solana wallet and don't want one. */}
            {cardPlan.kind === 'link' && (
              <button
                type="button"
                onClick={() => setDeclinedLink(true)}
                className="rounded-full border border-border/20 px-5 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:border-primary/40 hover:text-foreground"
              >
                Continue without one
              </button>
            )}
          </div>
        </div>
      ) : needsPaymentStep ? (
        <button
          onClick={() => setShowPayment(true)}
          disabled={
            isBusy ||
            // A custodial card buy is quoted server-side, so neither our
            // credits price nor the SOL estimate needs to have loaded.
            (!custodialCard && (!priceReady || gasUnavailable))
          }
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {route.kind === 'card' ? (
            <CreditCard className="h-4 w-4" />
          ) : (
            <Wallet className="h-4 w-4" />
          )}{' '}
          Continue
        </button>
      ) : (
        <SolanaGateButton
          onAction={() =>
            route.kind === 'topup'
              ? void runTokenPurchase()
              : onBuy({
                  name,
                  type,
                  years: type === 'lease' ? years : undefined,
                  fundFrom,
                })
          }
          disabled={
            route.kind === 'topup'
              ? !priceReady || gasUnavailable || insufficientSol || isBusy ||
                !tokenAmountForName || tokenStepLabel !== undefined
              : !canPay
          }
          busy={isBusy || tokenStepLabel !== undefined}
          actionVerb="buy this name"
          busyLabel={
            <>
              <Loader2 className="h-4 w-4 animate-spin" />{' '}
              {/* Name the step: two wallet popups with one spinner between
                  them is indistinguishable from a stuck app. */}
              {tokenStepLabel ?? 'Processing…'}
            </>
          }
        >
          <Wallet className="h-4 w-4" /> Register name
        </SolanaGateButton>
      )}

      {/* Funded but not registered must never read as "payment failed". */}
      {tokenTopUp.step.phase === 'failed' && (
        <p className="mt-2 flex flex-wrap items-start justify-center gap-x-1.5 text-center text-xs text-error">
          <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
          <span>
            {tokenTopUp.step.message}{' '}
            <span className="text-foreground/70">
              {failureAdvice(tokenTopUp.step)}
            </span>
          </span>
        </p>
      )}

      {/*
        Terms sit under the button that accepts them. The card and token paths
        each showed this inside their own modal; the ARIO and Balance paths
        never showed it at all, because they never open one.
      */}
      {!needsPaymentStep && (
        <p className="mt-3 text-center text-xs text-foreground/80">
          By registering, you agree to our{' '}
          <a
            href="https://ardrive.io/tos-and-privacy/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline transition-colors hover:text-primary/80"
          >
            Terms of Service
          </a>
        </p>
      )}

      {/* Say why the button is dead, next to the button. See `blockedReason`. */}
      {!needsPaymentStep && blockedReason && (
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-xs text-foreground/70">
          <AlertTriangle className="h-3 w-3 flex-shrink-0 text-error" />
          <span>{blockedReason.text}</span>
          {blockedReason.canSwitchToCredits && (
            <button
              type="button"
              onClick={() => setSelectedId('card')}
              className="font-semibold text-primary hover:underline"
            >
              Pay with card instead
            </button>
          )}
        </p>
      )}

      {/* Card settles server-side in one step — quote, charge, on-chain write —
          so it gets the dedicated checkout rather than the top-up shell. */}
      {showLinkModal && (
        <LinkSolanaWalletModal
          onClose={() => setShowLinkModal(false)}
          // Reconnecting an existing wallet is a different task from linking a
          // new one — the modal changes its copy and closes itself when the
          // known address comes back.
          isReconnect={cardPlan.kind === 'reconnect'}
        />
      )}

      {showPayment && custodialCard && (
        <ArNSCardPaymentModal
          displayName={name}
          quoteInput={{
            name,
            address: address ?? '',
            intent: 'Buy-Name',
            type,
            years: type === 'lease' ? years : undefined,
          }}
          onClose={() => setShowPayment(false)}
          onSuccess={(messageId) => {
            setShowPayment(false);
            onCardSuccess(messageId);
          }}
          onFiatDisabled={() => {
            setCardEnabled(false);
            setShowPayment(false);
            setSelectedId(undefined);
          }}
        />
      )}

      {/* Self-custody card: buy credits, then the user's own signer registers
          the name atomically. Two steps, but they own the ANT and skip the
          surcharge. */}
      {showPayment && ((route.kind === 'card' && !custodialCard) || route.kind === 'topup') && (
        <ArNSPaymentModal
          initialUsdAmount={topUpUsd}
          shortfallCredits={creditShortfall}
          paymentMethod={route.kind === 'card' ? 'fiat' : 'crypto'}
          token={route.kind === 'topup' ? (route.token as SupportedTokenType) : undefined}
          tokenLabel={
            route.kind === 'topup'
              ? tokenLabels[route.token as SupportedTokenType]
              : undefined
          }
          onClose={() => setShowPayment(false)}
          onComplete={() => setShowPayment(false)}
        />
      )}
    </div>
  );
}
