import { formatHeldBalance } from './formatBalance';

export type SessionWalletType = 'arweave' | 'ethereum' | 'solana' | null | undefined;

const WALLET_LABEL: Record<'arweave' | 'ethereum' | 'solana', string> = {
  arweave: 'Arweave',
  ethereum: 'Ethereum',
  solana: 'Solana',
};

/** `7xKX…9fA2`, enough to recognise a wallet without pretending to be an id. */
export function shortAddress(address: string): string {
  return address.length <= 12
    ? address
    : `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/**
 * One line naming the two wallets in a purchase, when there are two.
 *
 * A name is PAID FOR by the session identity and OWNED by a Solana wallet.
 * Those are the same wallet on a Solana session and different ones on an
 * Ethereum or Arweave session, where the buyer has linked a Solana wallet to
 * hold the name.
 *
 * The split is the root of most of what goes wrong in this feature, and until
 * now no surface said it out loud — so when the wrong wallet was credited, or
 * a balance read empty, there was nothing on screen to make sense of it. This
 * is the disclosure, not a fix: it makes the arrangement legible to the person
 * who has to reason about it.
 *
 * Returns undefined when there is nothing to disclose — one wallet, or not
 * enough known to say anything true.
 */
export function walletSplitNote({
  sessionWalletType,
  sessionAddress,
  ownerAddress,
  payingWalletType,
}: {
  sessionWalletType: SessionWalletType;
  sessionAddress: string | null | undefined;
  ownerAddress: string | null | undefined;
  /**
   * The wallet that pays for THIS choice, when it is not the session's. ARIO
   * is the case: it is the owner's own `buyRecord`, so on an Arweave or
   * Ethereum session the linked Solana wallet pays as well as holds. Saying
   * "you'll pay from your Arweave wallet" there contradicts the payment.
   * Absent means the session wallet pays, as it does on every credits route.
   */
  payingWalletType?: SessionWalletType;
}): string | undefined {
  if (!sessionWalletType || !sessionAddress || !ownerAddress) return undefined;
  // Same wallet in both roles: saying so would invent a distinction the user
  // does not have.
  if (sessionAddress === ownerAddress) return undefined;

  if (payingWalletType === 'solana' && sessionWalletType !== 'solana') {
    return `Your linked Solana wallet, ${shortAddress(ownerAddress)}, pays for and holds the name.`;
  }

  const payer = WALLET_LABEL[sessionWalletType];
  return `You'll pay from your ${payer} wallet. The name is held by your linked Solana wallet, ${shortAddress(ownerAddress)}.`;
}

/**
 * Why a token payment is blocked: which token, in which wallet, and how far
 * short it is.
 *
 * The token being spent comes from the SESSION wallet (a top-up credits
 * whoever sent the tokens), which is not the Solana wallet that owns the name
 * on an Arweave or Ethereum session. Naming the wallet is the point: "not
 * enough USDC" read beside a funded Solana wallet sounds wrong unless it says
 * the USDC in question is in the email or Ethereum wallet.
 */
export function tokenShortfallNote({
  tokenLabel,
  walletType,
  walletAddress,
  held,
  needed,
}: {
  /** As shown to users, network included: `USDC (Base)`, `SOL`. */
  tokenLabel: string;
  walletType: SessionWalletType;
  walletAddress: string | null | undefined;
  /** Undefined when the balance could not be read. */
  held: number | undefined;
  needed: number;
}): string {
  const wallet =
    walletType && WALLET_LABEL[walletType]
      ? `your ${WALLET_LABEL[walletType]} wallet`
      : 'your wallet';
  const which = walletAddress ? ` (${shortAddress(walletAddress)})` : '';
  // An unread balance is not an empty one. Saying "You have 0" to a funded
  // wallet whose lookup failed is the mistake this whole area keeps guarding
  // against.
  if (held === undefined) {
    return `Couldn't read the ${tokenLabel} balance in ${wallet}${which}. Reload and try again; this name needs ${formatNeeded(needed)}.`;
  }
  return `Not enough ${tokenLabel} in ${wallet}${which}. You have ${formatHeldBalance(held)}; this name needs ${formatNeeded(needed)}.`;
}

/**
 * The amount required, rounded UP. Rounding a requirement down understates it:
 * 2.9512 shown as 2.95 tells someone holding exactly 2.95 that it is enough.
 */
function formatNeeded(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0';
  // Whole units from ten thousand up: no abbreviation, which would round down.
  const places = amount >= 10_000 ? 0 : amount >= 1 ? 2 : 4;
  const scale = 10 ** places;
  // Subtract float noise before rounding up, relative to the amount, so 2.95
  // (295.00000000000006 once scaled) stays 2.95 while a real 2.9501 is 2.96.
  const up = Math.ceil(amount * scale - Math.max(1e-9, amount * scale * 1e-12)) / scale;
  return up.toLocaleString('en-US', { maximumFractionDigits: places });
}

/**
 * `walletSplitNote` as a phrase that fits the payment picker's one status
 * line: lower case, no sentence punctuation, short enough to share a line
 * with "You have 3.11 credits" on a phone. Same conditions, same facts.
 *
 * - The linked wallet pays (ARIO on an Arweave or Ethereum session):
 *   "paid from your linked Solana wallet".
 * - The session wallet pays and the linked one holds the name:
 *   "name held by your linked Solana wallet 7xKX…9fA2".
 */
export function walletSplitPhrase(input: {
  sessionWalletType: SessionWalletType;
  sessionAddress: string | null | undefined;
  ownerAddress: string | null | undefined;
  payingWalletType?: SessionWalletType;
}): string | undefined {
  const { sessionWalletType, sessionAddress, ownerAddress, payingWalletType } = input;
  if (!sessionWalletType || !sessionAddress || !ownerAddress) return undefined;
  if (sessionAddress === ownerAddress) return undefined;
  if (payingWalletType === 'solana' && sessionWalletType !== 'solana') {
    return 'paid from your linked Solana wallet';
  }
  return `name held by your linked Solana wallet ${shortAddress(ownerAddress)}`;
}
