import { describe, expect, it } from 'vitest';

import { defaultReminderMessage, isEligibleForReminder } from './bulk-customer-actions';

describe('isEligibleForReminder', () => {
  it('includes customers who owe money', () => {
    expect(isEligibleForReminder(1500)).toBe(true);
  });

  it('excludes zero and negative (credit) balances', () => {
    expect(isEligibleForReminder(0)).toBe(false);
    expect(isEligibleForReminder(-200)).toBe(false);
  });

  it('excludes non-finite balances', () => {
    expect(isEligibleForReminder(Number.NaN)).toBe(false);
  });
});

describe('defaultReminderMessage', () => {
  it('names the customer and states the outstanding amount', () => {
    const message = defaultReminderMessage({ id: 'c1', name: 'Sonali Traders', balance: 1500 }, 'INR');
    expect(message).toContain('Sonali Traders');
    expect(message).toMatch(/1,500/);
  });
});
