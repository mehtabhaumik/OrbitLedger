import { describe, expect, it } from 'vitest';

import { getManualPaymentVerificationPlan } from './manualPaymentVerification';
import { doesPaymentAwaitClearance } from './paymentModes';

describe('manual payment verification', () => {
  it('treats cleared payment as immediately applicable', () => {
    const plan = getManualPaymentVerificationPlan({
      allocationStrategy: 'selected_invoice',
      clearanceStatus: 'cleared',
      paymentMode: 'upi',
    });

    expect(plan.statusLabel).toBe('Verified');
    expect(plan.requiresFollowUp).toBe(false);
    expect(plan.invoiceEffect).toContain('applies');
  });

  it('keeps received instruments pending until marked cleared', () => {
    const plan = getManualPaymentVerificationPlan({
      allocationStrategy: 'selected_invoice',
      clearanceStatus: 'received',
      paymentMode: 'cheque',
    });

    expect(doesPaymentAwaitClearance('received', 'cheque')).toBe(true);
    expect(plan.requiresFollowUp).toBe(true);
    expect(plan.customerBalanceEffect).toContain('does not reduce');
  });

  it('does not let errored electronic payment reduce invoice amount', () => {
    const plan = getManualPaymentVerificationPlan({
      allocationStrategy: 'selected_invoice',
      clearanceStatus: 'errored',
      paymentMode: 'upi',
    });

    expect(doesPaymentAwaitClearance('errored')).toBe(false);
    expect(plan.invoiceEffect).toContain('does not reduce');
  });

  it('treats received cash as verified because cash has no separate clearing step', () => {
    const plan = getManualPaymentVerificationPlan({
      allocationStrategy: 'selected_invoice',
      clearanceStatus: 'received',
      paymentMode: 'cash',
    });

    expect(plan.statusLabel).toBe('Verified');
    expect(plan.requiresFollowUp).toBe(false);
  });
});
