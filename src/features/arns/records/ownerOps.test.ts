import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import { sponsoredOwnerOpWriter, antOwnerOpWriter } from './ownerOps';
import { chooseOwnerActionWriter } from './writerChoice';

const OWNER = {} as never;
const ANT = 'ant-1111';

function fakeTurbo() {
  return {
    transferArNSAnt: vi.fn().mockResolvedValue({ messageId: 'm-transfer' }),
    addArNSController: vi.fn().mockResolvedValue({ messageId: 'm-add' }),
    removeArNSController: vi.fn().mockResolvedValue({ messageId: 'm-remove' }),
  };
}

describe('sponsoredOwnerOpWriter', () => {
  it('sends the controller address as `target`, which is what the SDK reads', () => {
    const turbo = fakeTurbo();
    const w = sponsoredOwnerOpWriter(ANT, turbo, OWNER);
    void w.addController({ controller: 'wallet-abc' });
    expect(turbo.addArNSController).toHaveBeenCalledWith({
      antId: ANT,
      owner: OWNER,
      target: 'wallet-abc',
    });
  });

  it('returns the message id as the operation id', async () => {
    const turbo = fakeTurbo();
    const w = sponsoredOwnerOpWriter(ANT, turbo, OWNER);
    expect(await w.transfer({ target: 't' })).toEqual({ id: 'm-transfer' });
    expect(await w.removeController({ controller: 'c' })).toEqual({ id: 'm-remove' });
  });

  it('never transfers when asked to change a controller', async () => {
    // Different rails, same wallet prompt — confusing these would hand the name
    // away instead of granting an edit right.
    const turbo = fakeTurbo();
    await sponsoredOwnerOpWriter(ANT, turbo, OWNER).addController({
      controller: 'c',
    });
    expect(turbo.transferArNSAnt).not.toHaveBeenCalled();
  });
});

describe('antOwnerOpWriter', () => {
  it('passes straight through to the wallet-signed client', async () => {
    const ant = {
      transfer: vi.fn().mockResolvedValue({ id: 'sig-1' }),
      addController: vi.fn().mockResolvedValue({ id: 'sig-2' }),
      removeController: vi.fn().mockResolvedValue({ id: 'sig-3' }),
    };
    expect(await antOwnerOpWriter(ant).transfer({ target: 't' })).toEqual({
      id: 'sig-1',
    });
    expect(ant.transfer).toHaveBeenCalledWith({ target: 't' });
  });
});

describe('chooseOwnerActionWriter', () => {
  const RICH = { credits: 10, priceCredits: 0.2, sol: 1 };

  it('uses credits by default, so the price can be quoted exactly', () => {
    expect(chooseOwnerActionWriter('owner', RICH)).toEqual({
      kind: 'sponsored',
      reason: 'owner',
    });
  });

  it('falls back to the wallet when credits are short but SOL is not', () => {
    expect(
      chooseOwnerActionWriter('owner', { credits: 0, priceCredits: 0.2, sol: 1 }),
    ).toEqual({ kind: 'self-signed', reason: 'insufficient-credits' });
  });

  /*
    The difference from records. A controller may edit records — the program
    allows it — but cannot transfer the name or change who controls it. Falling
    through to self-signed would spend a wallet prompt on a transaction the
    program rejects.
  */
  it('blocks a controller instead of letting them sign', () => {
    expect(chooseOwnerActionWriter('controller', RICH).kind).toBe('blocked');
  });

  it('blocks an unresolved or absent role', () => {
    expect(chooseOwnerActionWriter('unknown', RICH).kind).toBe('blocked');
    expect(chooseOwnerActionWriter('none', RICH).kind).toBe('blocked');
  });
});

/*
  The copy has to follow the rail that was actually chosen. It was hardcoded to
  credits for months while the code paid SOL, and then (briefly) hardcoded the
  other way. A literal on this prop is the shape of both mistakes.
*/
describe('the cost note follows the chosen rail', () => {
  it.each([
    'src/features/arns/components/TransferDomainModal.tsx',
    'src/features/arns/components/ControllersModal.tsx',
  ])('%s passes the flag through rather than asserting it', (path) => {
    const src = readFileSync(path, 'utf8');
    expect(src).toMatch(/paysNetworkDirectly=\{paysNetworkDirectly\}/);
    // A bare `paysNetworkDirectly` prop (or its absence) is a hardcoded claim.
    expect(src).not.toMatch(/^\s*paysNetworkDirectly\s*$/m);
  });
});
