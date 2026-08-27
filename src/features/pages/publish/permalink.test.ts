import { describe, it, expect } from 'vitest';
import { arnsLabel, prepareDefForPublish } from './permalink';
import { validatePageDef, type PageDef } from '../schema';

const FAKE_TX = 'a34Zp9Kd1QmXv7Ns2Rt5Lb8Yz3Fc6Hg0Jw4Ue1Oi9Pq'; // 43-char placeholder

const withVerify = (url: string): PageDef =>
  validatePageDef({
    template: 'grid-system',
    id: 'p1',
    title: 'T',
    profile: { displayName: 'D' },
    blocks: [
      { type: 'link', label: 'Site', url: 'https://example.com' },
      { type: 'verify', label: 'permanent on arweave', url },
    ],
  });

const verifyUrl = (def: PageDef): string | undefined => {
  const b = def.blocks.find((x) => x.type === 'verify');
  return b && b.type === 'verify' ? b.url : undefined;
};

describe('arnsLabel', () => {
  it('returns the base name when there is no undername', () => {
    expect(arnsLabel({ name: 'myname' })).toBe('myname');
  });
  it('joins undername and name with an underscore', () => {
    expect(arnsLabel({ name: 'myname', undername: 'links' })).toBe('links_myname');
  });
});

describe('prepareDefForPublish — with an ArNS name', () => {
  it('points the verify block at ar://<name> (a stable permalink)', () => {
    const out = prepareDefForPublish(withVerify(`ar://${FAKE_TX}`), 'myname');
    expect(verifyUrl(out)).toBe('ar://myname');
  });

  it('overwrites even a previously-set verify url with the page permalink', () => {
    const out = prepareDefForPublish(withVerify('https://old.example'), 'links_myname');
    expect(verifyUrl(out)).toBe('ar://links_myname');
  });
});

describe('prepareDefForPublish — without an ArNS name', () => {
  it('neutralises a placeholder ar://<txid> verify url to # (never a fake tx)', () => {
    const out = prepareDefForPublish(withVerify(`ar://${FAKE_TX}`));
    expect(verifyUrl(out)).toBe('#');
  });

  it('leaves a real non-tx verify url untouched', () => {
    const out = prepareDefForPublish(withVerify('https://real.example/verify'));
    expect(verifyUrl(out)).toBe('https://real.example/verify');
  });

  it('leaves a non-tx ar://arns verify url untouched', () => {
    const out = prepareDefForPublish(withVerify('ar://somename'));
    expect(verifyUrl(out)).toBe('ar://somename');
  });
});

describe('prepareDefForPublish — purity', () => {
  it('never mutates the input def', () => {
    const def = withVerify(`ar://${FAKE_TX}`);
    const before = JSON.stringify(def);
    prepareDefForPublish(def, 'myname');
    expect(JSON.stringify(def)).toBe(before);
  });

  it('returns the same reference when nothing changes (no verify block)', () => {
    const def = validatePageDef({
      template: 'grid-system',
      id: 'p2',
      title: 'T',
      profile: { displayName: 'D' },
      blocks: [{ type: 'link', label: 'Site', url: 'https://example.com' }],
    });
    expect(prepareDefForPublish(def)).toBe(def);
  });
});
