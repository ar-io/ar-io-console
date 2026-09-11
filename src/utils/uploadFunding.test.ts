import { describe, expect, it } from 'vitest';

import {
  chooseUploadFunding,
  paysPerRequest,
  X402_TOKEN,
} from './uploadFunding';

const evmX402 = {
  cryptoPayment: true,
  token: X402_TOKEN,
  walletType: 'ethereum',
  x402Enabled: true,
};

describe('chooseUploadFunding', () => {
  it('pays per request when every condition holds', () => {
    expect(chooseUploadFunding(evmX402)).toEqual({ kind: 'x402' });
  });

  it('does not pay at all when no crypto payment was asked for', () => {
    // Free tier, or an existing credit balance — nothing to settle either way.
    expect(chooseUploadFunding({ ...evmX402, cryptoPayment: false })).toEqual({
      kind: 'none',
    });
    expect(chooseUploadFunding({ ...evmX402, token: null })).toEqual({
      kind: 'none',
    });
  });

  it('falls back to a top-up for a wallet that cannot sign x402', () => {
    // A Solana or Arweave session cannot produce the EVM signature the
    // protocol needs. They can still pay — just not this way — so this is a
    // fallback, not an error.
    for (const walletType of ['solana', 'arweave', undefined]) {
      expect(chooseUploadFunding({ ...evmX402, walletType })).toEqual({
        kind: 'topup',
        token: X402_TOKEN,
      });
    }
  });

  it('falls back to a top-up for any token that is not base-usdc', () => {
    // x402 settles in USDC on Base. Another token has to buy credits whatever
    // the mode says.
    expect(
      chooseUploadFunding({ ...evmX402, token: 'base-eth' }),
    ).toEqual({ kind: 'topup', token: 'base-eth' });
  });

  it('falls back to a top-up when x402 is not available', () => {
    expect(chooseUploadFunding({ ...evmX402, x402Enabled: false })).toEqual({
      kind: 'topup',
      token: X402_TOKEN,
    });
  });

  it('never reports pay-per-request for a plan that pre-pays', () => {
    // The guard the upload path branches on: a true here skips the top-up and
    // its settlement wait, so a wrong answer either double-pays or uploads
    // against a balance that was never funded.
    expect(paysPerRequest({ kind: 'x402' })).toBe(true);
    expect(paysPerRequest({ kind: 'topup', token: X402_TOKEN })).toBe(false);
    expect(paysPerRequest({ kind: 'none' })).toBe(false);
  });
});
