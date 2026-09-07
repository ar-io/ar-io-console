import type { ArNSOwnerSigner } from '@ardrive/turbo-sdk/web';

/**
 * The owner-only ANT operations, behind one interface so the caller does not
 * care which rail performs them.
 *
 * Both rails are real and the user picks between them by what they hold: Turbo
 * as fee payer billing credits, or the wallet signing and paying SOL. Before
 * this only the second existed, while the UI quoted the price of the first.
 */
export interface OwnerOpWriter {
  transfer(p: { target: string }): Promise<{ id: string }>;
  addController(p: { controller: string }): Promise<{ id: string }>;
  removeController(p: { controller: string }): Promise<{ id: string }>;
}

/** The three SDK methods this adapter needs. Structural, so tests need no SDK. */
export interface SponsoredOwnerOpClient {
  transferArNSAnt(p: {
    antId: string;
    owner: ArNSOwnerSigner;
    target: string;
  }): Promise<{ messageId: string }>;
  addArNSController(p: {
    antId: string;
    owner: ArNSOwnerSigner;
    target?: string;
  }): Promise<{ messageId: string }>;
  removeArNSController(p: {
    antId: string;
    owner: ArNSOwnerSigner;
    target?: string;
  }): Promise<{ messageId: string }>;
}

/** The direct ANT client's shape — the wallet signs and pays the network. */
export interface ANTOwnerOpWriteable {
  transfer(p: { target: string }): Promise<{ id: string }>;
  addController(p: { controller: string }): Promise<{ id: string }>;
  removeController(p: { controller: string }): Promise<{ id: string }>;
}

export function sponsoredOwnerOpWriter(
  antId: string,
  turbo: SponsoredOwnerOpClient,
  owner: ArNSOwnerSigner,
): OwnerOpWriter {
  return {
    async transfer({ target }) {
      const res = await turbo.transferArNSAnt({ antId, owner, target });
      return { id: res.messageId };
    },
    async addController({ controller }) {
      const res = await turbo.addArNSController({
        antId,
        owner,
        target: controller,
      });
      return { id: res.messageId };
    },
    async removeController({ controller }) {
      const res = await turbo.removeArNSController({
        antId,
        owner,
        target: controller,
      });
      return { id: res.messageId };
    },
  };
}

/**
 * The original rail, unchanged: `ANT.init({ rpc, signer })`, the wallet signing
 * and paying SOL. Kept as a peer of the sponsored writer rather than a fallback
 * implementation detail, because it is what an owner short on credits uses.
 */
export function antOwnerOpWriter(ant: ANTOwnerOpWriteable): OwnerOpWriter {
  return {
    transfer: (p) => ant.transfer(p),
    addController: (p) => ant.addController(p),
    removeController: (p) => ant.removeController(p),
  };
}
