import { describe, expect, it } from 'vitest';

import { failureAdvice, isMoneyAtRisk, stepLabel, type TopUpStep } from './topUpSteps';

describe('stepLabel', () => {
  it('names which of the two signatures is being asked for', () => {
    // Two wallet popups with one spinner between them is indistinguishable
    // from a stuck app.
    expect(stepLabel({ phase: 'funding' })).toMatch(/step 1 of 2/i);
    expect(stepLabel({ phase: 'registering' })).toMatch(/step 2 of 2/i);
  });

  it('explains the gap where nothing is being signed', () => {
    expect(stepLabel({ phase: 'crediting' })).toMatch(/adding credits/i);
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
