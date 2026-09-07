export type CreditWalletType = 'arweave' | 'ethereum' | 'solana';

export interface CreditTarget {
  address: string;
  type: CreditWalletType | null | undefined;
}

/**
 * Which account a top-up actually credits.
 *
 * Credits are held PER ADDRESS, so this is the difference between money
 * arriving where it will be spent and money arriving on an account the caller
 * never looks at again.
 *
 * The precedence, strongest first:
 *
 *  1. `destination` — the host knows the credits are for a specific account.
 *     An ArNS purchase spends the credits of the wallet that will OWN the
 *     name, always a Solana one; for an Ethereum or Arweave session that is
 *     the LINKED wallet, not the session identity. Without this the card
 *     funded the session address, the purchase looked for credits on the
 *     Solana address, and the buyer was charged for nothing.
 *  2. `paymentTarget` — the user typed a recipient, or a deep link named one.
 *  3. The signed-in wallet, which is the ordinary case.
 */
export function resolveCreditTarget(input: {
  destination?: { address: string; type: CreditWalletType } | undefined;
  paymentTargetAddress?: string | null;
  paymentTargetType?: CreditWalletType | null;
  sessionAddress?: string | null;
  sessionWalletType?: CreditWalletType | null;
}): CreditTarget | undefined {
  const { destination, paymentTargetAddress, sessionAddress } = input;

  if (destination?.address) {
    return { address: destination.address, type: destination.type };
  }
  if (paymentTargetAddress) {
    return { address: paymentTargetAddress, type: input.paymentTargetType };
  }
  if (sessionAddress) {
    return { address: sessionAddress, type: input.sessionWalletType };
  }
  return undefined;
}
