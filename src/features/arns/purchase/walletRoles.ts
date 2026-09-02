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
}: {
  sessionWalletType: SessionWalletType;
  sessionAddress: string | null | undefined;
  ownerAddress: string | null | undefined;
}): string | undefined {
  if (!sessionWalletType || !sessionAddress || !ownerAddress) return undefined;
  // Same wallet in both roles: saying so would invent a distinction the user
  // does not have.
  if (sessionAddress === ownerAddress) return undefined;

  const payer = WALLET_LABEL[sessionWalletType];
  return `You'll pay from your ${payer} wallet. The name is held by your linked Solana wallet, ${shortAddress(ownerAddress)}.`;
}
