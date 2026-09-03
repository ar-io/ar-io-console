import { VersionedTransaction } from '@solana/web3.js';
import { emptySignatureSlots } from '@ardrive/turbo-sdk/web';
import type { ArNSOwnerSigner } from '@ardrive/turbo-sdk/web';

/**
 * The ANT owner's half of a gas-sponsored ArNS action, backed by a browser
 * wallet.
 *
 * turbo-sdk owns the protocol — the two response shapes, the nonce discipline,
 * the `x-owner-*` proof and its canonical message. What it cannot own is the
 * key, so it asks for an `ArNSOwnerSigner` and this is console's implementation
 * of it. `solanaOwnerSigner(secretKey)` is the SDK's other implementation and is
 * for servers and tests only; a browser must never handle a raw secret key.
 *
 * ## The owner holds no SOL
 *
 * This wallet signs; it never pays. Turbo is fee payer on every sponsored
 * action, so the balance here can be zero at purchase and stay zero for the
 * life of the name. That is the product, and it is why an embedded wallet the
 * user never funded is a first-class signer rather than a degraded one.
 *
 * ## One shape for every wallet
 *
 * Phantom, Solflare and the Privy embedded wallet all reach `useWallet()`
 * through the same Wallet Standard registry (see `PrivySolanaBridge`), so they
 * arrive here identically and nothing below branches per wallet.
 *
 * Note this covers the nine SPONSORED actions only. Setting a primary name,
 * releasing, reassigning and editing ANT metadata are not sponsored: they are
 * ordinary owner-signed transactions and the user pays their own SOL. See
 * `sponsorship.ts`.
 */

export interface BrowserOwnerSignerAdapter {
  /** Base58 Solana address that owns, or will own, the ANT. */
  address: string;
  /** The wallet adapter's own transaction signer. */
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
  /**
   * The wallet adapter's own message signer, for the owner proof.
   *
   * Deliberately typed loose. Wallet Standard adapters disagree on the return:
   * most give back the raw signature, some wrap it as `{ signature }`. The SDK
   * wants raw bytes, and handing it the wrapper produces a signature the
   * service rejects as malformed — a 401 that reads like the wrong wallet.
   * Normalising here means no caller has to know which kind they connected.
   */
  signMessage: (
    message: Uint8Array,
  ) => Promise<Uint8Array | { signature: Uint8Array }>;
}

/** Unwrap the two shapes an adapter may return from `signMessage`. */
export function toSignatureBytes(
  signed: Uint8Array | { signature: Uint8Array },
): Uint8Array {
  return signed instanceof Uint8Array ? signed : signed.signature;
}

/** Reads base64 in both the browser (buffer polyfill) and node. */
function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, 'base64'));
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

/**
 * Throw unless Turbo left exactly one signature slot for the owner.
 *
 * Checked BEFORE the wallet opens, so a malformed or already-signed action
 * becomes a clear message instead of a rejection the user reads as their wallet
 * misbehaving. Zero empty slots is nearly always a stale action being retried,
 * where the fix is to read its status by nonce rather than sign again.
 */
export function assertOwnerSlotOnly(slots: number): void {
  if (slots === 1) return;

  if (slots === 0) {
    throw new Error(
      'This request has already been signed. Check its status before signing again.',
    );
  }

  throw new Error(
    `This request expects ${slots} more signatures; only the name's owner can be signed for here.`,
  );
}

export function browserArNSOwnerSigner({
  address,
  signTransaction,
  signMessage,
}: BrowserOwnerSignerAdapter): ArNSOwnerSigner {
  return {
    getAddress: () => address,

    async signTransaction(transactionBase64: string): Promise<string> {
      /*
        Sign the exact bytes Turbo returned.

        Turbo's fee-payer signature covers this serialization, so a transaction
        that is rebuilt or re-compiled — even into something semantically
        identical — carries a signature over different bytes and is rejected on
        submission. Deserialize, add one signature, re-serialize. Never
        reconstruct.
      */
      assertOwnerSlotOnly(emptySignatureSlots(transactionBase64));

      const transaction = VersionedTransaction.deserialize(
        fromBase64(transactionBase64),
      );
      const signed = await signTransaction(transaction);

      /*
        Serialize what the wallet returned, not what we passed in. Adapters
        differ: some sign in place and hand back the same object, others return
        a fresh transaction and leave the input untouched. Serializing the input
        works for the first kind and silently submits an UNSIGNED transaction
        for the second — a failure that surfaces on chain, not here.
      */
      return toBase64(signed.serialize());
    },

    async signMessage(message: Uint8Array): Promise<Uint8Array> {
      return toSignatureBytes(await signMessage(message));
    },
  };
}
