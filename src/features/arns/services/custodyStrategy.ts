/**
 * Custody strategy resolver (ported from arns-react `custodyStrategy.ts`).
 *
 * The ANT that an ArNS name resolves to is a Solana Metaplex Core asset. Who
 * owns/controls it depends on the buyer's identity:
 *
 * - **Model B (user-owned)** — Solana identities. The CLIENT spawns the ANT with
 *   the user's Solana signer, so the user self-owns it from the first block; the
 *   bundler only settles the purchase (debits credits + writes the record). This
 *   is the ONLY model wired in Phase 1.
 * - **Model A (custodial)** — Arweave / Ethereum identities. The bundler spawns +
 *   custodies the ANT server-side (no client Solana signer). Deferred to a later
 *   phase; the shape is kept here so the buy orchestration can branch cleanly
 *   when Model A lands.
 *
 * The contracts forbid a hybrid "user-owns + Turbo-controls" — a transfer wipes
 * controllers and a spawn can't seed owner+controllers together — so a name is
 * either fully user-owned (B) or fully custodial-until-exit (A).
 */
import { TokenType } from '@ardrive/turbo-sdk/web';

export type CustodyModel = 'A-custodial' | 'B-user-owned';

export interface CustodyStrategy {
  model: CustodyModel;
  /** Whether the client must spawn the ANT before settling (Model B only). */
  requiresClientAntSpawn: boolean;
}

export function resolveCustodyStrategy(
  tokenType: TokenType | undefined,
): CustodyStrategy {
  if (tokenType === 'solana') {
    return { model: 'B-user-owned', requiresClientAntSpawn: true };
  }
  // Arweave / Ethereum / everything else → custodial (Model A). Not yet wired.
  return { model: 'A-custodial', requiresClientAntSpawn: false };
}
