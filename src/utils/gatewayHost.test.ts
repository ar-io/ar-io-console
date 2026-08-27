import { describe, it, expect } from 'vitest';
import { hostServesArweave } from './gatewayHost';

describe('hostServesArweave', () => {
  it('sends local development to the configured gateway', () => {
    expect(hostServesArweave('localhost')).toBe(false);
    expect(hostServesArweave('127.0.0.1')).toBe(false);
  });

  it('sends static hosts to the configured gateway', () => {
    // The staging deploy. Previously treated as a gateway, so an ArNS logo
    // resolved to https://ar-io.github.io/{txId} and 404'd.
    expect(hostServesArweave('ar-io.github.io')).toBe(false);
    expect(hostServesArweave('vercel.app')).toBe(false);
    expect(hostServesArweave('preview-abc.vercel.app')).toBe(false);
    expect(hostServesArweave('site.netlify.app')).toBe(false);
    expect(hostServesArweave('site.pages.dev')).toBe(false);
  });

  it('still trusts a real gateway to serve transactions', () => {
    expect(hostServesArweave('turbo-gateway.com')).toBe(true);
    expect(hostServesArweave('console.ar.io')).toBe(true);
    expect(hostServesArweave('vilenarios.com')).toBe(true);
  });

  it('matches on a domain boundary, not a substring', () => {
    // A host merely ENDING in the same letters is not the static host.
    expect(hostServesArweave('notgithub.io')).toBe(true);
    expect(hostServesArweave('mygithub.io.example.com')).toBe(true);
  });
});
