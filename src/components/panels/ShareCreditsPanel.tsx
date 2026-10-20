import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TurboFactory,
  TurboAuthenticatedClient,
  ArconnectSigner
} from '@ardrive/turbo-sdk/web';
import { useStore } from '../../store/useStore';
import { wincPerCredit } from '../../constants';
import { useTurboConfig } from '../../hooks/useTurboConfig';
import { Share2, Check, Wallet, Loader2 } from 'lucide-react';
import DocsLink from '@/components/DocsLink';
import { promptSignIn, getTurboBalance, formatWalletAddress } from '../../utils';
import {
  toShareableBalance,
  toApprovedWinc,
  toShareRows,
  isSameWallet,
  parseCreditsToWinc,
  formatCreditsFloor,
  shareFailureMessage,
} from '../../utils/shareableCredits';
import { useWincForOneGiB } from '../../hooks/useWincForOneGiB';
import { validateWalletAddress, getWalletTypeLabel } from '../../utils/addressValidation';
import { useEthereumTurboClient } from '../../hooks/useEthereumTurboClient';
import { useWallet } from '@solana/wallet-adapter-react';
import { buttonClass } from '@/components/button';
import ShareCreditsList from './ShareCreditsList';

// "5", "0.25", "1.5": the amount as the user would say it.
const plainCredits = (credits: number) => String(Number(credits.toFixed(4)));
const creditsWord = (credits: number) => (credits === 1 ? 'credit' : 'credits');

const MIN_SHARE = 0.01;
const MIN_SHARE_WINC = BigInt(wincPerCredit) / 100n;

type Expiry = 'never' | '1h' | '1d' | '1w' | 'custom';
const EXPIRY_OPTIONS: { id: Expiry; label: string; short: string; seconds: number }[] = [
  { id: 'never', label: 'Never', short: 'Never', seconds: 0 },
  { id: '1h', label: '1 hour', short: '1h', seconds: 3_600 },
  { id: '1d', label: '1 day', short: '1d', seconds: 86_400 },
  { id: '1w', label: '1 week', short: '1w', seconds: 604_800 },
  { id: 'custom', label: 'Custom', short: 'Custom', seconds: 0 },
];
const CUSTOM_UNITS = { hours: 3_600, days: 86_400 } as const;

const formatEnd = (seconds: number) =>
  new Date(Date.now() + seconds * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

interface SharedResult {
  credits: number;
  recipient: string;
  expirySeconds: number;
}

export default function ShareCreditsPanel() {
  const { address, walletType, configMode } = useStore();
  const paymentAvailable = useStore((s) => s.isPaymentServiceAvailable());
  const wincForOneGiB = useWincForOneGiB();
  const turboConfig = useTurboConfig();
  const { createEthereumTurboClient } = useEthereumTurboClient();
  const { publicKey: solanaPublicKey, signMessage: solanaSignMessage, signTransaction: solanaSignTransaction } = useWallet();

  // Create authenticated turbo client based on wallet type
  const createTurboClient = async (): Promise<TurboAuthenticatedClient> => {
    if (!address || !walletType) {
      throw new Error('Wallet not connected');
    }

    switch (walletType) {
      case 'arweave':
        if (!window.arweaveWallet) {
          throw new Error('Wander wallet extension not found. Please install from https://wander.app');
        }
        const signer = new ArconnectSigner(window.arweaveWallet);
        return TurboFactory.authenticated({
          ...turboConfig,
          signer
        });

      case 'ethereum':
        // Use the shared Ethereum Turbo client with custom connect message
        return createEthereumTurboClient('ethereum');

      case 'solana':
        if (!solanaPublicKey || !solanaSignMessage) {
          throw new Error('Solana wallet not connected. Please reconnect your Solana wallet.');
        }

        return TurboFactory.authenticated({
          token: "solana",
          walletAdapter: { publicKey: solanaPublicKey, signMessage: solanaSignMessage, signTransaction: solanaSignTransaction! },
          ...turboConfig,
        });

      default:
        throw new Error(`Unsupported wallet type: ${walletType}`);
    }
  };

  const [amountInput, setAmountInput] = useState('');
  const [recipientInput, setRecipientInput] = useState('');
  const [recipientTouched, setRecipientTouched] = useState(false);
  const [expiry, setExpiry] = useState<Expiry>('never');
  const [customInput, setCustomInput] = useState('');
  const [customUnit, setCustomUnit] = useState<keyof typeof CUSTOM_UNITS>('days');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [shared, setShared] = useState<SharedResult | null>(null);

  /*
    Fetched here rather than read from the store's `creditBalance`, which is
    `effectiveBalance`: it includes credits other wallets shared with this one,
    which can be spent but not re-shared. Reading it offered more than the
    service would approve. The 'credit-balance' prefix keeps this query in the
    set that `refresh-balance` invalidates. The same response lists the
    approvals in both directions.
  */
  const {
    data: shareBalance,
    isError: balanceError,
    refetch: refetchBalance,
  } = useQuery({
    queryKey: ['credit-balance', 'shareable', address, walletType, configMode],
    enabled: !!address && !!walletType && paymentAvailable,
    staleTime: 30_000,
    queryFn: async () => {
      const response = await getTurboBalance(address!, walletType!);
      // getTurboBalance parses any response body, so a 5xx error body would
      // otherwise read as a zero balance. A real balance always has `winc`.
      if (response?.winc === undefined) throw new Error('Balance unavailable');
      return {
        ...toShareableBalance(response),
        given: toShareRows(response.givenApprovals, 'given'),
        received: toShareRows(response.receivedApprovals, 'received'),
      };
    },
  });
  const shareableWinc = shareBalance?.shareableWinc ?? 0n;
  const receivedWinc = shareBalance?.receivedWinc ?? 0n;
  // Figures are rounded down (formatCreditsFloor) so one the user copies back
  // into the form never exceeds what can actually be shared.
  const shareableText = formatCreditsFloor(shareableWinc);
  const receivedText = formatCreditsFloor(receivedWinc);

  // Amount
  // Decided in winc, parsed exactly from the text: as floats, the Max figure
  // can read a hair over the balance. `amount` is for display only.
  const amountWinc = parseCreditsToWinc(amountInput);
  const amount = amountWinc !== undefined ? Number(amountInput.trim()) : NaN;
  const amountEntered = amountInput.trim() !== '';
  const amountOver = !!shareBalance && amountWinc !== undefined && amountWinc > shareableWinc;
  const amountUnder = amountEntered && amountWinc !== undefined && amountWinc < MIN_SHARE_WINC;
  const amountMalformed = amountEntered && amountWinc === undefined;
  const amountValid = !!shareBalance && amountWinc !== undefined && !amountUnder && !amountOver;
  const wincPerGiB = wincForOneGiB ? Number(wincForOneGiB) : NaN;
  const gib = amountValid && Number.isFinite(wincPerGiB) && wincPerGiB > 0 ? (amount * wincPerCredit) / wincPerGiB : null;

  // Recipient, checked as it's typed. A wrong format is only called out once
  // the field is left, so it doesn't shout at a half-pasted address.
  const recipient = recipientInput.trim();
  const recipientCheck = recipient ? validateWalletAddress(recipient) : null;
  const recipientType = recipientCheck?.isValid && recipientCheck.type !== 'unknown' ? recipientCheck.type : null;
  const recipientIsSelf = !!recipientType && isSameWallet(recipient, address);
  const recipientInvalid = !!recipient && !recipientType && recipientTouched;
  const recipientValid = !!recipientType && !recipientIsSelf;

  // Expiry
  const customValue = Number(customInput);
  const expirySeconds =
    expiry === 'custom'
      ? Number.isFinite(customValue) && customValue > 0
        ? Math.round(customValue * CUSTOM_UNITS[customUnit])
        : 0
      : EXPIRY_OPTIONS.find((o) => o.id === expiry)!.seconds;
  const expiryValid = expiry !== 'custom' || expirySeconds > 0;

  const canShare =
    paymentAvailable && !!shareBalance && !balanceError && amountValid && recipientValid && expiryValid && !sending;

  const resetForm = () => {
    setAmountInput('');
    setRecipientInput('');
    setRecipientTouched(false);
    setExpiry('never');
    setCustomInput('');
  };

  const handleShare = async () => {
    if (!canShare) return;

    setSending(true);
    setError('');

    try {
      const turbo = await createTurboClient();
      const approvedWinc = toApprovedWinc(amountInput, shareableWinc);

      await turbo.shareCredits({
        approvedAddress: recipient,
        approvedWincAmount: approvedWinc.toString(),
        expiresBySeconds: expirySeconds > 0 ? expirySeconds : undefined,
      });

      // Captured before the form resets and before the balance refetches.
      setShared({
        credits: amount,
        recipient,
        expirySeconds,
      });
      resetForm();

      // Refresh balance in header
      window.dispatchEvent(new CustomEvent('refresh-balance'));
      refetchBalance();
    } catch (err) {
      console.error('Share credits error:', err);
      setError(shareFailureMessage(err, 'share'));
      // A refusal usually means the balance moved; show the current one.
      refetchBalance();
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async (revokedAddress: string) => {
    try {
      const turbo = await createTurboClient();
      await turbo.revokeCredits({ revokedAddress });
    } catch (err) {
      console.error('Revoke credits error:', err);
      refetchBalance();
      throw new Error(shareFailureMessage(err, 'revoke'));
    }
    window.dispatchEvent(new CustomEvent('refresh-balance'));
    await refetchBalance();
  };

  if (!address) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-heading font-extrabold mb-3">Sign in required</h3>
        <p className="text-foreground/80 mb-5">Sign in to share credits with another wallet.</p>
        <button
          onClick={promptSignIn}
          className={buttonClass('primary', 'lg')}
        >
          <Wallet className="w-4 h-4" /> Sign in to share credits
        </button>
      </div>
    );
  }

  const inputShell = (invalid: boolean) =>
    `field flex h-12 items-center gap-2 rounded-2xl border bg-background transition-colors ${invalid ? 'border-error' : 'border-border/20 focus-within:border-foreground'}`;

  const balanceHeader = (
    <>
      {/* What can be shared, ahead of everything else */}
      <div className="flex flex-col gap-2 border-b border-border/20 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm text-foreground/70">You can share</div>
          {balanceError ? (
            <div className="mt-1 text-sm text-error">
              Couldn&apos;t load your balance.{' '}
              <button type="button" onClick={() => refetchBalance()} className="font-medium text-primary hover:underline">
                Try again
              </button>
            </div>
          ) : (
            <div className="text-3xl font-bold leading-tight tracking-tight">
              {shareBalance ? shareableText : '…'}{' '}
              <span className="text-base font-semibold text-foreground/70">credits</span>
            </div>
          )}
        </div>
        {shareBalance && !balanceError && receivedWinc > 0n && (
          <div className="text-xs leading-relaxed text-foreground/70 sm:text-right sm:text-sm">
            <div>{formatCreditsFloor(shareableWinc + receivedWinc)} spendable in total</div>
            <div>
              {receivedText} shared with you <span className="text-foreground/60">· spend only</span>
            </div>
          </div>
        )}
      </div>

    </>
  );

  const form = (
    <>
      {/* Amount */}
      <div className="flex flex-col gap-2">
        <label htmlFor="share-amount" className="text-sm font-semibold">Amount</label>
        <div className={`${inputShell(amountOver || amountUnder || amountMalformed)} pl-4 pr-1.5`}>
          <input
            id="share-amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            placeholder="0.00"
            aria-invalid={amountOver || amountUnder || amountMalformed}
            aria-describedby="share-amount-help"
            className="min-w-0 flex-1 bg-transparent text-base text-foreground"
          />
          <span className="text-sm text-foreground/60">credits</span>
          <button
            type="button"
            onClick={() => setAmountInput(shareableText)}
            disabled={!shareBalance || shareableWinc === 0n}
            className={buttonClass('secondary', 'xs')}
          >
            Max
          </button>
        </div>
        <div id="share-amount-help" className="text-xs">
          {amountOver ? (
            <span className="text-error">
              You can share up to {shareableText}.
              {receivedWinc > 0n && ` The ${receivedText} shared with you can be spent but not passed on.`}
            </span>
          ) : amountUnder ? (
            <span className="text-error">The smallest share is {MIN_SHARE} credits.</span>
          ) : amountMalformed ? (
            <span className="text-error">Enter a number, like 5 or 0.25.</span>
          ) : gib !== null ? (
            <span className="text-foreground/60">About {gib.toFixed(2)} GiB of storage</span>
          ) : (
            <span className="text-foreground/60">At least {MIN_SHARE} credits</span>
          )}
        </div>
      </div>

      {/* Recipient */}
      <div className="flex flex-col gap-2">
        <label htmlFor="share-recipient" className="text-sm font-semibold">Recipient</label>
        <div className={`${inputShell(recipientInvalid || recipientIsSelf)} pl-4 pr-3`}>
          <input
            id="share-recipient"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={recipientInput}
            onChange={(e) => setRecipientInput(e.target.value)}
            onBlur={() => setRecipientTouched(true)}
            placeholder="Wallet address"
            aria-invalid={recipientInvalid || recipientIsSelf}
            aria-describedby="share-recipient-help"
            className="min-w-0 flex-1 bg-transparent font-mono text-sm text-foreground"
          />
          {recipientValid && recipientType && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
              <Check className="h-3 w-3" aria-hidden="true" />
              {getWalletTypeLabel(recipientType)}
            </span>
          )}
        </div>
        <div id="share-recipient-help" className="text-xs">
          {recipientIsSelf ? (
            <span className="text-error">That&apos;s the wallet you&apos;re signed in with. Enter the wallet you want to share with.</span>
          ) : recipientInvalid ? (
            <span className="text-error">That isn&apos;t an Arweave, Ethereum or Solana address.</span>
          ) : (
            <span className="text-foreground/60">Arweave, Ethereum or Solana address.</span>
          )}
        </div>
      </div>

      {/* Expiry */}
      <div className="flex flex-col gap-2">
        <div id="share-expiry-label" className="text-sm font-semibold">Expires</div>
        <div
          role="radiogroup"
          aria-labelledby="share-expiry-label"
          className="grid h-12 grid-cols-5 gap-0.5 rounded-2xl border border-border/20 bg-background p-1 sm:gap-1"
        >
          {EXPIRY_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={expiry === o.id}
              onClick={() => setExpiry(o.id)}
              className={`rounded-xl text-[13px] transition-colors sm:text-sm ${
                expiry === o.id ? 'bg-lavender font-semibold text-foreground' : 'font-medium text-foreground/80 hover:text-foreground'
              }`}
            >
              <span className="sm:hidden">{o.short}</span>
              <span className="hidden sm:inline">{o.label}</span>
            </button>
          ))}
        </div>
        {expiry === 'custom' && (
          <div className="flex gap-2">
            <label htmlFor="share-expiry-custom" className="sr-only">Expires after</label>
            <input
              id="share-expiry-custom"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="3"
              className="h-12 min-w-0 flex-1 rounded-2xl border border-border/20 bg-background px-4 text-base text-foreground focus:border-foreground"
            />
            <label htmlFor="share-expiry-unit" className="sr-only">Unit</label>
            <select
              id="share-expiry-unit"
              value={customUnit}
              onChange={(e) => setCustomUnit(e.target.value as keyof typeof CUSTOM_UNITS)}
              className="h-12 rounded-2xl border border-border/20 bg-background px-3 text-sm text-foreground"
            >
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
          </div>
        )}
        <div className="text-xs text-foreground/60">
          {expirySeconds > 0 ? `Ends ${formatEnd(expirySeconds)}.` : expiry === 'custom' ? 'Enter how long the share lasts.' : 'Stays open until you revoke it.'}
        </div>
      </div>

      {/* What the button will do, in one sentence */}
      {amountValid && recipientValid && expiryValid && (
        <div className="rounded-2xl bg-background px-4 py-3.5 text-sm leading-relaxed text-foreground/80">
          <strong className="font-mono text-foreground">{formatWalletAddress(recipient, 4)}</strong> can spend up to{' '}
          <strong className="text-foreground">
            {plainCredits(amount)} {creditsWord(amount)}
          </strong>{' '}
          of yours{expirySeconds > 0 ? `, until ${formatEnd(expirySeconds)}` : ''}. You can revoke the unspent part at any time.
        </div>
      )}

      {error && <div className="rounded-xl bg-error/10 p-3 text-sm text-error">{error}</div>}

      <button type="button" onClick={handleShare} disabled={!canShare} className={`${buttonClass('primary', 'xl')} w-full`}>
        {sending ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Sharing…
          </>
        ) : (
          <>
            <Share2 className="h-5 w-5" aria-hidden="true" />
            {amountValid ? `Share ${plainCredits(amount)} ${creditsWord(amount)}` : 'Share credits'}
          </>
        )}
      </button>
    </>
  );

  const success = shared && (
    <div className="flex flex-col gap-4" role="status">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-success/10">
          <Check className="h-5 w-5 text-success" aria-hidden="true" />
        </div>
        <div>
          <h4 className="text-xl">
            Shared {plainCredits(shared.credits)} {creditsWord(shared.credits)}
          </h4>
          <p className="mt-1 text-sm leading-relaxed text-foreground/80">
            <span className="font-mono">{formatWalletAddress(shared.recipient, 4)}</span> can spend{' '}
            {shared.credits === 1 ? 'it' : 'them'} now.{' '}
            {shared.expirySeconds > 0 ? `Ends ${formatEnd(shared.expirySeconds)}.` : 'Never expires.'}
          </p>
        </div>
      </div>
      <div>
        <button type="button" onClick={() => setShared(null)} className={buttonClass('primary', 'md')}>
          Share with someone else
        </button>
      </div>
    </div>
  );

  return (
    <div className="px-4 sm:px-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 bg-primary/20 rounded-2xl flex items-center justify-center flex-shrink-0 mt-1 border border-border/20">
          <Share2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-2xl font-heading font-extrabold text-foreground mb-1">Share Credits</h3>
          <p className="text-sm text-foreground/80">
            Let another wallet spend some of your credits. You can revoke whatever they haven&apos;t spent.
          </p>
          <DocsLink href="https://docs.ar.io/sdks/turbo-sdk/turbo-credit-sharing/" className="mt-1.5 text-xs">
            How credit sharing works
          </DocsLink>
        </div>
      </div>

      {!paymentAvailable && (
        <div className="mb-6 rounded-2xl border border-border/20 bg-card p-4 text-sm text-foreground/80">
          Sharing credits needs the Turbo payment service, which x402-only mode turns off.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <section aria-label="New share" className="flex flex-col gap-5 rounded-2xl border border-border/20 bg-card p-4 sm:p-6">
          {balanceHeader}
          {success || form}
        </section>

        {/* On desktop the list card is pinned to the form card's height and
            scrolls inside it, so the columns end together however many shares
            there are. */}
        <div className="relative lg:min-h-[28rem]">
          {/* Keyed on load so the list picks its opening tab from real data:
              a wallet with only received shares should open on that tab. */}
          <ShareCreditsList
            key={shareBalance ? 'loaded' : 'loading'}
            given={shareBalance?.given ?? []}
            received={shareBalance?.received ?? []}
            sharedOutWinc={shareBalance?.sharedOutWinc ?? 0n}
            receivedWinc={shareBalance?.receivedWinc ?? 0n}
            onRevoke={handleRevoke}
          />
        </div>
      </div>
    </div>
  );
}
