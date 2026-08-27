import { describe, it, expect } from 'vitest';
import { resolvePageSource } from './importPage';
import type { ResolveCtx } from '../render/arResolve';

const ctx: ResolveCtx = { gateway: 'https://turbo-gateway.com', arnsHost: 'ar.io' };
const TX = 'a34Zp9Kd1QmXv7Ns2Rt5Lb8Yz3Fc6Hg0Jw4Ue1Oi9Pq'; // 43 chars

describe('resolvePageSource', () => {
  it('resolves a bare transaction id to the gateway URL', () => {
    expect(resolvePageSource(TX, ctx)).toEqual({ url: `https://turbo-gateway.com/${TX}`, txId: TX });
  });

  it('resolves an ar://<tx> URL', () => {
    expect(resolvePageSource(`ar://${TX}`, ctx)).toEqual({
      url: `https://turbo-gateway.com/${TX}`,
      txId: TX,
    });
  });

  it('resolves an ar://<name> URL to the ArNS host', () => {
    expect(resolvePageSource('ar://myname', ctx)).toEqual({
      url: 'https://myname.ar.io',
      arnsName: 'myname',
      undername: undefined,
    });
  });

  it('resolves an ar://<under>_<name> URL, keeping the undername', () => {
    expect(resolvePageSource('ar://blog_myname', ctx)).toEqual({
      url: 'https://blog_myname.ar.io',
      arnsName: 'myname',
      undername: 'blog',
    });
  });

  it('resolves a bare ArNS name', () => {
    expect(resolvePageSource('myname', ctx)).toEqual({
      url: 'https://myname.ar.io',
      arnsName: 'myname',
      undername: undefined,
    });
  });

  it('strips a trailing .<arnsHost> from a bare name', () => {
    expect(resolvePageSource('myname.ar.io', ctx)).toEqual({
      url: 'https://myname.ar.io',
      arnsName: 'myname',
      undername: undefined,
    });
  });

  it('resolves an undername_name bare input', () => {
    expect(resolvePageSource('blog_myname', ctx)).toEqual({
      url: 'https://blog_myname.ar.io',
      arnsName: 'myname',
      undername: 'blog',
    });
  });

  it('pulls the tx id out of a full gateway URL', () => {
    const res = resolvePageSource(`https://turbo-gateway.com/${TX}`, ctx);
    expect(res.txId).toBe(TX);
    expect(res.url).toBe(`https://turbo-gateway.com/${TX}`);
  });

  it('pulls the ArNS name out of a full ArNS URL', () => {
    const res = resolvePageSource('https://myname.ar.io', ctx);
    expect(res.arnsName).toBe('myname');
    expect(res.txId).toBeUndefined();
    expect(res.url).toBe('https://myname.ar.io');
  });

  it('honours a testnet ArNS host', () => {
    const testnet: ResolveCtx = { gateway: 'https://ar-io.dev', arnsHost: 'ar-io.dev' };
    expect(resolvePageSource('myname', testnet)).toEqual({
      url: 'https://myname.ar-io.dev',
      arnsName: 'myname',
      undername: undefined,
    });
  });

  it('throws on empty input', () => {
    expect(() => resolvePageSource('   ', ctx)).toThrow();
  });

  it('throws on unusable input', () => {
    expect(() => resolvePageSource('not a name!!', ctx)).toThrow();
  });
});
