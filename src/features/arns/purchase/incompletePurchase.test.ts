import { describe, expect, it } from 'vitest';

import { incompletePurchase } from './incompletePurchase';

const OWNER = 'BqazNSHC6Jx5rq5rTvsVjUo7jnxRJriBV9cBhY2r4VdN';
const now = Date.UTC(2026, 9, 2, 21, 8, 0);
const pending = {
  intent: 'Buy-Name' as const,
  name: 'nnn270',
  owner: OWNER,
  nonce: 'n-1',
  savedAt: now - 60_000,
};
const base = {
  pending,
  address: OWNER,
  ownedNames: [],
  now,
  formatTime: () => '21:25',
};

describe('incompletePurchase', () => {
  it('says the credits are held while the action waits on the wallet', () => {
    const v = incompletePurchase({
      ...base,
      status: { status: 'awaiting-signature', expiresAt: now + 10 * 60_000 },
    });
    expect(v.kind).toBe('waiting');
    if (v.kind !== 'waiting') return;
    expect(v.name).toBe('nnn270');
    expect(v.message).toMatch(/nnn270\.ar\.io didn't finish/);
    expect(v.message).toMatch(/21:25/);
    // Turbo reports awaiting-signature even after the wallet approved, so the
    // copy never claims the wallet did not.
    expect(v.message).not.toMatch(/approved/);
  });

  it('says a purchase it could not confirm may still land', () => {
    const v = incompletePurchase({
      ...base,
      held: { nonce: 'n-1', unconfirmed: true },
      status: { status: 'awaiting-signature', expiresAt: now + 10 * 60_000 },
    });
    expect(v.kind).toBe('waiting');
    if (v.kind !== 'waiting') return;
    expect(v.message).toMatch(/couldn't confirm/);
    expect(v.message).toMatch(/If it didn't go through/);
    // Another attempt's flag does not apply to this one.
    const other = incompletePurchase({
      ...base,
      held: { nonce: 'n-other', unconfirmed: true },
      status: { status: 'awaiting-signature' },
    });
    expect(other.kind === 'waiting' && other.message).toMatch(/didn't finish/);
  });

  it('says an expired attempt was refunded', () => {
    const v = incompletePurchase({ ...base, status: { status: 'expired' } });
    expect(v.kind).toBe('expired');
    if (v.kind !== 'expired') return;
    expect(v.message).toMatch(/back in your balance/);
  });

  it('treats a completed action, or a name already listed, as done', () => {
    expect(incompletePurchase({ ...base, status: { status: 'completed' } }).kind).toBe(
      'completed',
    );
    expect(
      incompletePurchase({
        ...base,
        ownedNames: [{ name: 'NNN270' }],
        status: { status: 'awaiting-signature' },
      }).kind,
    ).toBe('completed');
  });

  it('stops reporting a purchase once it is past the age limit', () => {
    expect(
      incompletePurchase({
        ...base,
        pending: { ...pending, savedAt: now - 31 * 60_000 },
        status: { status: 'expired' },
      }).kind,
    ).toBe('none');
  });

  it('says nothing it cannot back up', () => {
    // Status unknown (read failed), or not a credits purchase, or another wallet.
    expect(incompletePurchase({ ...base, status: undefined }).kind).toBe('none');
    expect(
      incompletePurchase({
        ...base,
        pending: { ...pending, nonce: undefined, processId: 'ant' },
        status: { status: 'expired' },
      }).kind,
    ).toBe('none');
    expect(
      incompletePurchase({ ...base, address: 'SomeoneElse', status: { status: 'expired' } })
        .kind,
    ).toBe('none');
    expect(
      incompletePurchase({ ...base, pending: undefined, status: undefined }).kind,
    ).toBe('none');
  });
});
