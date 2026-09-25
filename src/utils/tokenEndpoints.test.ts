import { describe, expect, it } from 'vitest';

import { endpointSourceFor, withDerivedEndpoints } from './tokenEndpoints';

describe('withDerivedEndpoints', () => {
  it('points USDC on Solana at the Solana endpoint', () => {
    const out = withDerivedEndpoints({
      solana: 'https://devnet.example',
      'solana-usdc': 'https://mainnet.example',
    });
    // One chain, one RPC. The stale value must not survive.
    expect(out['solana-usdc']).toBe('https://devnet.example');
  });

  it('fills the key in for a config saved before the token existed', () => {
    // Custom mode merges shallowly, so an old persisted map has no entry at all.
    const out = withDerivedEndpoints({ solana: 'https://custom.example' });
    expect(out['solana-usdc']).toBe('https://custom.example');
  });

  it('leaves every other token alone', () => {
    const out = withDerivedEndpoints({
      solana: 'https://sol.example',
      'base-usdc': 'https://base.example',
      ethereum: 'https://eth.example',
    });
    expect(out['base-usdc']).toBe('https://base.example');
    expect(out.ethereum).toBe('https://eth.example');
  });

  it('does not invent an endpoint when the source has none', () => {
    const out = withDerivedEndpoints({ 'solana-usdc': 'https://kept.example' });
    expect(out['solana-usdc']).toBe('https://kept.example');
  });

  it('does not mutate its input', () => {
    const input = { solana: 'https://a.example', 'solana-usdc': 'https://b.example' };
    withDerivedEndpoints(input);
    expect(input['solana-usdc']).toBe('https://b.example');
  });
});

describe('endpointSourceFor', () => {
  it('names the source for a derived token, and nothing for the rest', () => {
    expect(endpointSourceFor('solana-usdc')).toBe('solana');
    expect(endpointSourceFor('solana')).toBeUndefined();
    expect(endpointSourceFor('base-usdc')).toBeUndefined();
  });
});
