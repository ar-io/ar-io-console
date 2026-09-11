import { describe, expect, it, vi } from 'vitest';

import { TurboArNSClient } from './TurboArNSClient';

/**
 * What the console sends to turbo-sdk when it buys a name.
 *
 * `antState` is the reason these exist. A service that accepts it and a service
 * that ignores it return the identical success, and a console that drops it on
 * the way looks identical too — the only place the difference is observable is
 * the arguments handed to the SDK. So assert those, not that a call happened.
 */
const svc = () =>
  new TurboArNSClient({
    paymentUrl: 'https://payment.test',
    uploadUrl: 'https://upload.test',
    gatewayUrl: 'https://gateway.test',
  });

/** Minimal stand-in for the ANT owner — only its address is read here. */
const owner = { getAddress: async () => 'owner-address' } as never;

function fakeClient() {
  const completed = { nonce: 'n1', messageId: 'm1', status: 'completed' };
  return {
    buyArNSName: vi.fn().mockResolvedValue(completed),
    extendArNSLease: vi.fn().mockResolvedValue(completed),
    upgradeArNSName: vi.fn().mockResolvedValue(completed),
    increaseArNSUndernameLimit: vi.fn().mockResolvedValue(completed),
  };
}

const TX = 'T9_V2HfiAq5qlLzObfyayj2-cjPujxpg25TRi4OZbe4';

describe('purchaseWithCredits — the ANT opening state', () => {
  it('forwards antState to buyArNSName unchanged', async () => {
    const client = fakeClient();
    await svc().purchaseWithCredits({
      client: client as never,
      name: 'my-name',
      owner,
      type: 'lease',
      years: 1,
      antState: { transactionId: TX, targetProtocol: 0 },
    });
    expect(client.buyArNSName.mock.calls[0][0].antState).toEqual({
      transactionId: TX,
      targetProtocol: 0,
    });
  });

  it('omits the key entirely when no antState is given', async () => {
    // Not `antState: undefined` — the SDK spreads conditionally too, and a
    // present-but-undefined key is a different request from an absent one.
    const client = fakeClient();
    await svc().purchaseWithCredits({
      client: client as never,
      name: 'my-name',
      owner,
      type: 'permabuy',
    });
    expect('antState' in client.buyArNSName.mock.calls[0][0]).toBe(false);
  });

  it('lower-cases the name it buys', async () => {
    const client = fakeClient();
    await svc().purchaseWithCredits({
      client: client as never,
      name: 'MyName',
      owner,
      type: 'permabuy',
      antState: { transactionId: TX, targetProtocol: 0 },
    });
    expect(client.buyArNSName.mock.calls[0][0].name).toBe('myname');
  });

  it('never sends antState on a non-buy intent', async () => {
    // The service 400s antState on anything but buy-name, so no blanket param
    // spread may ever carry it into a renewal.
    const client = fakeClient();
    await svc().purchaseWithCredits({
      client: client as never,
      name: 'my-name',
      intent: 'Extend-Lease',
      years: 2,
      antState: { transactionId: TX, targetProtocol: 0 },
    });
    expect(client.buyArNSName).not.toHaveBeenCalled();
    expect('antState' in client.extendArNSLease.mock.calls[0][0]).toBe(false);
  });

  it('refuses a buy with no owner rather than minting to the wrong wallet', async () => {
    const client = fakeClient();
    await expect(
      svc().purchaseWithCredits({
        client: client as never,
        name: 'my-name',
        type: 'permabuy',
      }),
    ).rejects.toThrow(/wallet that will own this name/i);
    expect(client.buyArNSName).not.toHaveBeenCalled();
  });
});
