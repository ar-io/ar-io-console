import { describe, it, expect } from 'vitest';

import { deriveAntRole, isOwnerOnlyAllowed } from './antRole';
import type { AntSummary } from './hooks/useAntLogos';

const summary = (owner: string, controllers: string[] = []): AntSummary => ({
  owner,
  controllers,
  logo: undefined,
});

const ME = 'Me1111111111111111111111111111111111111111';
const OTHER = 'Ot2222222222222222222222222222222222222222';

describe('deriveAntRole', () => {
  it('is owner when the wallet is the ANT owner', () => {
    expect(deriveAntRole(summary(ME, [OTHER]), ME)).toBe('owner');
  });

  it('is controller when the wallet is only in controllers', () => {
    expect(deriveAntRole(summary(OTHER, [ME]), ME)).toBe('controller');
  });

  it('is unknown while the summary has not loaded', () => {
    expect(deriveAntRole(undefined, ME)).toBe('unknown');
  });

  it('is unknown without a wallet address', () => {
    expect(deriveAntRole(summary(ME), null)).toBe('unknown');
  });

  it('treats an ACL-drifted row (neither owner nor controller) as controller', () => {
    // In the wallet's ACL index but no longer owner/controller on-chain.
    expect(deriveAntRole(summary(OTHER, [OTHER]), ME)).toBe('controller');
  });
});

describe('isOwnerOnlyAllowed', () => {
  it('allows only a confirmed owner; denies unknown and controller', () => {
    expect(isOwnerOnlyAllowed('owner')).toBe(true);
    // 'unknown' (still loading / lookup failed) must NOT show owner-only actions.
    expect(isOwnerOnlyAllowed('unknown')).toBe(false);
    expect(isOwnerOnlyAllowed('controller')).toBe(false);
  });
});
