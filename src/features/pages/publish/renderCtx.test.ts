import { describe, it, expect } from 'vitest';
import { arnsHostFor, renderCtxFor } from './renderCtx';
import { validatePageDef, type PageDef } from '../schema';

const def: PageDef = validatePageDef({
  template: 'grid-system',
  id: 'p1',
  title: 'T',
  profile: { displayName: 'D' },
  blocks: [],
});

describe('arnsHostFor', () => {
  it('maps production to ar.io (NOT the turbo upload gateway)', () => {
    expect(arnsHostFor({ configMode: 'production', arioGatewayUrl: 'https://turbo-gateway.com' })).toBe(
      'ar.io',
    );
  });

  it('maps development/Testnet to ar-io.dev', () => {
    expect(arnsHostFor({ configMode: 'development', arioGatewayUrl: 'https://ar-io.dev' })).toBe(
      'ar-io.dev',
    );
  });

  it('derives custom mode from the custom gateway hostname', () => {
    expect(
      arnsHostFor({ configMode: 'custom', arioGatewayUrl: 'https://my-gw.example.com/x' }),
    ).toBe('my-gw.example.com');
  });

  it('falls back to ar.io with no mode and no gateway', () => {
    expect(arnsHostFor({})).toBe('ar.io');
  });
});

describe('renderCtxFor', () => {
  it('uses the mode-correct ArNS host while keeping the data gateway separate', () => {
    const prod = renderCtxFor(def, { configMode: 'production', arioGatewayUrl: 'https://turbo-gateway.com' });
    expect(prod.arnsHost).toBe('ar.io');
    expect(prod.gateway).toBe('https://turbo-gateway.com');

    const test = renderCtxFor(def, { configMode: 'development', arioGatewayUrl: 'https://ar-io.dev' });
    expect(test.arnsHost).toBe('ar-io.dev');
    expect(test.gateway).toBe('https://ar-io.dev');
  });

  it('strips a trailing slash from the tx/data gateway', () => {
    expect(renderCtxFor(def, { arioGatewayUrl: 'https://ar-io.dev/' }).gateway).toBe('https://ar-io.dev');
  });

  it('carries arnsName from opts and omits selfTxId at publish time', () => {
    const ctx = renderCtxFor(def, { configMode: 'development' }, { arnsName: 'myname' });
    expect(ctx.arnsName).toBe('myname');
    expect(ctx.selfTxId).toBeUndefined();
  });

  it('falls back to turbo-gateway.com when no gateway is set', () => {
    const ctx = renderCtxFor(def, { configMode: 'production' });
    expect(ctx.gateway).toBe('https://turbo-gateway.com');
    expect(ctx.arnsHost).toBe('ar.io');
  });
});
