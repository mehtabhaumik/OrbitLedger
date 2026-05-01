import { describe, expect, it } from 'vitest';

import { getManualPaymentVerificationPlan } from './manualPaymentVerification';
import { doesPaymentAwaitClearance } from './paymentModes';

describe('manual payment verification', () => {
  it('treats cleared payment as immediately applicable', () => {
    const plan = getManualPaymentVerificationPlan({
      allocationStrategy: 'selected_invoice',
      clearanceStatus: 'cleared',
    });

    expect(plan.statusLabel).toBe('Verified');
    expect(plan.requiresFollowUp).toBe(false);
    expect(plan.invoiceEffect).toContain('applies');
  });

  it('keeps received instruments pending until marked cleared', () => {
    const plan = getManualPaymentVerificationPlan({
      allocationStrategy: 'selected_invoice',
      clearanceStatus: 'received',
    });

    expect(doesPaymentAwaitClearance('received')).toBe(true);
    expect(plan.requiresFollowUp).toBe(true);
    expect(plan.customerBalanceEffect).toContain('does not reduce');
  });

  it('does not let bounced payment reduce invoice amount', () => {
    const plan = getManualPaymentVerificationPlan({
      allocationStrategy: 'selected_invoice',
      clearanceStatus: 'bounced',
    });

    expect(doesPaymentAwaitClearance('bounced')).toBe(false);
    expect(plan.invoiceEffect).toContain('does not reduce');
  });
});
