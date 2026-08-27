import { describe, expect, it } from 'vitest';

import {
  failureAdvice,
  isMoneyAtRisk,
  stepLabel,
  waitingNotice,
  type TopUpStep,
} from './topUpSteps';

describe('stepLabel', () => {
  it('names which of the two signatures is being asked for', () => {
    // Two wallet popups with one spinner between them is indistinguishable
    // from a stuck app.
    expect(stepLabel({ phase: 'funding' })).toMatch(/step 1 of 2/i);
    expect(stepLabel({ phase: 'registering' })).toMatch(/step 2 of 2/i);
  });

  it('explains the gap where nothing is being signed', () => {
    // And says the name is NOT bought yet — the thing a user staring at a
    // spinner most wants to know.
    const label = stepLabel({ phase: 'crediting' })!;
    expect(label).toMatch(/waiting for credits/i);
    expect(label).toMatch(/not bought yet/i);
  });

  it('says nothing when idle or failed — those render their own UI', () => {
    expect(stepLabel({ phase: 'idle' })).toBeUndefined();
    expect(stepLabel({ phase: 'failed', message: 'x', funded: false })).toBeUndefined();
  });
});

describe('failureAdvice', () => {
  it('reassures when the money already landed as credits', () => {
    // They paid and hold credits; the name just is not registered yet. Calling
    // that a failed purchase implies a refund that is never coming.
    expect(failureAdvice({ phase: 'failed', message: 'x', funded: true }))
      .toMatch(/safe|without paying again/i);
  });

  it('says nothing was charged when the transfer never landed', () => {
    expect(failureAdvice({ phase: 'failed', message: 'x', funded: false }))
      .toMatch(/nothing was charged/i);
  });

  it('returns nothing for non-failure states', () => {
    for (const p of ['idle', 'funding', 'crediting', 'registering'] as const) {
      expect(failureAdvice({ phase: p } as TopUpStep)).toBeUndefined();
    }
  });
});

describe('isMoneyAtRisk', () => {
  it('covers every phase from the first signature onward', () => {
    expect(isMoneyAtRisk({ phase: 'funding' })).toBe(true);
    expect(isMoneyAtRisk({ phase: 'crediting' })).toBe(true);
    expect(isMoneyAtRisk({ phase: 'registering' })).toBe(true);
  });

  it('is false before starting and after settling', () => {
    expect(isMoneyAtRisk({ phase: 'idle' })).toBe(false);
    expect(isMoneyAtRisk({ phase: 'failed', message: 'x', funded: true })).toBe(false);
  });
});

describe('funding source changes how many prompts remain', () => {
  it('does not count steps for a card buyer who never saw step 1', () => {
    // The card path starts at `crediting`, so "Step 2 of 2" would be the first
    // step label it ever shows.
    expect(stepLabel({ phase: 'registering' }, 'card')).toBe(
      'Approve the registration to claim the name',
    );
    expect(stepLabel({ phase: 'registering' }, 'wallet')).toBe(
      'Step 2 of 2 — approve the registration to claim the name',
    );
  });

  it('never promises a card buyer a second prompt', () => {
    expect(waitingNotice({ phase: 'registering' }, 'card')).not.toContain(
      'second',
    );
    expect(waitingNotice({ phase: 'registering' }, 'wallet')).toContain(
      'second prompt',
    );
  });

  it('defaults to the two-signature wording', () => {
    expect(stepLabel({ phase: 'registering' })).toBe(
      stepLabel({ phase: 'registering' }, 'wallet'),
    );
  });
});
