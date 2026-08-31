import { describe, expect, it, vi } from 'vitest';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';

import {
  assertOwnerSlotOnly,
  browserArNSOwnerSigner,
} from './browserOwnerSigner';

const BLOCKHASH = '11111111111111111111111111111111';

/** A two-signer transaction shaped like Turbo's: fee payer + ANT owner. */
function buildTransaction(feePayer: Keypair, owner: Keypair) {
  const message = new TransactionMessage({
    payerKey: feePayer.publicKey,
    recentBlockhash: BLOCKHASH,
    instructions: [
      SystemProgram.transfer({
        fromPubkey: owner.publicKey,
        toPubkey: new PublicKey(BLOCKHASH),
        lamports: 1,
      }),
    ],
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

function toBase64(tx: VersionedTransaction): string {
  return Buffer.from(tx.serialize()).toString('base64');
}

function fromBase64(value: string): VersionedTransaction {
  return VersionedTransaction.deserialize(
    Uint8Array.from(Buffer.from(value, 'base64')),
  );
}

function emptySlots(tx: VersionedTransaction): number {
  return tx.signatures.filter((s) => s.every((b) => b === 0)).length;
}

describe('assertOwnerSlotOnly', () => {
  it('accepts the single slot Turbo leaves after fee-payer signing', () => {
    expect(() => assertOwnerSlotOnly(1)).not.toThrow();
  });

  it('refuses an already-signed action and points at the status check', () => {
    expect(() => assertOwnerSlotOnly(0)).toThrow(/already been signed/);
  });

  it('refuses a transaction wanting signers we cannot supply', () => {
    expect(() => assertOwnerSlotOnly(2)).toThrow(/2 more signatures/);
  });
});

describe('browserArNSOwnerSigner', () => {
  const owner = Keypair.generate();
  const feePayer = Keypair.generate();

  function prepared() {
    const tx = buildTransaction(feePayer, owner);
    tx.sign([feePayer]);
    return tx;
  }

  function signerFor(
    signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
  ) {
    return browserArNSOwnerSigner({
      address: owner.publicKey.toBase58(),
      signTransaction,
      signMessage: async (m) => m,
    });
  }

  it('reports the owner address the ANT will be minted to', () => {
    expect(signerFor(async (t) => t).getAddress()).toBe(
      owner.publicKey.toBase58(),
    );
  });

  it("preserves Turbo's fee-payer signature through the round trip", async () => {
    const turboSigned = prepared();
    const feePayerSignature = Buffer.from(turboSigned.signatures[0]);

    const result = await signerFor(async (tx) => {
      tx.sign([owner]);
      return tx;
    }).signTransaction(toBase64(turboSigned));

    const returned = fromBase64(result);
    // That signature covers these exact bytes — rebuilding the transaction is
    // what invalidates it, and the rejection happens on chain, not here.
    expect(Buffer.from(returned.signatures[0])).toEqual(feePayerSignature);
    expect(emptySlots(returned)).toBe(0);
  });

  it('serializes what the wallet returned, not what it was given', async () => {
    // Adapters that return a fresh object rather than signing in place would
    // otherwise round-trip an unsigned transaction.
    const result = await signerFor(async (tx) => {
      const fresh = VersionedTransaction.deserialize(tx.serialize());
      fresh.sign([owner]);
      return fresh;
    }).signTransaction(toBase64(prepared()));

    expect(emptySlots(fromBase64(result))).toBe(0);
  });

  it('never opens the wallet when the slot assertion fails', async () => {
    const fullySigned = buildTransaction(feePayer, owner);
    fullySigned.sign([feePayer, owner]);
    const signTransaction = vi.fn();

    await expect(
      signerFor(signTransaction).signTransaction(toBase64(fullySigned)),
    ).rejects.toThrow(/already been signed/);
    expect(signTransaction).not.toHaveBeenCalled();
  });

  it('passes messages straight to the wallet for the owner proof', async () => {
    const signMessage = vi.fn(async () => Uint8Array.from([1, 2, 3]));
    const signer = browserArNSOwnerSigner({
      address: owner.publicKey.toBase58(),
      signTransaction: async (t) => t,
      signMessage,
    });

    const message = Uint8Array.from([9, 9]);
    await expect(signer.signMessage(message)).resolves.toEqual(
      Uint8Array.from([1, 2, 3]),
    );
    // The SDK builds the canonical string; console only holds the key.
    expect(signMessage).toHaveBeenCalledWith(message);
  });
});

describe('signMessage across adapter shapes', () => {
  const address = Keypair.generate().publicKey.toBase58();
  const raw = Uint8Array.from([7, 7, 7]);

  it('passes raw signature bytes straight through', async () => {
    const signer = browserArNSOwnerSigner({
      address,
      signTransaction: async (t) => t,
      signMessage: async () => raw,
    });
    await expect(signer.signMessage(Uint8Array.from([1]))).resolves.toEqual(raw);
  });

  it('unwraps adapters that return { signature }', async () => {
    // Handing the wrapper object to the SDK produces a malformed signature and
    // a 401 that reads to the user like they connected the wrong wallet.
    const signer = browserArNSOwnerSigner({
      address,
      signTransaction: async (t) => t,
      signMessage: async () => ({ signature: raw }),
    });
    await expect(signer.signMessage(Uint8Array.from([1]))).resolves.toEqual(raw);
  });
});
