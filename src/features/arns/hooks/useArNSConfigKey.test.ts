import { describe, it, expect } from 'vitest';

import { arnsConfigSignature } from './useArNSConfigKey';

/**
 * The signature is the identity used as a react-query key segment and to gate
 * the module/localStorage caches. Its contract: it MUST change when any field
 * that alters which network a read resolves against changes, and MUST stay
 * stable otherwise — that is exactly what makes ArNS reads flow through a
 * settings change (gateway / program IDs / RPC / mode).
 */
describe('arnsConfigSignature', () => {
  const base = {
    coreProgramId: 'core1',
    garProgramId: 'gar1',
    arnsProgramId: 'arns1',
    antProgramId: 'ant1',
    arioGatewayUrl: 'https://gw.example',
    tokenMap: { solana: 'https://rpc.example' },
  };

  it('is stable for the same config', () => {
    expect(arnsConfigSignature(base)).toBe(arnsConfigSignature({ ...base }));
  });

  it('changes when any network-relevant field changes', () => {
    const sig = arnsConfigSignature(base);
    expect(arnsConfigSignature({ ...base, coreProgramId: 'core2' })).not.toBe(sig);
    expect(arnsConfigSignature({ ...base, garProgramId: 'gar2' })).not.toBe(sig);
    expect(arnsConfigSignature({ ...base, arnsProgramId: 'arns2' })).not.toBe(sig);
    expect(arnsConfigSignature({ ...base, antProgramId: 'ant2' })).not.toBe(sig);
    expect(
      arnsConfigSignature({ ...base, arioGatewayUrl: 'https://gw2.example' }),
    ).not.toBe(sig);
    expect(
      arnsConfigSignature({ ...base, tokenMap: { solana: 'https://rpc2.example' } }),
    ).not.toBe(sig);
  });

  it('distinguishes present from absent fields (no collision)', () => {
    // Empty vs a value that could concatenate into the same string.
    expect(arnsConfigSignature({ coreProgramId: 'a|b' })).not.toBe(
      arnsConfigSignature({ coreProgramId: 'a', garProgramId: 'b' }),
    );
  });

  it('treats missing optional fields as empty (never throws)', () => {
    expect(() => arnsConfigSignature({})).not.toThrow();
    expect(arnsConfigSignature({})).toBe(arnsConfigSignature({ tokenMap: {} }));
  });
});
