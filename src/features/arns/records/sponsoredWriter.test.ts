import { describe, expect, it, vi } from 'vitest';
import type { ArNSOwnerSigner } from '@ardrive/turbo-sdk/web';

import { APEX, sponsoredRecordWriter } from './sponsoredWriter';

const owner = {
  getAddress: () => 'OwnerAddr',
  signTransaction: async (t: string) => t,
  signMessage: async (m: Uint8Array) => m,
} satisfies ArNSOwnerSigner;

function clientWith() {
  return {
    setArNSRecord: vi.fn(async () => ({ messageId: 'set-1' })),
    removeArNSRecord: vi.fn(async () => ({ messageId: 'rm-1' })),
  };
}

describe('sponsoredRecordWriter', () => {
  it('passes the owner through so Turbo can prove who approved', () => {
    const turbo = clientWith();
    const writer = sponsoredRecordWriter('AnT1', turbo, owner);

    return writer
      .setRecord({ undername: 'blog', transactionId: 'TX1', ttlSeconds: 900 })
      .then((res) => {
        expect(res).toEqual({ id: 'set-1' });
        expect(turbo.setArNSRecord).toHaveBeenCalledWith({
          antId: 'AnT1',
          owner,
          transactionId: 'TX1',
          undername: 'blog',
          ttlSeconds: 900,
        });
      });
  });

  it('treats the apex like any other label on the way in', async () => {
    const turbo = clientWith();
    await sponsoredRecordWriter('AnT1', turbo, owner).setRecord({
      undername: APEX,
      transactionId: 'TX1',
      ttlSeconds: 60,
    });
    // Callers pass '@' like any other undername; only removal is special.
    expect(turbo.setArNSRecord).toHaveBeenCalledWith(
      expect.objectContaining({ undername: '@' }),
    );
  });

  it('removes an undername', async () => {
    const turbo = clientWith();
    const res = await sponsoredRecordWriter('AnT1', turbo, owner).removeRecord({
      undername: 'blog',
    });
    expect(res).toEqual({ id: 'rm-1' });
    expect(turbo.removeArNSRecord).toHaveBeenCalledWith({
      antId: 'AnT1',
      owner,
      undername: 'blog',
    });
  });

  it('refuses to remove the apex, and says what to do instead', async () => {
    const turbo = clientWith();
    // The service answers a bare 400 here, which does not explain itself.
    await expect(
      sponsoredRecordWriter('AnT1', turbo, owner).removeRecord({
        undername: APEX,
      }),
    ).rejects.toThrow(/point it somewhere else/i);
    expect(turbo.removeArNSRecord).not.toHaveBeenCalled();
  });
});
